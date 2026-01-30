import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { X, Save, ShieldCheck, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: any) => void;
  currentSettings: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const [hasChanges, setHasChanges] = useState(false);
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
            <input
              type="number"
              step="0.5"
              value={settings.minDelay}
              onChange={(e) => handleChange('minDelay', parseFloat(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Máximo</label>
            <input
              type="number"
              step="0.5"
              value={settings.maxDelay}
              onChange={(e) => handleChange('maxDelay', parseFloat(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
            />
          </div>
        </div>
      <p className="text-xs text-gray-500">
        Delay aleatório para simular comportamento humano e evitar bloqueios.
      </p>
    </div>

            </div >

  {/* Footer */ }
  < div className = "p-6 border-t border-gray-800 bg-gray-900/50 backdrop-blur sticky bottom-0" >
    <div className="flex items-center justify-end gap-3">
      <button
        onClick={handleClose}
        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
      >
        Cancelar
      </button>
      <button
        onClick={handleSave}
        disabled={!hasChanges}
        className={`
                    flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all
                    ${hasChanges
            ? 'bg-green-500 hover:bg-green-600 text-black shadow-lg shadow-green-500/20'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                  `}
      >
        <Save className="w-4 h-4" />
        Salvar Alterações
      </button>
    </div>
            </div >
          </motion.div >
        </>
      )}
    </AnimatePresence >
  );
};
