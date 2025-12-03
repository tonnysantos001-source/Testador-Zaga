import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, XCircle, AlertCircle, DollarSign, Building2, Globe, CreditCard as CardIcon } from 'lucide-react';
import type { CardResult } from '../utils/supabase';
import './ResultsPanel.css';

interface ResultsPanelProps {
    results: CardResult[];
    filter: 'all' | 'live' | 'die' | 'unknown';
}

export default function ResultsPanel({ results, filter }: ResultsPanelProps) {
    const filteredResults = filter === 'all'
        ? results
        : results.filter(r => r.status === filter);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'live':
                return <CheckCircle2 size={16} className="status-icon live" />;
            case 'die':
                return <XCircle size={16} className="status-icon die" />;
            case 'unknown':
                return <AlertCircle size={16} className="status-icon unknown" />;
            default:
                return null;
        }
    };

    const getStatusClass = (status: string) => {
        return `result-item ${status}`;
    };

    const maskCardNumber = (cardNumber: string) => {
        // Show full number as requested by user
        return cardNumber;
    };

    return (
        <div className="results-panel glass">
            <div className="results-header">
                <div className="header-title">
                    <CreditCard size={18} />
                    <h3>Results</h3>
                </div>
                <div className="results-count">
                    {filteredResults.length} {filter === 'all' ? 'total' : filter}
                </div>
            </div>

            <div className="results-list">
                <AnimatePresence mode="popLayout">
                    {filteredResults.length === 0 ? (
                        <motion.div
                            className="empty-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <CreditCard size={48} className="empty-icon" />
                            <p>No results yet</p>
                            <span>Results will appear here as cards are tested</span>
                        </motion.div>
                    ) : (
                        filteredResults.map((result, index) => (
                            <motion.div
                                key={`${result.id}-${index}`}
                                className={getStatusClass(result.status)}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.02 }}
                                layout
                            >
                                <div className="result-icon">
                                    {getStatusIcon(result.status)}
                                </div>
                                <div className="result-content">
                                    <div className="card-header">
                                        <div className="card-number">
                                            {maskCardNumber(result.card_number || `${result.card_first4}********${result.card_last4}`)}
                                        </div>
                                        {result.status === 'live' && result.amount && (
                                            <div className="result-amount">
                                                <DollarSign size={14} />
                                                {result.amount.toFixed(2)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Holder Name (if available) */}
                                    {/* Nota: O tipo CardResult precisa ser atualizado para incluir 'holder' se quisermos tipagem estrita, mas JS aceita */}
                                    {(result as any).holder && (
                                        <div className="result-holder" style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                                            {(result as any).holder}
                                        </div>
                                    )}

                                    {/* BIN Details Section */}
                                    {(result.card_bank || result.card_brand) && (
                                        <div className="bin-details">
                                            {result.card_bank && (
                                                <span className="bin-badge bank">
                                                    <Building2 size={10} /> {result.card_bank}
                                                </span>
                                            )}
                                            {result.card_brand && (
                                                <span className="bin-badge brand">
                                                    <CardIcon size={10} /> {result.card_brand}
                                                </span>
                                            )}
                                            {result.card_country && (
                                                <span className="bin-badge country">
                                                    <Globe size={10} /> {result.card_country}
                                                </span>
                                            )}
                                            {result.card_type && (
                                                <span className="bin-badge type">
                                                    {result.card_type}
                                                </span>
                                            )}
                                            {result.card_level && (
                                                <span className="bin-badge level">
                                                    {result.card_level}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {result.message && (
                                        <div className="result-message">{result.message}</div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
