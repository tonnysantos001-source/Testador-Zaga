import { motion, AnimatePresence } from 'framer-motion';
import {
    CreditCard,
    CheckCircle2,
    XCircle,
    AlertCircle,
    DollarSign,
    Building2,
    Globe,
    CreditCard as CardIcon,
    ShieldCheck,
    User
} from 'lucide-react';
import type { CardResult, ValidationState } from '../utils/supabase';
import './ResultsPanel.css';

interface ResultsPanelProps {
    results: CardResult[];
    filter: 'all' | 'live' | 'die' | 'unknown';
}

export default function ResultsPanel({ results, filter }: ResultsPanelProps) {
    const filteredResults = filter === 'all'
        ? results
        : results.filter(r => r.status === filter);

    const getStatusIcon = (status: string, validationState?: ValidationState) => {
        if (validationState === 'METHOD_VERIFIED' || status === 'live') {
            return <CheckCircle2 size={16} className="status-icon live" />;
        }
        if (validationState === 'METHOD_DECLINED' || status === 'die') {
            return <XCircle size={16} className="status-icon die" />;
        }
        return <AlertCircle size={16} className="status-icon unknown" />;
    };

    const getStatusClass = (status: string, validationState?: ValidationState) => {
        if (validationState === 'METHOD_VERIFIED' || status === 'live') return 'result-item live';
        if (validationState === 'METHOD_DECLINED' || status === 'die') return 'result-item die';
        return 'result-item unknown';
    };

    const maskCardNumber = (cardNumber: string) => {
        return cardNumber;
    };

    const renderValidationBadge = (state?: ValidationState, status?: string) => {
        const effectiveState = state || (status === 'live' ? 'METHOD_VERIFIED' : status === 'die' ? 'METHOD_DECLINED' : 'TRANSACTION_ERROR');

        switch (effectiveState) {
            case 'METHOD_VERIFIED':
                return (
                    <span className="bin-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', fontWeight: 700 }}>
                        <ShieldCheck size={11} /> METHOD VERIFIED
                    </span>
                );
            case 'METHOD_DECLINED':
                return (
                    <span className="bin-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                        DECLINED
                    </span>
                );
            case 'VALIDATING_PAYMENT_METHOD':
                return (
                    <span className="bin-badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                        VALIDATING
                    </span>
                );
            case 'TOKEN_GENERATED':
                return (
                    <span className="bin-badge" style={{ background: 'rgba(147, 51, 234, 0.2)', color: '#c084fc', border: '1px solid rgba(147, 51, 234, 0.4)' }}>
                        TOKEN OK
                    </span>
                );
            default:
                return (
                    <span className="bin-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                        RETRY NEEDED
                    </span>
                );
        }
    };

    return (
        <div className="results-panel glass">
            <div className="results-header">
                <div className="header-title">
                    <CreditCard size={18} />
                    <h3>Resultados de Validação (Mercado Pago)</h3>
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
                            <p>Nenhum resultado ainda</p>
                            <span>Os métodos validados aparecerão aqui em tempo real</span>
                        </motion.div>
                    ) : (
                        filteredResults.map((result, index) => (
                            <motion.div
                                key={`${result.id}-${index}`}
                                className={getStatusClass(result.status, result.validation_state)}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.02 }}
                                layout
                            >
                                <div className="result-icon">
                                    {getStatusIcon(result.status, result.validation_state)}
                                </div>
                                <div className="result-content">
                                    <div className="card-header">
                                        <div className="card-number">
                                            {maskCardNumber(result.card_number || `${result.card_first4}********${result.card_last4}`)}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {renderValidationBadge(result.validation_state, result.status)}
                                            {result.status === 'live' && result.amount && (
                                                <div className="result-amount">
                                                    <DollarSign size={13} />
                                                    {result.amount.toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Holder / Buyer Context info */}
                                    {(result.holder || result.payer_name) && (
                                        <div className="result-holder" style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <User size={11} /> {result.payer_name || result.holder}
                                            {result.payer_document && (
                                                <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>• CPF: {result.payer_document}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* BIN Details Section */}
                                    {(result.card_bank || result.card_brand || result.card_type) && (
                                        <div className="bin-details">
                                            <div className="bin-row-primary">
                                                {result.card_bank && result.card_bank !== "Unknown" && (
                                                    <span className="bin-badge bank-name">
                                                        <Building2 size={12} /> {result.card_bank}
                                                    </span>
                                                )}
                                                {result.card_brand && (
                                                    <span className="bin-badge brand">
                                                        <CardIcon size={12} /> {result.card_brand}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="bin-row-secondary">
                                                {result.card_type && (
                                                    <span className={`bin-badge card-type ${result.card_type.toLowerCase()}`}>
                                                        {result.card_type.toUpperCase()}
                                                    </span>
                                                )}
                                                {result.card_level && (
                                                    <span className="bin-badge level">
                                                        {result.card_level}
                                                    </span>
                                                )}
                                                {result.card_country && (
                                                    <span className="bin-badge country">
                                                        <Globe size={10} /> {result.card_country}
                                                    </span>
                                                )}
                                            </div>
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
