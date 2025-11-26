
import React, { useState } from 'react';
import { Download, X, Loader2, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { AppConfig, TelegramUpdate, TelegramMessage } from '../types';
import { importFile } from '../services/telegramService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onImportComplete: (newFiles: TelegramUpdate[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, config, onImportComplete }) => {
  const [input, setInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseMessageId = (input: string): number | null => {
    // Handle full URLs: https://t.me/c/123456789/1024
    if (input.includes('t.me/')) {
      const parts = input.split('/');
      const id = parseInt(parts[parts.length - 1]);
      return isNaN(id) ? null : id;
    }
    // Handle simple ID
    const id = parseInt(input);
    return isNaN(id) ? null : id;
  };

  const handleImport = async () => {
    setIsImporting(true);
    setStatus(null);
    
    const importedUpdates: TelegramUpdate[] = [];
    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;

    const inputs = input.split(',').map(s => s.trim()).filter(Boolean);
    
    // Basic range support: "100-105"
    const finalIds: number[] = [];
    
    for (const item of inputs) {
        if (item.includes('-')) {
            const [start, end] = item.split('-').map(n => parseInt(n.trim()));
            if (!isNaN(start) && !isNaN(end) && end >= start && (end - start) < 50) { // Limit range to 50
                for (let i = start; i <= end; i++) finalIds.push(i);
            }
        } else {
            const id = parseMessageId(item);
            if (id) finalIds.push(id);
        }
    }

    if (finalIds.length === 0) {
        setStatus('Invalid input. Please enter Message IDs or Links.');
        setIsImporting(false);
        return;
    }
    
    if (finalIds.length > 20) {
        setStatus(`Too many messages selected (${finalIds.length}). Max 20 at a time.`);
        setIsImporting(false);
        return;
    }

    setStatus(`Processing ${finalIds.length} messages...`);

    for (const id of finalIds) {
        const msg = await importFile(config, id);
        if (msg && (msg.document || msg.photo)) {
            if(msg.is_duplicate) {
              duplicateCount++;
              continue;
            }
            // Map to Update structure
            importedUpdates.push({
                update_id: Date.now() + id, // Synthetic ID
                [msg.chat.type === 'channel' ? 'channel_post' : 'message']: msg
            });
            successCount++;
        } else {
            failCount++;
        }
        // Small delay to avoid hitting API limits too hard
        await new Promise(r => setTimeout(r, 300));
    }

    if (successCount > 0) {
        onImportComplete(importedUpdates);
        let addStr = "";
        if(failCount > 0 || duplicateCount > 0){
          addStr += "(";
          if(failCount > 0) {
            addStr += `${failCount} failed/skipped`;
          }
          if(duplicateCount > 0) {
            if(failCount > 0) addStr += ", ";
            addStr += `${duplicateCount} duplicated`;
          }
          addStr += ")";
        }
        setStatus(`Successfully imported ${successCount} files. ${addStr}`);
        setTimeout(() => {
            onClose();
            setInput('');
            setStatus(null);
        }, 1500);
    } else {
        setStatus(`Failed to import. Found ${failCount} invalid or empty messages. Found ${duplicateCount} duplicated data`);
    }
    
    setIsImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-800">
            <Download className="w-5 h-5 text-telegram-500" />
            <h2 className="font-semibold text-lg">Import Existing Files</h2>
          </div>
          <button onClick={onClose} disabled={isImporting} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 flex gap-2">
             <AlertCircle className="w-5 h-5 shrink-0" />
             <p>
                Bot API cannot scan history. To add existing files, enter their <strong>Message Link</strong> or <strong>ID</strong>.
                <br/>
                <span className="text-xs opacity-75 mt-1 block">Tip: Right click a message in Telegram &gt; Copy Link.</span>
             </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Message Link(s) or ID(s)</label>
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. https://t.me/c/123456/101, 102, 105-110"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-telegram-500 focus:ring-2 focus:ring-telegram-100 outline-none text-sm min-h-[100px]"
                disabled={isImporting}
            />
            <p className="text-xs text-slate-500 mt-2">Separate multiple IDs with commas. Use '100-110' for ranges.</p>
          </div>

          {status && (
            <div className={`text-sm p-2 rounded ${status.includes('Success') ? 'text-green-600 bg-green-50' : 'text-slate-600 bg-slate-100'}`}>
                {status}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || !input.trim()}
            className="px-6 py-2 bg-telegram-500 hover:bg-telegram-600 text-white text-sm font-medium rounded-lg shadow-sm shadow-telegram-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            <span>Import Files</span>
          </button>
        </div>
      </div>
    </div>
  );
};
