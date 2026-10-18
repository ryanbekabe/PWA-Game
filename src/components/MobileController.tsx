import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { GameState, PlayerRole, GameEventPayload } from '../types/game';
import { useWebSocketGame } from '../hooks/useWebSocketGame';
import {
  Zap,
  Compass,
  ArrowLeft,
  Volume2,
  VolumeX,
  Wifi,
  Sparkles,
  Flame,
  Activity,
  Hand,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface MobileControllerProps {
  roomId: string;
  initialRole?: PlayerRole;
  onExit: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
  id: number;
}

export const MobileController: React.FC<MobileControllerProps> = ({
  roomId,
  initialRole = 'p1',
  onExit,
}) => {
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastGestureText, setLastGestureText] = useState<string | null>(null);
  const [gestureTrail, setGestureTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const padRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const lastTouchRef = useRef<TouchPoint | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const currentYPercentRef = useRef<number>(50);

  // Handle incoming events like haptics
  const handleGameEvent = useCallback((event: GameEventPayload) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (event.event === 'paddle_hit') {
        navigator.vibrate?.([30]);
      } else if (event.event === 'super_smash') {
        navigator.vibrate?.([60, 40, 100]);
      } else if (event.event === 'goal') {
        navigator.vibrate?.([100, 50, 100, 50, 150]);
      }
    }

    if (event.event === 'super_smash') {
      setLastGestureText('⚡ SUPER SMASH AKTIF!');
      setTimeout(() => setLastGestureText(null), 1800);
    }
  }, []);

  const {
    gameState,
    assignedRole,
    isConnected,
    latency,
    statusMessage,
    sendControllerInput,
    activatePower,
  } = useWebSocketGame({
    roomId,
    role: initialRole,
    playerName: initialRole === 'p2' ? 'Pemain 2 (Pink)' : 'Pemain 1 (Cyan)',
    onEvent: handleGameEvent,
  });

  const isP1 = assignedRole === 'p1';
  const player = isP1 ? gameState?.p1 : gameState?.p2;
  const opponent = isP1 ? gameState?.p2 : gameState?.p1;
  const energy = player?.energy ?? 0;
  const canSuperSmash = energy >= 80;

  // Toggle Sound
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.enabled = next;
  };

  // Device Orientation (Tilt)
  const enableTiltControl = async () => {
    if (tiltEnabled) {
      setTiltEnabled(false);
      return;
    }

    // iOS 13+ permission check
    const DeviceOrientationEventAny = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientationEventAny?.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEventAny.requestPermission();
        if (response === 'granted') {
          setTiltEnabled(true);
        } else {
          alert('Izin sensor gerak tidak diberikan.');
        }
      } catch (err) {
        console.error('Error requesting motion permission:', err);
      }
    } else {
      setTiltEnabled(true);
    }
  };

  useEffect(() => {
    if (!tiltEnabled) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Gamma is left-to-right tilt in degrees (-90 to 90)
      // Beta is front-to-back tilt in degrees (-180 to 180)
      const beta = e.beta || 0; // standard portrait tilt
      // Map beta (typically held between 20 deg and 70 deg) to 10% - 90%
      const targetPercent = Math.max(10, Math.min(90, ((beta - 20) / 50) * 80 + 10));

      const now = Date.now();
      if (now - lastSendTimeRef.current > 25) {
        lastSendTimeRef.current = now;
        currentYPercentRef.current = targetPercent;
        sendControllerInput(targetPercent, 0, 'tilt', beta, e.gamma || 0);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [tiltEnabled, sendControllerInput]);

  // Touch & Gesture Tracking
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const pad = padRef.current;
    if (!pad) return;

    const rect = pad.getBoundingClientRect();
    const touchY = touch.clientY - rect.top;
    const touchX = touch.clientX - rect.left;
    const yPercent = Math.max(10, Math.min(90, (touchY / rect.height) * 100));

    touchStartRef.current = {
      x: touchX,
      y: touchY,
      time: Date.now(),
      id: touch.identifier,
    };
    lastTouchRef.current = touchStartRef.current;
    currentYPercentRef.current = yPercent;

    sendControllerInput(yPercent, 0);

    // Trail particle
    setGestureTrail((prev) => [...prev.slice(-12), { x: touchX, y: touchY, id: Date.now() }]);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const pad = padRef.current;
    if (!pad) return;

    const rect = pad.getBoundingClientRect();
    const touchY = touch.clientY - rect.top;
    const touchX = touch.clientX - rect.left;
    const yPercent = Math.max(10, Math.min(90, (touchY / rect.height) * 100));
    const now = Date.now();

    let vy = 0;
    if (lastTouchRef.current) {
      const dt = Math.max(1, now - lastTouchRef.current.time);
      vy = ((touchY - lastTouchRef.current.y) / dt) * 10;
    }

    lastTouchRef.current = {
      x: touchX,
      y: touchY,
      time: now,
      id: touch.identifier,
    };
    currentYPercentRef.current = yPercent;

    // Send high-rate input (~40Hz)
    if (now - lastSendTimeRef.current > 20) {
      lastSendTimeRef.current = now;
      sendControllerInput(yPercent, vy);
    }

    // Add to visual trail
    setGestureTrail((prev) => [...prev.slice(-14), { x: touchX, y: touchY, id: Date.now() }]);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || !lastTouchRef.current) return;
    const start = touchStartRef.current;
    const last = lastTouchRef.current;
    const dt = Math.max(1, Date.now() - start.time);
    const dx = last.x - start.x;
    const dy = last.y - start.y;
    const velocity = Math.hypot(dx, dy) / dt;

    // Flick Gesture Detection
    if (velocity > 0.65) {
      if (dy < -60) {
        // Fast upward swipe -> Power Smash!
        setLastGestureText('🚀 POWER FLICK SMASH!');
        sendControllerInput(currentYPercentRef.current, -10, 'flick_up');
        if (navigator.vibrate) navigator.vibrate([40]);
      } else if (dy > 60) {
        // Fast downward swipe -> Low Spin!
        setLastGestureText('⚡ DOWN SLICE!');
        sendControllerInput(currentYPercentRef.current, 10, 'flick_down');
        if (navigator.vibrate) navigator.vibrate([40]);
      } else if (dx > 50) {
        // Fast curve right
        setLastGestureText('🌀 CURVE KANAN!');
        sendControllerInput(currentYPercentRef.current, 0, 'curve_right');
        if (navigator.vibrate) navigator.vibrate([30]);
      } else if (dx < -50) {
        // Fast curve left
        setLastGestureText('🌀 CURVE KIRI!');
        sendControllerInput(currentYPercentRef.current, 0, 'curve_left');
        if (navigator.vibrate) navigator.vibrate([30]);
      }
      setTimeout(() => setLastGestureText(null), 1500);
    }

    touchStartRef.current = null;
    lastTouchRef.current = null;
    setTimeout(() => setGestureTrail([]), 400);
  };

  const triggerSuperSmash = () => {
    if (!canSuperSmash) return;
    activatePower('mega_smash');
    setLastGestureText('💥 SUPER SMASH DIAKTIFKAN!');
    if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
    setTimeout(() => setLastGestureText(null), 1800);
  };

  // Color theme based on Player 1 (Cyan) or Player 2 (Pink)
  const theme = isP1
    ? {
        border: 'border-cyan-500/40',
        glow: 'shadow-cyan-500/30',
        bg: 'from-cyan-950/40 via-slate-900 to-black',
        paddleBg: 'bg-cyan-400',
        accentText: 'text-cyan-400',
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
        btnGrad: 'from-cyan-500 to-blue-600',
        trailColor: '#00f5ff',
      }
    : {
        border: 'border-pink-500/40',
        glow: 'shadow-pink-500/30',
        bg: 'from-pink-950/40 via-slate-900 to-black',
        paddleBg: 'bg-pink-500',
        accentText: 'text-pink-400',
        badge: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
        btnGrad: 'from-pink-500 to-orange-600',
        trailColor: '#ff007f',
      };

  return (
    <div className={`relative w-full h-[100dvh] flex flex-col bg-gradient-to-b ${theme.bg} text-white select-none overflow-hidden touch-none`}>
      {/* Top Header & Match Status */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 active:scale-95 transition"
            title="Keluar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${theme.badge}`}>
                {isP1 ? 'PLAYER 1 (CYAN)' : 'PLAYER 2 (PINK)'}
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">
                ROOM: <strong className="text-white">{roomId}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Live Score & Ping */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-xs font-mono">
            <span className="text-cyan-400 font-bold">{gameState?.p1?.score ?? 0}</span>
            <span className="text-slate-500">:</span>
            <span className="text-pink-400 font-bold">{gameState?.p2?.score ?? 0}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
            <Wifi className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400' : 'text-rose-500 animate-pulse'}`} />
            <span>{latency > 0 ? `${latency}ms` : '--'}</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Touch & Gesture Arena Pad */}
      <div
        ref={padRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative flex-1 m-3 rounded-2xl border-2 ${theme.border} bg-slate-950/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between p-4 cursor-grab active:cursor-grabbing shadow-2xl ${theme.glow}`}
      >
        {/* Dynamic Gesture Trail Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {gestureTrail.map((pt, i) => (
            <circle
              key={pt.id}
              cx={pt.x}
              cy={pt.y}
              r={12 - (gestureTrail.length - i) * 0.7}
              fill={theme.trailColor}
              opacity={(i + 1) / gestureTrail.length * 0.7}
            />
          ))}
          {gestureTrail.length > 1 && (
            <polyline
              points={gestureTrail.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={theme.trailColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          )}
        </svg>

        {/* Visual Simulated Paddle Slider Indicator */}
        <div
          className="absolute left-2 w-3 rounded-full transition-all duration-75 pointer-events-none z-20"
          style={{
            top: `${player?.y ?? 50}%`,
            height: '24%',
            transform: 'translateY(-50%)',
            boxShadow: isP1 ? '0 0 15px #00f5ff' : '0 0 15px #ff007f',
            backgroundColor: isP1 ? '#00f5ff' : '#ff007f',
          }}
        />

        {/* Touchpad Guide Watermarks */}
        <div className="pointer-events-none flex flex-col items-center justify-center text-center my-auto opacity-35 z-0 space-y-3">
          <Hand className="w-12 h-12 text-slate-300 animate-pulse" />
          <div>
            <p className="text-sm font-bold tracking-wider uppercase text-white">AREA KONTROL GESTUR</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Geser jari ke atas/bawah untuk mengarahkan paddle. Jentik (Flick) cepat untuk Smash &amp; Spin!
            </p>
          </div>
        </div>

        {/* Floating Real-time Action Announcement */}
        {lastGestureText && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-black/90 border border-amber-400/80 text-amber-300 text-xs font-black tracking-widest uppercase shadow-2xl animate-in zoom-in-95 duration-150">
            {lastGestureText}
          </div>
        )}

        {/* Opponent & Court Information */}
        <div className="flex justify-between items-end text-xs text-slate-400 font-mono z-20 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Status: <strong className="text-white">{gameState?.status?.toUpperCase() ?? 'SYNCING'}</strong></span>
          </div>
          <div>
            Lawan: <span className="font-bold text-slate-200">{opponent?.name || 'Menunggu Lawan'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Tactical Controls & Power Bar */}
      <footer className="px-4 py-3 bg-black/70 border-t border-white/10 backdrop-blur-md flex flex-col gap-2.5 z-30">
        {/* Energy Bar & Power Button */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="w-3 h-3" />
                POWER GAUGE
              </span>
              <span className={`font-bold ${canSuperSmash ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`}>
                {Math.round(energy)}%
              </span>
            </div>
            {/* Energy progress track */}
            <div className="w-full h-3 rounded-full bg-slate-800 border border-white/10 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  canSuperSmash
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 shadow-lg shadow-amber-500/50 animate-pulse'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                }`}
                style={{ width: `${energy}%` }}
              />
            </div>
          </div>

          {/* Super Smash Action Button */}
          <button
            onClick={triggerSuperSmash}
            disabled={!canSuperSmash}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
              canSuperSmash
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-amber-500/40 hover:brightness-110 ring-2 ring-amber-300 animate-bounce'
                : 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>SMASH</span>
          </button>
        </div>

        {/* Auxiliary Controls (Tilt Mode Toggle & Gestures Info) */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={enableTiltControl}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 ${
              tiltEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800/60 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${tiltEnabled ? 'animate-spin' : ''}`} />
            <span>{tiltEnabled ? 'Tilt Sensor: AKTIF' : 'Aktifkan Tilt HP'}</span>
          </button>

          <div className="text-[10px] text-slate-400 font-mono text-right flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Flick ke atas saat bola datang!</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
