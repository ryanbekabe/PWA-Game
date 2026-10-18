import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, X, Smartphone, Check } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already installed, hide prompt
  if (isInstalled && !justInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 4000);
    }
  };

  return (
    <>
      {isInstallable && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all ${className}`}
          title="Install game to home screen"
        >
          <Download className="w-4 h-4" />
          <span>Install PWA (HP Android)</span>
        </button>
      )}

      {isIOS && !isInstalled && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 text-slate-200 text-xs font-semibold backdrop-blur-sm active:scale-95 transition-all ${className}`}
          title="Cara Install di iPhone / iOS"
        >
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>Install di iPhone</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 p-6 shadow-2xl text-white">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Pasang Game di iPhone</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Untuk bermain dengan layar penuh dan latensi terendah di iPhone (iOS Safari):
            </p>

            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <span>
                  Ketuk tombol <strong className="text-white">Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 inline text-blue-400" /> di bagian bawah layar Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <span>
                  Gulir ke bawah dan pilih <strong className="text-white">"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-xs">
                  3
                </span>
                <span>
                  Ketuk <strong className="text-white">Tambah (Add)</strong> di pojok kanan atas. Buka game dari ikon CyberPong di layar iPhone Anda!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-500/30 hover:brightness-110 active:scale-95 transition-all"
            >
              Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      )}

      {justInstalled && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xl animate-bounce">
          <Check className="w-4 h-4" />
          <span>CyberPong berhasil dipasang di layar utama!</span>
        </div>
      )}
    </>
  );
};
