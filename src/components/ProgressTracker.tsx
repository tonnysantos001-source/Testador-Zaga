import { motion } from 'framer-motion';
import { Activity, Zap, CheckCircle2 } from 'lucide-react';
import './ProgressTracker.css';

interface ProgressTrackerProps {
    isRunning: boolean;
    total: number;
    processed: number;
    currentCard?: string;
    speed: number; // cards per second
}

export default function ProgressTracker({ isRunning, total, processed, currentCard, speed }: ProgressTrackerProps) {
    const remaining = total - processed;
    const percentage = total > 0 ? (processed / total) * 100 : 0;

    if (!isRunning && processed === 0) return null;

    const maskCard = (card: string) => {
        if (!card || card.length < 8) return card;
        const first4 = card.substring(0, 4);
        const last4 = card.substring(card.length - 4);
        return `${first4} •••• ${last4}`;
    };

    return (
        <motion.div
            className="progress-tracker glass"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            <div className="progress-header">
                <div className="progress-status">
                    {isRunning ? (
                        <>
                            <motion.div
                                className="status-indicator running"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                            >
                                <Activity size={16} />
                            </motion.div>
                            <span className="status-text">Testing in progress...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={16} className="status-indicator completed" />
                            <span className="status-text">Testing completed</span>
                        </>
                    )}
                </div>
                <div className="progress-speed">
                    <Zap size={14} />
                    <span>{speed} cards/sec</span>
                </div>
            </div>

            <div className="progress-stats">
                <div className="stat-item">
                    <span className="stat-label">Processed</span>
                    <motion.span
                        className="stat-value"
                        key={processed}
                        initial={{ scale: 1.2, color: '#00d9ff' }}
                        animate={{ scale: 1, color: '#e5e7eb' }}
                        transition={{ duration: 0.3 }}
                    >
                        {processed}
                    </motion.span>
                </div>
                <div className="stat-divider">/</div>
                <div className="stat-item">
                    <span className="stat-label">Total</span>
                    <span className="stat-value">{total}</span>
                </div>
                <div className="stat-item remaining">
                    <span className="stat-label">Remaining</span>
                    <span className="stat-value">{remaining}</span>
                </div>
            </div>

            <div className="progress-bar-container">
                <motion.div
                    className="progress-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    <motion.div
                        className="progress-shine"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    />
                </motion.div>
                <span className="progress-percentage">{percentage.toFixed(1)}%</span>
            </div>

            {currentCard && isRunning && (
                <motion.div
                    className="current-card"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                >
                    <span className="current-label">Testing:</span>
                    <motion.span
                        className="current-value"
                        key={currentCard}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {maskCard(currentCard)}
                    </motion.span>
                </motion.div>
            )}
        </motion.div>
    );
}
