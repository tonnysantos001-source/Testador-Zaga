```
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Shield, Clock, DollarSign, Globe } from 'lucide-react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateway: string;
  onGatewayChange: (value: string) => void;
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
  gateway,
  onGatewayChange,
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
                    <span className="text-gradient">Configuration</span>
                  </h2>
                </div>
                <button className="close-btn" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Gateway Section */}
                <div className="form-group">
                  <label htmlFor="gateway" className="form-label">
                    <Shield size={16} />
                    Gateway URL
                  </label>
                  <input
                    type="text"
                    id="gateway"
                    className="form-input glass"
                    placeholder="https://api.gateway.com/charge"
                    value={gateway}
                    onChange={(e) => onGatewayChange(e.target.value)}
                  />
                </div>

                {/* Amount Range Section */}
                <div className="form-row">
                  <div className="form-group half">
                    <label className="form-label">
                      <DollarSign size={16} />
                      Min Amount
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
                      Max Amount
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
                      Min Delay (sec)
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
                      Max Delay (sec)
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
                    Proxy URL (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input glass"
                    value={proxyUrl}
                    onChange={(e) => onProxyUrlChange(e.target.value)}
                    placeholder="http://user:pass@host:port"
                  />
                  <p className="form-hint">
                    Leave empty to use server IP.
                  </p>
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" onClick={onClose}>
                    Save Configuration
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
```
