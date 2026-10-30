import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, AlertCircle, RefreshCw, X, RotateCcw } from 'lucide-react';
import { getServerUrl, setServerUrl, resetServerUrl, testServerUrl, DEFAULT_BASE_URL } from '../api/client';

export default function ServerConfigModal({ isOpen, onClose, onSaveUrl }) {
  const [urlInput, setUrlInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, latency?: number, error?: string }

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getServerUrl());
      setTestResult(null);
      setIsTesting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!urlInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testServerUrl(urlInput.trim());
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const clean = urlInput.trim();
    if (!clean) return;
    const finalUrl = setServerUrl(clean);
    onSaveUrl(finalUrl);
    onClose();
  };

  const handleReset = () => {
    resetServerUrl();
    setUrlInput(DEFAULT_BASE_URL);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Backend Server Configuration</h2>
              <p className="text-xs text-gray-400">Configure API endpoint for feeds & streaming</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Server URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder={DEFAULT_BASE_URL || 'https://your-backend-api.vercel.app'}
                className="w-full bg-[#1e293b]/70 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono transition-all"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Default is configured via <code className="text-gray-400">VITE_API_URL</code> environment variable. Legacy <code className="text-gray-400">192.168.100.14</code> addresses are ignored.
            </p>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="flex-1">
                {testResult.success ? (
                  <div>
                    <span className="font-semibold">Connected successfully!</span>
                    <span className="ml-2 text-xs opacity-80">Latency: {testResult.latency}ms</span>
                  </div>
                ) : (
                  <div>
                    <span className="font-semibold">Connection failed:</span>{' '}
                    <span className="text-xs opacity-90">{testResult.error || 'Server unreachable'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleTest}
              disabled={isTesting || !urlInput.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testing Ping...' : 'Test Connection'}
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/60 hover:bg-gray-700 text-gray-400 hover:text-white text-sm font-medium transition-colors"
              title="Reset to default Vercel server"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Default
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800/80 bg-gray-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!urlInput.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
