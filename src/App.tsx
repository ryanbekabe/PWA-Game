import React, { useState, useEffect } from 'react';
import type { PlayerRole } from './types/game';
import { Lobby } from './components/Lobby';
import { TVArena } from './components/TVArena';
import { MobileController } from './components/MobileController';
import { LocalArena } from './components/LocalArena';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<'lobby' | 'tv' | 'controller' | 'local'>('lobby');
  const [roomId, setRoomId] = useState<string>('CYBR');
  const [role, setRole] = useState<PlayerRole>('p1');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Monitor online status for PWA compliance
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Parse initial URL query parameters (e.g. from QR scan: ?room=CYBR&role=p1)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    const urlRole = params.get('role');

    if (urlRoom) {
      setRoomId(urlRoom.toUpperCase());

      if (urlRole === 'tv') {
        setRole('tv');
        setMode('tv');
      } else if (urlRole === 'p2') {
        setRole('p2');
        setMode('controller');
      } else {
        // Default to p1 controller
        setRole('p1');
        setMode('controller');
      }
    }
  }, []);

  const handleSelectMode = (
    selectedMode: 'tv' | 'controller' | 'local',
    selectedRoom: string,
    selectedRole: PlayerRole = 'p1'
  ) => {
    setRoomId(selectedRoom);
    setRole(selectedRole);
    setMode(selectedMode);

    // Update browser URL query params without reloading
    if (typeof window !== 'undefined' && selectedMode !== 'local') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', selectedRoom);
      url.searchParams.set('role', selectedRole);
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleExit = () => {
    setMode('lobby');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('role');
      window.history.pushState({}, '', url.pathname);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] bg-[#070714] text-white">
      {/* Offline banner for PWA */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Anda sedang offline. Mode lokal / cached tetap dapat dimainkan.</span>
        </div>
      )}

      {mode === 'lobby' && (
        <Lobby
          onSelectMode={handleSelectMode}
          defaultRoomId={roomId}
          defaultRole={role}
        />
      )}

      {mode === 'tv' && (
        <TVArena roomId={roomId} onExit={handleExit} />
      )}

      {mode === 'controller' && (
        <MobileController
          roomId={roomId}
          initialRole={role}
          onExit={handleExit}
        />
      )}

      {mode === 'local' && (
        <LocalArena onExit={handleExit} />
      )}
    </div>
  );
}
