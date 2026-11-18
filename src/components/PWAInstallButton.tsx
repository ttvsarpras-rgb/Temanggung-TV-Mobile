import React, { useState } from 'react';
import { Download, Tv, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="tv-focusable min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
      >
        <Download className="w-4 h-4 text-[#D82425] shrink-0" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="tv-focusable min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
        >
          <Tv className="w-4 h-4 text-[#D82425] shrink-0" />
          <span>Pasang di Layar Utama</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Pasang Temanggung TV</h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Tutup panduan"
                  className="tv-focusable min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-2.5 text-sm text-slate-700 leading-relaxed list-decimal list-inside">
                <li>Ketuk tombol <strong>Bagikan (Share)</strong> di Safari.</li>
                <li>Pilih <strong>Tambahkan ke Layar Utama</strong>.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="tv-focusable w-full min-h-[44px] rounded-xl bg-[#D82425] text-sm font-semibold text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
