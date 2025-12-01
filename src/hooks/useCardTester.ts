import { useState, useCallback, useRef } from 'react';
import { api } from '../utils/supabase';
import type { CardResult } from '../utils/supabase';

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
    const [currentCard, setCurrentCard] = useState<string>('');

    // Refs for managing the testing loop
    const abortControllerRef = useRef<AbortController | null>(null);
    const startTimeRef = useRef<number>(0);
    const processedCountRef = useRef<number>(0);

    // Helper: Generate random amount
    const getRandomAmount = (min: number, max: number) => {
        return Number((Math.random() * (max - min) + min).toFixed(2));
    };

    // Helper: Sleep
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const startTesting = useCallback(async (
        cards: string[],
        options: {
            gatewayUrl: string;
            minAmount: number;
            maxAmount: number;
            minDelay: number;
            maxDelay: number;
            proxyUrl?: string;
        }
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

        try {
            // 1. Start Session
            const session = await api.startSession(options.gatewayUrl, cards.length);
            setSessionId(session.sessionId);

            // 2. Process Cards
            const CONCURRENCY = 1;

            let currentIndex = 0;

            const processNext = async () => {
                if (currentIndex >= cards.length || abortControllerRef.current?.signal.aborted) {
                    return;
                }

                const cardLine = cards[currentIndex];
                currentIndex++;

                // Parse card line (assuming format: number|month|year|cvv)
                const [number, month, year, cvv] = cardLine.split('|');

                if (!number || !month || !year || !cvv) {
                    // Skip invalid lines for now, or handle error
                } else {
                    setCurrentCard(number);

                    try {
                        // Calculate random delay
                        const delay = Math.floor(
                            Math.random() * (options.maxDelay - options.minDelay + 1) + options.minDelay
                        ) * 1000;

                        if (currentIndex > 1) {
                            await sleep(delay);
                        }

                        // Calculate random amount
                        const amount = getRandomAmount(options.minAmount, options.maxAmount);

                        const result = await api.testCard({
                            sessionId: session.sessionId,
                            cardNumber: number,
                            expMonth: month,
                            expYear: year,
                            cvv: cvv,
                            gatewayUrl: options.gatewayUrl,
                            processingOrder: currentIndex,
                            amount: amount,
                            proxyUrl: options.proxyUrl
                        });

                        setResults(prev => [result, ...prev]);

                        setStats(prev => {
                            const newStats = {
                                ...prev,
                                processed: prev.processed + 1,
                                [result.status]: prev[result.status as keyof typeof prev] + 1
                            };

                            // Calculate speed
                            const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
                            newStats.speed = elapsedMinutes > 0 ? Math.round(newStats.processed / elapsedMinutes) : 0;

                            return newStats;
                        });

                    } catch (error) {
                        console.error('Error testing card:', error);
                    }
                }

                // Continue to next
                await processNext();
            };

            // Start concurrent workers
            const workers = Array(CONCURRENCY).fill(null).map(() => processNext());
            await Promise.all(workers);

        } catch (error) {
            console.error('Failed to start session:', error);
            alert('Failed to start testing session. Check console for details.');
        } finally {
            setIsRunning(false);
            setCurrentCard('');
            abortControllerRef.current = null;
        }
    }, [isRunning]);

    const stopTesting = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsRunning(false);
        }
    }, []);

    const downloadLive = useCallback(async () => {
        if (!sessionId) return;
        try {
            const blob = await api.downloadLiveCards(sessionId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `approved_cards_${sessionId}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download CSV');
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
        hasLiveCards: stats.live > 0
    };
};
