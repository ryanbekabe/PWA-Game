import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState, GameEventPayload, PowerUpItem } from '../types/game';
import { useWebSocketGame } from '../hooks/useWebSocketGame';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Tv,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Bot,
  Play,
  RotateCcw,
  Sparkles,
  QrCode,
  Smartphone,
  Trophy,
  ArrowLeft,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface TVArenaProps {
  roomId: string;
  onExit: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

export const TVArena: React.FC<TVArenaProps> = ({ roomId, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef<number>(0);
  const flashColorRef = useRef<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [commentary, setCommentary] = useState<string>('MENUNGGU PEMAIN BERGABUNG...');

  const handleGameEvent = useCallback((event: GameEventPayload) => {
    // Screen shake on Smash
    if (event.event === 'super_smash') {
      shakeRef.current = 14;
      setCommentary('⚡ SUPER SMASH DILUNCURKAN!');
      createExplosion(event.x || 500, event.y || 300, '#ffe600', 30);
    } else if (event.event === 'paddle_hit') {
      createExplosion(event.x || 500, event.y || 300, event.player === 'p1' ? '#00f5ff' : '#ff007f', 16);
      shakeRef.current = 4;
    } else if (event.event === 'wall_bounce') {
      createExplosion(event.x || 500, event.y || 300, '#a5b4fc', 8);
    } else if (event.event === 'goal') {
      flashColorRef.current = event.scorer === 'p1' ? 'rgba(0, 245, 255, 0.3)' : 'rgba(255, 0, 127, 0.3)';
      setTimeout(() => (flashColorRef.current = null), 600);
      shakeRef.current = 22;
      setCommentary(`💥 GOOOAL! POIN UNTUK ${event.scorer === 'p1' ? 'PLAYER 1 (CYAN)' : 'PLAYER 2 (PINK)'}!`);
      createExplosion(event.scorer === 'p1' ? 950 : 50, 300, event.scorer === 'p1' ? '#00f5ff' : '#ff007f', 40);
    } else if (event.event === 'powerup_collected') {
      setCommentary(`🌟 POWER-UP DIAMBIL: ${event.powerType?.toUpperCase()}`);
    } else if (event.event === 'gameover') {
      setCommentary(`🏆 JUARA: ${event.player === 'p1' ? 'PLAYER 1 (CYAN)' : 'PLAYER 2 (PINK)'}! SELAMAT!`);
      // Fire celebratory confetti for TV
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
      });
    }
  }, []);

  const {
    gameState,
    isConnected,
    latency,
    statusMessage,
    startGame,
    resetGame,
    pauseGame,
    resumeGame,
    toggleAI,
  } = useWebSocketGame({
    roomId,
    role: 'tv',
    playerName: 'Android TV Arena',
    onEvent: handleGameEvent,
  });

  // Particle explosion helper
  const createExplosion = (x: number, y: number, color: string, count: number = 20) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 1.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02,
      });
    }
  };

  // Fullscreen support (essential for Android TV)
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === ' ') {
        if (gameState?.status === 'playing') pauseGame();
        else if (gameState?.status === 'paused') resumeGame();
        else if (gameState?.status === 'waiting' || gameState?.status === 'gameover') startGame();
      } else if (e.key === 'Enter') {
        if (gameState?.status === 'waiting' || gameState?.status === 'gameover') startGame();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, pauseGame, resumeGame, startGame]);

  // Audio Toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
  };

  // Copy share link
  const copyJoinLink = (role: 'p1' | 'p2' = 'p1') => {
    const url = `${window.location.origin}/?room=${roomId}&role=${role}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Canvas Render Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Handle screen shake
      ctx.save();
      if (shakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * shakeRef.current;
        const shakeY = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(shakeX, shakeY);
        shakeRef.current *= 0.88;
        if (shakeRef.current < 0.4) shakeRef.current = 0;
      }

      // Background - Deep Cyber Obsidian
      ctx.fillStyle = '#080814';
      ctx.fillRect(0, 0, width, height);

      // Arena Glow Grid
      ctx.strokeStyle = 'rgba(40, 50, 95, 0.25)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Flash on goal
      if (flashColorRef.current) {
        ctx.fillStyle = flashColorRef.current;
        ctx.fillRect(0, 0, width, height);
      }

      // Center Divider & Center Circle
      ctx.save();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 20);
      ctx.lineTo(width / 2, height - 20);
      ctx.stroke();

      // Center Ring
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 75, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Stadium Outer Glowing Neon Border
      ctx.save();
      ctx.strokeStyle = '#2d2d5a';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      // Left Goal Glow (P1 Side)
      ctx.fillStyle = 'rgba(0, 245, 255, 0.12)';
      ctx.fillRect(10, 10, 24, height - 20);
      // Right Goal Glow (P2 Side)
      ctx.fillStyle = 'rgba(255, 0, 127, 0.12)';
      ctx.fillRect(width - 34, 10, 24, height - 20);
      ctx.restore();

      if (gameState) {
        // Draw Power-Up items
        for (const pw of gameState.powerups) {
          ctx.save();
          const pulse = Math.sin(Date.now() / 150) * 3;
          ctx.beginPath();
          ctx.arc(pw.x, pw.y, pw.radius + pulse, 0, Math.PI * 2);
          ctx.fillStyle = pw.type === 'mega_smash' ? '#f59e0b' : '#38bdf8';
          ctx.shadowColor = pw.type === 'mega_smash' ? '#f59e0b' : '#38bdf8';
          ctx.shadowBlur = 15;
          ctx.fill();

          // Icon badge inside power-up
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pw.type === 'mega_smash' ? '⚡' : '🛡️', pw.x, pw.y);
          ctx.restore();
        }

        // Draw Player 1 (Cyan Paddle - Left)
        const p1 = gameState.p1;
        const p1CenterY = (p1.y / 100) * height;
        const paddleH = (24 / 100) * height;
        const p1X = (p1.x / 100) * width;

        ctx.save();
        ctx.fillStyle = '#00f5ff';
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur = p1.powerActive ? 30 : 16;
        ctx.beginPath();
        ctx.roundRect(p1X, p1CenterY - paddleH / 2, 18, paddleH, 9);
        ctx.fill();

        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(p1X + 4, p1CenterY - paddleH / 2 + 6, 6, paddleH - 12, 3);
        ctx.fill();
        ctx.restore();

        // Draw Player 2 (Pink Paddle - Right)
        const p2 = gameState.p2;
        const p2CenterY = (p2.y / 100) * height;
        const p2X = (p2.x / 100) * width;

        ctx.save();
        ctx.fillStyle = '#ff007f';
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = p2.powerActive ? 30 : 16;
        ctx.beginPath();
        ctx.roundRect(p2X - 18, p2CenterY - paddleH / 2, 18, paddleH, 9);
        ctx.fill();

        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(p2X - 14, p2CenterY - paddleH / 2 + 6, 6, paddleH - 12, 3);
        ctx.fill();
        ctx.restore();

        // Draw Ball Trail
        const ball = gameState.ball;
        if (ball.trail && ball.trail.length > 0) {
          for (let i = 0; i < ball.trail.length; i++) {
            const pt = ball.trail[i];
            const size = Math.max(2, ball.radius * (1 - i / ball.trail.length));
            ctx.save();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
            ctx.fillStyle = ball.powerType === 'mega_smash'
              ? `rgba(255, 230, 0, ${pt.alpha})`
              : `rgba(0, 245, 255, ${pt.alpha * 0.6})`;
            ctx.fill();
            ctx.restore();
          }
        }

        // Draw Ball
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(
          ball.x - 3,
          ball.y - 3,
          1,
          ball.x,
          ball.y,
          ball.radius
        );
        if (ball.powerType === 'mega_smash') {
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.4, '#ffe600');
          ballGrad.addColorStop(1, '#ff5500');
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 25;
        } else {
          ballGrad.addColorStop(0, '#ffffff');
          ballGrad.addColorStop(0.5, '#7dd3fc');
          ballGrad.addColorStop(1, '#0284c7');
          ctx.shadowColor = '#00f5ff';
          ctx.shadowBlur = 18;
        }
        ctx.fillStyle = ballGrad;
        ctx.fill();
        ctx.restore();
      }

      // Update & Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore(); // restore shake

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  const p1 = gameState?.p1;
  const p2 = gameState?.p2;
  const bothConnected = p1?.connected && (p2?.connected || p2?.isAI);

  const joinUrlP1 = typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomId}&role=p1` : '';
  const joinUrlP2 = typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomId}&role=p2` : '';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] flex flex-col bg-[#05050f] text-white select-none overflow-hidden"
    >
      {/* Top TV Scoreboard & Broadcast Banner */}
      <header className="px-6 py-4 flex items-center justify-between bg-black/60 backdrop-blur-md border-b border-white/10 z-20">
        {/* Left: TV Arena Brand & Room Code */}
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
            title="Kembali ke Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-200 to-pink-500">
                CYBERPONG ARENA
              </h1>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>ANDROID TV BROADCAST</span>
                <span>•</span>
                <span className="text-cyan-400 font-bold">KODE ROOM: {roomId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Holographic Match Scoreboard */}
        <div className="flex items-center gap-6 px-8 py-2 rounded-2xl bg-black/80 border border-white/15 shadow-2xl shadow-cyan-500/10">
          {/* Player 1 Details */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-xs font-black tracking-wider uppercase text-cyan-400">
                {p1?.name || 'PLAYER 1'}
              </p>
              <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
                <span className={`w-2 h-2 rounded-full ${p1?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span>{p1?.connected ? 'HP Terhubung' : 'Belum Konek'}</span>
              </div>
            </div>
            <span className="text-4xl font-mono font-black text-cyan-400 tracking-tight">
              {p1?.score ?? 0}
            </span>
          </div>

          <span className="text-2xl font-black text-slate-600">:</span>

          {/* Player 2 Details */}
          <div className="flex items-center gap-3 text-left">
            <span className="text-4xl font-mono font-black text-pink-400 tracking-tight">
              {p2?.score ?? 0}
            </span>
            <div>
              <p className="text-xs font-black tracking-wider uppercase text-pink-400">
                {p2?.name || (p2?.isAI ? 'CYBER AI BOT' : 'PLAYER 2')}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className={`w-2 h-2 rounded-full ${p2?.connected || p2?.isAI ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span>{p2?.isAI ? 'AI Aktif' : p2?.connected ? 'HP Terhubung' : 'Belum Konek'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right TV Utilities */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold transition shadow-lg shadow-cyan-500/10"
          >
            <QrCode className="w-4 h-4" />
            <span>QR Scan HP</span>
          </button>

          <button
            onClick={toggleAI}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition ${
              p2?.isAI
                ? 'bg-purple-600/30 border-purple-400/50 text-purple-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title="Aktifkan AI Bot untuk Player 2"
          >
            <Bot className="w-4 h-4" />
            <span>{p2?.isAI ? 'Bot P2: ON' : 'Lawan AI Bot'}</span>
          </button>

          <button
            onClick={toggleSound}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition"
            title="Layar Penuh TV (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Stadium Canvas */}
      <div className="relative flex-1 flex items-center justify-center p-3 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="w-full h-full max-w-[1400px] max-h-[840px] aspect-[16/9] object-contain rounded-2xl shadow-2xl border border-indigo-500/30"
        />

        {/* Big Countdown Overlay */}
        {gameState?.status === 'countdown' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30 animate-in fade-in">
            <span className="text-9xl font-mono font-black text-amber-300 animate-ping">
              {gameState.countdown}
            </span>
            <p className="mt-4 text-lg font-black tracking-widest text-cyan-300 uppercase">
              SIAP-SIAP BERTANDING!
            </p>
          </div>
        )}

        {/* Game Paused Overlay */}
        {gameState?.status === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md z-30">
            <div className="p-8 rounded-3xl bg-slate-900/90 border border-indigo-500/40 text-center max-w-md shadow-2xl">
              <h2 className="text-3xl font-black text-white mb-2">GAME DIJEDA</h2>
              <p className="text-sm text-slate-300 mb-6">Tekan tombol Resume atau tekan Spasi untuk melanjutkan.</p>
              <button
                onClick={resumeGame}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition"
              >
                Lanjutkan Pertandingan
              </button>
            </div>
          </div>
        )}

        {/* Match Waiting Room / Join Prompt Banner */}
        {gameState?.status === 'waiting' && !bothConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md z-30 p-6">
            <div className="max-w-2xl w-full p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 text-center shadow-2xl">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400">
                  <Smartphone className="w-8 h-8" />
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white tracking-wide">
                HUBUNGKAN HP ANDROID / IPHONE
              </h2>
              <p className="text-sm text-slate-300 mt-2 mb-6">
                Scan kode QR menggunakan kamera HP untuk mengontrol paddle via gestur swipe &amp; tilt secara real-time!
              </p>

              {/* Two QR Codes for P1 & P2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
                {/* P1 Join Box */}
                <div className="flex flex-col items-center p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40">
                  <span className="text-xs font-black uppercase text-cyan-400 mb-2">
                    PLAYER 1 (CYAN)
                  </span>
                  <div className="p-3 bg-white rounded-xl shadow-lg">
                    <QRCodeSVG value={joinUrlP1} size={130} />
                  </div>
                  <span className={`mt-3 text-xs font-semibold ${p1?.connected ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {p1?.connected ? '✅ Player 1 Terhubung!' : 'Menunggu Scan HP P1...'}
                  </span>
                </div>

                {/* P2 Join Box */}
                <div className="flex flex-col items-center p-4 rounded-2xl bg-pink-950/40 border border-pink-500/40">
                  <span className="text-xs font-black uppercase text-pink-400 mb-2">
                    PLAYER 2 (PINK)
                  </span>
                  <div className="p-3 bg-white rounded-xl shadow-lg">
                    <QRCodeSVG value={joinUrlP2} size={130} />
                  </div>
                  <span className={`mt-3 text-xs font-semibold ${p2?.connected || p2?.isAI ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {p2?.isAI ? '🤖 Cyber AI Bot Aktif' : p2?.connected ? '✅ Player 2 Terhubung!' : 'Menunggu Scan HP P2...'}
                  </span>
                </div>
              </div>

              {/* Instant Play vs AI button */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  onClick={toggleAI}
                  className="px-5 py-2.5 rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/40 text-purple-200 text-xs font-bold transition"
                >
                  {p2?.isAI ? 'Nonaktifkan AI' : 'Bermain Sendiri (Lawan Bot AI)'}
                </button>
                <button
                  onClick={startGame}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition active:scale-95"
                >
                  Mulai Pertandingan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Victory Overlay */}
        {gameState?.status === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-30 p-6 animate-in zoom-in-95 duration-200">
            <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/95 border-2 border-amber-400/60 text-center shadow-2xl shadow-amber-500/20">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 animate-bounce">
                  <Trophy className="w-12 h-12" />
                </div>
              </div>

              <h2 className="text-xs font-black uppercase tracking-widest text-amber-400">
                PERTANDINGAN SELESAI
              </h2>
              <h3 className="text-3xl font-black text-white mt-1">
                {gameState.winner === 'p1' ? 'PLAYER 1 (CYAN) MENANG!' : 'PLAYER 2 (PINK) MENANG!'}
              </h3>

              <div className="my-6 p-4 rounded-2xl bg-black/50 border border-white/10 flex justify-around text-center">
                <div>
                  <span className="text-xs text-slate-400">Skor Akhir</span>
                  <p className="text-2xl font-mono font-black text-cyan-400">
                    {p1?.score} : {p2?.score}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Rally Tertinggi</span>
                  <p className="text-2xl font-mono font-black text-amber-400">
                    {gameState.stats.highestRally}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Kecepatan Max</span>
                  <p className="text-2xl font-mono font-black text-pink-400">
                    {gameState.stats.maxSpeed}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={resetGame}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-bold text-xs uppercase tracking-wider text-white transition active:scale-95"
                >
                  Menu Utama
                </button>
                <button
                  onClick={startGame}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 font-black text-xs uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/30 transition active:scale-95"
                >
                  Tanding Ulang (Rematch)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Live Commentary Marquee & Match Stats */}
      <footer className="px-6 py-3 flex items-center justify-between bg-black/70 border-t border-white/10 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-black uppercase">
            LIVE BROADCAST
          </span>
          <p className="text-xs font-mono font-semibold text-slate-200">
            {commentary}
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
          <div>
            RALLY: <span className="font-bold text-white">{gameState?.stats?.rallies ?? 0}</span>
          </div>
          <div>
            TOP SPEED: <span className="font-bold text-cyan-400">{gameState?.stats?.maxSpeed ?? 0}</span>
          </div>
          <div>
            TARGET: <span className="font-bold text-amber-400">{gameState?.targetScore ?? 7} GOALS</span>
          </div>
        </div>
      </footer>

      {/* QR Code Modal for Android TV */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-cyan-500/40 text-center shadow-2xl">
            <h3 className="text-xl font-black text-white">Scan untuk Main via HP</h3>
            <p className="text-xs text-slate-300 mt-1 mb-6">
              Arahkan kamera HP Android atau iPhone Anda ke kode QR berikut:
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex flex-col items-center">
                <span className="text-[11px] font-black text-cyan-400 mb-2">PLAYER 1</span>
                <div className="p-2 bg-white rounded-xl">
                  <QRCodeSVG value={joinUrlP1} size={110} />
                </div>
                <button
                  onClick={() => copyJoinLink('p1')}
                  className="mt-2 text-[10px] text-cyan-300 flex items-center gap-1 hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  Salin Link
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-pink-950/40 border border-pink-500/40 flex flex-col items-center">
                <span className="text-[11px] font-black text-pink-400 mb-2">PLAYER 2</span>
                <div className="p-2 bg-white rounded-xl">
                  <QRCodeSVG value={joinUrlP2} size={110} />
                </div>
                <button
                  onClick={() => copyJoinLink('p2')}
                  className="mt-2 text-[10px] text-pink-300 flex items-center gap-1 hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  Salin Link
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              Tutup Modal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
