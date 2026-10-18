import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  GameState,
  ClientMessage,
  ServerMessage,
  PlayerRole,
  GameEventPayload,
  PowerUpType,
} from '../types/game';
import { sound } from '../utils/audio';

export interface UseWebSocketGameOptions {
  roomId: string;
  role: PlayerRole;
  playerName?: string;
  onEvent?: (event: GameEventPayload) => void;
}

export function useWebSocketGame({ roomId, role, playerName = 'Player', onEvent }: UseWebSocketGameOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [assignedRole, setAssignedRole] = useState<PlayerRole>(role);
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Menghubungkan...');

  const wsRef = useRef<WebSocket | null>(null);
  const pingTimestampRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendControllerInput = useCallback((
    y: number,
    vy: number,
    gesture?: 'flick_up' | 'flick_down' | 'flick_forward' | 'curve_left' | 'curve_right' | 'tap' | 'tilt',
    tiltBeta?: number,
    tiltGamma?: number
  ) => {
    sendMessage({
      type: 'controller_input',
      roomId,
      role: assignedRole,
      y,
      vy,
      gesture,
      tiltBeta,
      tiltGamma,
      timestamp: Date.now(),
    });
  }, [sendMessage, roomId, assignedRole]);

  const activatePower = useCallback((powerType: PowerUpType = 'mega_smash') => {
    sendMessage({
      type: 'activate_power',
      roomId,
      powerType,
    });
  }, [sendMessage, roomId]);

  const startGame = useCallback(() => {
    sendMessage({ type: 'start_game', roomId });
  }, [sendMessage, roomId]);

  const resetGame = useCallback(() => {
    sendMessage({ type: 'reset_game', roomId });
  }, [sendMessage, roomId]);

  const pauseGame = useCallback(() => {
    sendMessage({ type: 'pause_game', roomId });
  }, [sendMessage, roomId]);

  const resumeGame = useCallback(() => {
    sendMessage({ type: 'resume_game', roomId });
  }, [sendMessage, roomId]);

  const toggleAI = useCallback(() => {
    sendMessage({ type: 'toggle_ai', roomId });
  }, [sendMessage, roomId]);

  useEffect(() => {
    if (!roomId) return;

    let isMounted = true;

    function connect() {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setStatusMessage('Terhubung ke Server');

        // Join room
        ws.send(
          JSON.stringify({
            type: 'join_room',
            roomId,
            role,
            name: playerName,
          } as ClientMessage)
        );

        // Ping check
        pingTimestampRef.current = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg: ServerMessage = JSON.parse(event.data);

          if (msg.type === 'room_joined') {
            if (msg.role) setAssignedRole(msg.role);
            if (msg.state) setGameState(msg.state);
            setStatusMessage(`Bergabung di Room ${msg.roomId} sebagai ${msg.role?.toUpperCase()}`);
          } else if (msg.type === 'state_sync') {
            if (msg.state) setGameState(msg.state);
            if (msg.message) setStatusMessage(msg.message);
          } else if (msg.type === 'game_event' && msg.event) {
            // Sound triggers based on event
            if (msg.event.event === 'paddle_hit') {
              sound.playPaddleHit(msg.event.player === 'p1', false);
            } else if (msg.event.event === 'super_smash') {
              sound.playPaddleHit(msg.event.player === 'p1', true);
            } else if (msg.event.event === 'wall_bounce') {
              sound.playWallBounce();
            } else if (msg.event.event === 'goal') {
              sound.playGoalCelebration();
            } else if (msg.event.event === 'countdown') {
              sound.playCountdownBeep(false);
            } else if (msg.event.event === 'gameover') {
              sound.playVictoryFanfare();
            } else if (msg.event.event === 'powerup_collected') {
              sound.playPowerupCollect();
            }

            if (onEventRef.current) {
              onEventRef.current(msg.event);
            }
          } else if (msg.type === 'pong') {
            const rtt = Date.now() - pingTimestampRef.current;
            setLatency(Math.max(1, Math.round(rtt / 2)));
          }
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        setStatusMessage('Koneksi terputus. Mencoba reconnect...');
        // Auto-reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    }

    connect();

    // Ping interval for latency monitoring
    const latencyInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        pingTimestampRef.current = Date.now();
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(latencyInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, role, playerName]);

  return {
    gameState,
    assignedRole,
    isConnected,
    latency,
    statusMessage,
    sendControllerInput,
    activatePower,
    startGame,
    resetGame,
    pauseGame,
    resumeGame,
    toggleAI,
  };
}
