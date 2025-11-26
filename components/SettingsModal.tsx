
import React, { useState, useEffect } from 'react';
import { Settings, X, AlertTriangle, CheckCircle, Loader2, Server } from 'lucide-react';
import { AppConfig, DEFAULT_WORKER_URL } from '../types';
import { validateBotToken, saveBackendConfig } from '../services/telegramService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleTestConnection = async () => {
    setIsValidating(true);
    setValidationStatus('idle');
    const success = await validateBotToken(localConfig);
    setValidationStatus(success ? 'success' : 'error');
    setIsValidating(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    // 1. Save to local App State (Client Side)
    onSave(localConfig);

    // 2. Save to Backend (D1) so the Proxy can work securely without headers
    await saveBackendConfig(localConfig);
    
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="w-5 h-5" />
            <h2 className="font-semibold text-lg">Configuration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Bot Token */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Bot Token</label>
            <input
              type="text"
              placeholder="123456789:ABCdef..."
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-telegram-500 focus:ring-2 focus:ring-telegram-100 transition-all outline-none text-sm"
              value={localConfig.botToken}
              onChange={(e) => setLocalConfig({ ...localConfig, botToken: e.target.value })}
            />
            <p className="text-xs text-slate-500">From @BotFather</p>
          </div>

          {/* Chat ID */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Chat ID</label>
            <input
              type="text"
              placeholder="-100..."
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-telegram-500 focus:ring-2 focus:ring-telegram-100 transition-all outline-none text-sm"
              value={localConfig.chatId}
              onChange={(e) => setLocalConfig({ ...localConfig, chatId: e.target.value })}
            />
            <p className="text-xs text-slate-500">Channel ID where files are stored</p>
          </div>

          {/* Worker URL */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
             <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                <Server className="w-4 h-4" />
                Worker URL (Backend)
             </label>
             <input
              type="text"
              placeholder="/api"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-telegram-500 focus:ring-2 focus:ring-telegram-100 transition-all outline-none text-sm font-mono bg-slate-50"
              value={localConfig.workerUrl}
              onChange={(e) => setLocalConfig({ ...localConfig, workerUrl: e.target.value })}
            />
            <p className="text-xs text-slate-400">URL of your Cloudflare Worker. Use '/api' if served from same domain.</p>
          </div>

          {/* Validation Message */}
          {validationStatus === 'error' && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Connection failed. Check credentials or Worker URL.
            </div>
          )}
          {validationStatus === 'success' && (
            <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Connected successfully!
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <button
            onClick={handleTestConnection}
            disabled={isValidating || isSaving || !localConfig.botToken}
            className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !localConfig.botToken || !localConfig.chatId}
            className="px-6 py-2 bg-telegram-500 hover:bg-telegram-600 text-white text-sm font-medium rounded-lg shadow-sm shadow-telegram-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Sync'}
          </button>
        </div>
      </div>
    </div>
  );
};
