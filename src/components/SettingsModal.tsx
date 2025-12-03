import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Clock, DollarSign, Globe, CheckCircle } from 'lucide-react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  minAmount: number;
  onMinAmountChange: (value: number) => void;
  maxAmount: number;
  onMaxAmountChange: (value: number) => void;
  minDelay: number;
  onMinDelayChange: (value: number) => void;
  maxDelay: number;
  onMaxDelayChange: (value: number) => void;
  proxyUrl: string;
  onProxyUrlChange: (value: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  minDelay,
  onMinDelayChange,
  maxDelay,
  onMaxDelayChange,
  proxyUrl,
  onProxyUrlChange
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="modal-container"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="modal-content glass">
              <div className="modal-header">
                <div className="modal-title-wrapper">
                  <Settings size={20} />
                  <h2 className="modal-title">
                    <span className="text-gradient">Configuração</span>
                  </h2>
                </div>
                <button className="close-btn" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Gateway Info Section */}
                <div className="form-group" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <CheckCircle size={18} style={{ color: '#10b981' }} />
                    <label className="form-label" style={{ margin: 0, color: '#10b981' }}>
                      Gateway Configurado
                    </label>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', margin: 0 }}>
                    ✓ Appmax API integrado via Supabase
                  </p>
                </div>

                {/* Amount Range Section */}
                <div className="form-row">
                  <div className="form-group half">
                    <label className="form-label">
                      <DollarSign size={16} />
                      Valor Mínimo
                    </label>
                    <input
                      type="number"
                      className="form-input glass"
                      value={minAmount}
                      onChange={(e) => onMinAmountChange(Number(e.target.value))}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="form-group half">
                    <label className="form-label">
                      <DollarSign size={16} />
                      Valor Máximo
                    </label>
                    <input
                      type="number"
                      className="form-input glass"
                      value={maxAmount}
                      onChange={(e) => onMaxAmountChange(Number(e.target.value))}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {/* Delay Section */}
                <div className="form-row">
                  <div className="form-group half">
                    <label className="form-label">
                      <Clock size={16} />
                      Delay Mínimo (seg)
                    </label>
                    <input
                      type="number"
                      className="form-input glass"
                      value={minDelay}
                      onChange={(e) => onMinDelayChange(Number(e.target.value))}
                      min="0"
                    />
                  </div>
                  <div className="form-group half">
                    <label className="form-label">
                      <Clock size={16} />
                      Delay Máximo (seg)
                    </label>
                    <input
                      type="number"
                      className="form-input glass"
                      value={maxDelay}
                      onChange={(e) => onMaxDelayChange(Number(e.target.value))}
                      min="0"
                    />
                  </div>
                </div>

                {/* Proxy Section */}
                <div className="form-group">
                  <label className="form-label">
                    <Globe size={16} />
                    URL do Proxy (Opcional)
                  </label>
                  <input
                    type="text"
                    className="form-input glass"
                    value={proxyUrl}
                    onChange={(e) => onProxyUrlChange(e.target.value)}
                    placeholder="http://usuario:senha@host:porta"
                  />
                  <p className="form-hint">
                    Deixe vazio para usar o IP do servidor.
                  </p>
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" onClick={onClose}>
                    Salvar Configuração
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
