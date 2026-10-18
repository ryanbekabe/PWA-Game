import React, { useRef, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Bot,
  RotateCcw,
  Trophy,
  Zap,
  Play,
  Flame,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface LocalArenaProps {
  onExit: () => void;
}

export const LocalArena: React.FC<LocalArenaProps> = ({ onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [isAI, setIsAI] = useState(true);
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'gameover'>('countdown');
  const [winner, setWinner] = useState<'p1' | 'p2' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [rallies, setRallies] = useState(0);

  // Paddles & Ball positions (standard 1000x600 arena)
  const p1YRef = useRef(300);
  const p2YRef = useRef(300);
  const ballRef = useRef({
    x: 500,
    y: 300,
    vx: 7.5,
    vy: 2.0,
    speed: 7.5,
    radius: 12,
    trail: [] as Array<{ x: number; y: number; alpha: number }>,
  });
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; color: string; alpha: number }>>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
  };

  const startNewGame = useCallback(() => {
    setP1Score(0);
    setP2Score(0);
    setWinner(null);
    setRallies(0);
    setCountdown(3);
    setGameState('countdown');
    p1YRef.current = 300;
    p2YRef.current = 300;
    ballRef.current = {
      x: 500,
      y: 300,
      vx: Math.random() > 0.5 ? 7.5 : -7.5,
      vy: Math.random() * 4 - 2,
      speed: 7.5,
      radius: 12,
      trail: [],
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'countdown') return;

    sound.playCountdownBeep(countdown === 1);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('playing');
          return 0;
        }
        sound.playCountdownBeep(prev - 1 === 1);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, countdown]);

  // Keyboard and Touch listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Game Animation & Physics Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ARENA_W = 1000;
    const ARENA_H = 600;
    const PADDLE_H = 140;
    const PADDLE_W = 18;

    const render = () => {
      // 1. Process Keyboard / AI inputs
      if (gameState === 'playing') {
        // Player 1 controls (W/S)
        if (keysRef.current['w']) p1YRef.current = Math.max(PADDLE_H / 2, p1YRef.current - 7);
        if (keysRef.current['s']) p1YRef.current = Math.min(ARENA_H - PADDLE_H / 2, p1YRef.current + 7);

        // Player 2 controls (Up/Down or AI)
        if (isAI) {
          const diff = ballRef.current.y - p2YRef.current;
          if (Math.abs(diff) > 4) {
            p2YRef.current += Math.sign(diff) * (ballRef.current.vx > 0 ? 4.8 : 2.5);
            p2YRef.current = Math.max(PADDLE_H / 2, Math.min(ARENA_H - PADDLE_H / 2, p2YRef.current));
          }
        } else {
          if (keysRef.current['arrowup']) p2YRef.current = Math.max(PADDLE_H / 2, p2YRef.current - 7);
          if (keysRef.current['arrowdown']) p2YRef.current = Math.min(ARENA_H - PADDLE_H / 2, p2YRef.current + 7);
        }

        // 2. Physics & Ball Motion
        const ball = ballRef.current;
        ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 1.0 });
        if (ball.trail.length > 7) ball.trail.pop();
        for (const pt of ball.trail) pt.alpha *= 0.82;

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Top / Bottom wall bounce
        if (ball.y - ball.radius <= 0) {
          ball.y = ball.radius;
          ball.vy = -ball.vy;
          sound.playWallBounce();
        } else if (ball.y + ball.radius >= ARENA_H) {
          ball.y = ARENA_H - ball.radius;
          ball.vy = -ball.vy;
          sound.playWallBounce();
        }

        // P1 Collision (Left)
        if (
          ball.vx < 0 &&
          ball.x - ball.radius <= 40 + PADDLE_W &&
          ball.x + ball.radius >= 40 &&
          ball.y + ball.radius >= p1YRef.current - PADDLE_H / 2 &&
          ball.y - ball.radius <= p1YRef.current + PADDLE_H / 2
        ) {
          ball.x = 40 + PADDLE_W + ball.radius;
          const intersect = (ball.y - p1YRef.current) / (PADDLE_H / 2);
          const angle = intersect * (Math.PI / 3.4);
          ball.speed = Math.min(16, ball.speed + 0.4);
          ball.vx = Math.abs(ball.speed * Math.cos(angle));
          ball.vy = ball.speed * Math.sin(angle);
          sound.playPaddleHit(true);
          setRallies((r) => r + 1);
        }

        // P2 Collision (Right)
        if (
          ball.vx > 0 &&
          ball.x + ball.radius >= ARENA_W - 40 - PADDLE_W &&
          ball.x - ball.radius <= ARENA_W - 40 &&
          ball.y + ball.radius >= p2YRef.current - PADDLE_H / 2 &&
          ball.y - ball.radius <= p2YRef.current + PADDLE_H / 2
        ) {
          ball.x = ARENA_W - 40 - PADDLE_W - ball.radius;
          const intersect = (ball.y - p2YRef.current) / (PADDLE_H / 2);
          const angle = intersect * (Math.PI / 3.4);
          ball.speed = Math.min(16, ball.speed + 0.4);
          ball.vx = -Math.abs(ball.speed * Math.cos(angle));
          ball.vy = ball.speed * Math.sin(angle);
          sound.playPaddleHit(false);
          setRallies((r) => r + 1);
        }

        // Goal Check
        if (ball.x < 0) {
          sound.playGoalCelebration();
          setP2Score((s) => {
            const next = s + 1;
            if (next >= 5) {
              setWinner('p2');
              setGameState('gameover');
              sound.playVictoryFanfare();
              confetti({ particleCount: 100, spread: 80 });
            } else {
              // reset ball
              ball.x = 500;
              ball.y = 300;
              ball.speed = 7.5;
              ball.vx = 7.5;
              ball.vy = (Math.random() * 4 - 2);
            }
            return next;
          });
        } else if (ball.x > ARENA_W) {
          sound.playGoalCelebration();
          setP1Score((s) => {
            const next = s + 1;
            if (next >= 5) {
              setWinner('p1');
              setGameState('gameover');
              sound.playVictoryFanfare();
              confetti({ particleCount: 100, spread: 80 });
            } else {
              ball.x = 500;
              ball.y = 300;
              ball.speed = 7.5;
              ball.vx = -7.5;
              ball.vy = (Math.random() * 4 - 2);
            }
            return next;
          });
        }
      }

      // 3. Render Canvas
      ctx.fillStyle = '#090918';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Grid
      ctx.strokeStyle = 'rgba(50, 60, 110, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x < ARENA_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARENA_H);
        ctx.stroke();
      }
      for (let y = 0; y < ARENA_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_W, y);
        ctx.stroke();
      }

      // Center Line
      ctx.save();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(ARENA_W / 2, 20);
      ctx.lineTo(ARENA_W / 2, ARENA_H - 20);
      ctx.stroke();
      ctx.restore();

      // Border
      ctx.strokeStyle = '#2b2b52';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, ARENA_W - 16, ARENA_H - 16);

      // P1 Paddle (Cyan)
      ctx.save();
      ctx.fillStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(40, p1YRef.current - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8);
      ctx.fill();
      ctx.restore();

      // P2 Paddle (Pink)
      ctx.save();
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(ARENA_W - 40 - PADDLE_W, p2YRef.current - PADDLE_H / 2, PADDLE_W, PADDLE_H, 8);
      ctx.fill();
      ctx.restore();

      // Ball Trail
      const ball = ballRef.current;
      for (const pt of ball.trail) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.radius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 245, 255, ${pt.alpha * 0.5})`;
        ctx.fill();
      }

      // Ball
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, isAI]);

  // Touch control for canvas on mobile/tablets
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const relX = t.clientX - rect.left;
      const relY = t.clientY - rect.top;
      const mappedY = (relY / rect.height) * 600;

      if (relX < rect.width / 2) {
        p1YRef.current = Math.max(70, Math.min(530, mappedY));
      } else if (!isAI) {
        p2YRef.current = Math.max(70, Math.min(530, mappedY));
      }
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-[#060612] text-white select-none overflow-hidden">
      {/* Header */}
      <header className="px-5 py-3 flex items-center justify-between bg-black/60 border-b border-white/10 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-cyan-400">CYBERPONG LOKAL / SOLO</h2>
            <p className="text-[10px] text-slate-400">Kontrol: Tombol W/S atau Geser Sentuhan Layar</p>
          </div>
        </div>

        {/* Score Board */}
        <div className="flex items-center gap-4 px-6 py-1.5 rounded-xl bg-black/80 border border-white/10 text-xl font-mono font-black">
          <span className="text-cyan-400">{p1Score}</span>
          <span className="text-slate-600">:</span>
          <span className="text-pink-400">{p2Score}</span>
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAI(!isAI)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
              isAI ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{isAI ? 'Lawan AI Bot' : '2 Pemain'}</span>
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Arena Canvas with Touch Handler */}
      <div
        onTouchMove={handleTouchMove}
        className="relative flex-1 flex items-center justify-center p-3 touch-none"
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          className="w-full h-full max-w-[1200px] max-h-[720px] aspect-[16/9] object-contain rounded-2xl border border-indigo-500/40 shadow-2xl"
        />

        {/* Countdown Overlay */}
        {gameState === 'countdown' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 animate-in fade-in">
            <span className="text-9xl font-mono font-black text-amber-300 animate-ping">
              {countdown}
            </span>
          </div>
        )}

        {/* Game Over */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-4">
            <div className="max-w-sm w-full p-6 rounded-3xl bg-slate-900 border border-amber-400/50 text-center shadow-2xl">
              <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h3 className="text-2xl font-black text-white">
                {winner === 'p1' ? 'PLAYER 1 (CYAN) MENANG!' : 'PLAYER 2 (PINK) MENANG!'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 mb-6">Skor Akhir: {p1Score} - {p2Score}</p>
              <button
                onClick={startNewGame}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider"
              >
                Main Lagi
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls guide */}
      <footer className="px-5 py-2.5 bg-black/50 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
        <span>P1: W/S atau sentuh sisi kiri layar</span>
        <span>P2: Panah Atas/Bawah atau sentuh sisi kanan layar</span>
      </footer>
    </div>
  );
};
