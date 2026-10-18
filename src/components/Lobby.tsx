import React, { useState } from 'react';
import type { PlayerRole } from '../types/game';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Tv,
  Smartphone,
  Gamepad2,
  Sparkles,
  Zap,
  ArrowRight,
  Shield,
  Compass,
  QrCode,
  Info,
} from 'lucide-react';

interface LobbyProps {
  onSelectMode: (mode: 'tv' | 'controller' | 'local', roomId: string, role?: PlayerRole) => void;
  defaultRoomId?: string;
  defaultRole?: PlayerRole;
}

export const Lobby: React.FC<LobbyProps> = ({
  onSelectMode,
  defaultRoomId = '',
  defaultRole = 'p1',
}) => {
  const [inputRoomId, setInputRoomId] = useState(defaultRoomId || 'CYBR');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>(defaultRole);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const handleStartTV = () => {
    const code = (inputRoomId.trim() || 'CYBR').toUpperCase();
    onSelectMode('tv', code, 'tv');
  };

  const handleStartController = (role: PlayerRole) => {
    const code = (inputRoomId.trim() || 'CYBR').toUpperCase();
    onSelectMode('controller', code, role);
  };

  const handleStartLocal = () => {
    const code = 'LOCAL_' + Math.floor(Math.random() * 1000);
    onSelectMode('local', code);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#070714] text-white flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Top Navbar with Branding & PWA Install */}
      <header className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-pink-500">
              CYBERPONG ARENA
            </h1>
            <p className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">
              PWA TV &amp; Gesture Mobile Multiplayer
            </p>
          </div>
        </div>

        {/* PWA In-App Install Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Panduan</span>
          </button>
          <PWAInstallButton />
        </div>
      </header>

      {/* Hero & Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 flex flex-col justify-center">
        {/* Title Tagline */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>REAL-TIME WEBSOCKET MULTIPLAYER</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Main Berdua via HP, <br className="hidden sm:inline" />
            Tonton di Layar <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Android TV</span>
          </h2>
          <p className="text-sm md:text-base text-slate-400 mt-3 max-w-xl mx-auto">
            Gunakan HP Android atau iPhone sebagai stik kontroler berbasis gestur swipe &amp; tilt, dan jadikan TV Android sebagai layar arena utama!
          </p>
        </div>

        {/* How to Play Guide Banner */}
        {showHowToPlay && (
          <div className="mb-8 p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-xl animate-in fade-in">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-cyan-400" />
              Cara Menghubungkan TV dan 2 HP:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                <span className="font-bold text-cyan-400 text-sm">Langkah 1: Buka di TV</span>
                <p className="mt-1">
                  Buka browser Android TV Anda, pilih mode <strong className="text-white">"Layar Tontonan Android TV"</strong>. Layar TV akan menampilkan kode Room &amp; QR Code.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                <span className="font-bold text-pink-400 text-sm">Langkah 2: Scan dari HP</span>
                <p className="mt-1">
                  Pemain 1 &amp; 2 scan QR Code di layar TV dengan kamera HP (Android atau iPhone) untuk masuk sebagai Player 1 (Cyan) &amp; Player 2 (Pink).
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                <span className="font-bold text-amber-400 text-sm">Langkah 3: Main dengan Gestur</span>
                <p className="mt-1">
                  Geser layar HP untuk gerak, jentik (flick) ke atas untuk <strong className="text-amber-300">Super Smash</strong>, dan miringkan HP untuk kontrol kemiringan (tilt)!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Room Code Quick Input */}
        <div className="max-w-md mx-auto w-full mb-8 p-3 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-md flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-slate-400 pl-2">KODE ROOM:</span>
          <input
            type="text"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CYBR"
            className="flex-1 bg-transparent text-center font-mono font-black text-xl text-cyan-400 uppercase tracking-widest focus:outline-none"
          />
        </div>

        {/* 3 Main Mode Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Mode 1: Android TV Screen */}
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-indigo-950/60 border border-indigo-500/30 hover:border-indigo-400/60 flex flex-col justify-between transition-all group shadow-xl">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-400/30 group-hover:scale-105 transition-transform">
                <Tv className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
                MODE LAYAR UTAMA
              </span>
              <h3 className="text-xl font-black text-white mt-1">Layar Android TV</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Jadikan layar TV atau monitor besar sebagai arena stadion 16:9 dengan papan skor spektakuler dan suara arcade.
              </p>
            </div>

            <button
              onClick={handleStartTV}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95 transition"
            >
              <span>Buka Layar TV</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mode 2: Phone Gesture Controller */}
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-cyan-950/60 border border-cyan-500/30 hover:border-cyan-400/60 flex flex-col justify-between transition-all group shadow-xl">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 border border-cyan-400/30 group-hover:scale-105 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                HP ANDROID &amp; IPHONE
              </span>
              <h3 className="text-xl font-black text-white mt-1">Kontroler Gestur HP</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Pegang HP Anda sebagai stik virtual. Gunakan sentuhan swipe, flick smash, getaran haptik, dan sensor gerak kemiringan.
              </p>

              {/* Role selection toggle */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('p1')}
                  className={`py-1.5 rounded-lg text-[11px] font-bold border transition ${
                    selectedRole === 'p1'
                      ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400'
                      : 'bg-black/30 text-slate-400 border-white/10'
                  }`}
                >
                  Pemain 1 (Cyan)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('p2')}
                  className={`py-1.5 rounded-lg text-[11px] font-bold border transition ${
                    selectedRole === 'p2'
                      ? 'bg-pink-500/30 text-pink-300 border-pink-400'
                      : 'bg-black/30 text-slate-400 border-white/10'
                  }`}
                >
                  Pemain 2 (Pink)
                </button>
              </div>
            </div>

            <button
              onClick={() => handleStartController(selectedRole)}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition"
            >
              <span>Mulai Kontroler HP</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mode 3: Local Standalone Play (Solo vs AI / 2 Player 1 Screen) */}
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-pink-950/60 border border-pink-500/30 hover:border-pink-400/60 flex flex-col justify-between transition-all group shadow-xl">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-4 border border-pink-400/30 group-hover:scale-105 transition-transform">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-pink-400">
                STANDALONE PLAY
              </span>
              <h3 className="text-xl font-black text-white mt-1">Main di Sini Langsung</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Tidak punya 3 perangkat? Mainkan langsung di HP atau laptop Anda secara mandiri (Solo vs AI atau 2 Pemain 1 Layar).
              </p>
            </div>

            <button
              onClick={handleStartLocal}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-400 hover:to-orange-400 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 active:scale-95 transition"
            >
              <span>Main Lokal / vs AI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="px-5 py-4 border-t border-white/10 bg-black/50 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Server WebSocket Siap (Port 3000) • PWA Offline Ready</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Didukung kontrol gestur swipe &amp; flick, getaran haptik, dan tampilan TV 16:9
        </p>
      </footer>
    </div>
  );
};
