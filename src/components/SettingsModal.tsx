import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import { X, Save, ShieldCheck, AlertCircle, DollarSign, Clock, Globe, CheckCircle } from 'lucide-react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: any) => void;
  currentSettings: any;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
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
}) => {
  const [settings, setSettings] = useState(currentSettings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  // Handle changes
  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(settings);
    setHasChanges(false);
    onClose();
  };

  // Reset to default on close if not saved
  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('Existem alterações não salvas. Deseja sair mesmo assim?')) {
        setSettings(currentSettings);
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 m-auto w-full max-w-lg h-fit max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-white">Configurações</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">

              {/* Gateway Info Section */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <h3 className="text-sm font-medium text-gray-300">
                    Gateway Configurado
                  </h3>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">Zentripay (V2)</p>
                    <p className="text-xs text-gray-500 mt-1">Integração via API Segura</p>
                  </div>
                  <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                    <span className="text-xs font-medium text-green-400">Ativo</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 text-xs text-blue-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    As credenciais (API Key) são gerenciadas de forma segura através das variáveis de ambiente do Supabase (Secrets).
                    Não é necessário configurar chaves aqui no frontend.
                  </p>
                </div>
              </div>

              {/* Amount Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Valores de Teste (R$)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Mínimo</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        step="0.10"
                        value={minAmount}
                        onChange={(e) => onMinAmountChange(parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Máximo</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="number"
                        step="0.10"
                        value={maxAmount}
                        onChange={(e) => onMaxAmountChange(parseFloat(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delay Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Delay entre Requisições (s)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Mínimo</label>
                    <input
                      type="number"
                      step="0.5"
                      value={minDelay}
                      onChange={(e) => onMinDelayChange(parseFloat(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Máximo</label>
                    <input
                      type="number"
                      step="0.5"
                      value={maxDelay}
                      onChange={(e) => onMaxDelayChange(parseFloat(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Delay aleatório para simular comportamento humano e evitar bloqueios.
                </p>
              </div>

              {/* Proxy Section */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  URL do Proxy (Opcional)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => onProxyUrlChange(e.target.value)}
                    placeholder="http://usuario:senha@host:porta"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Deixe vazio para usar o IP do servidor.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-800 bg-gray-900/50 backdrop-blur sticky bottom-0">
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
export default SettingsModal;
