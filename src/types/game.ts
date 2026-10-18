/**
 * CyberPong Arena - Core Types & WebSocket Protocols
 */

export type PlayerRole = 'tv' | 'p1' | 'p2' | 'spectator';

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'goal' | 'gameover' | 'paused';

export type PowerUpType = 'mega_smash' | 'shield' | 'fast_ball' | 'curve_spin' | 'split_ball';

export interface PlayerData {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  y: number; // 0 to 100 percentage from top
  x: number; // 0 to 100 percentage from left
  vy: number;
  energy: number; // 0 to 100
  powerActive: PowerUpType | null;
  lastGesture: string | null;
  isAI?: boolean;
}

export interface BallData {
  x: number; // 0 to 1000 standard arena coordinates
  y: number; // 0 to 600 standard arena coordinates
  vx: number;
  vy: number;
  speed: number;
  radius: number;
  spin: number; // -1 to 1 for curved trajectories
  powerType: PowerUpType | null;
  trail: Array<{ x: number; y: number; alpha: number; color?: string }>;
}

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  countdown: number;
  p1: PlayerData;
  p2: PlayerData;
  ball: BallData;
  powerups: PowerUpItem[];
  winner: 'p1' | 'p2' | null;
  targetScore: number;
  stats: {
    rallies: number;
    highestRally: number;
    maxSpeed: number;
    lastScorer: 'p1' | 'p2' | null;
    goalsP1: number;
    goalsP2: number;
  };
  lastUpdate: number;
}

// WebSocket Message Types
export type ClientMessageType =
  | 'join_room'
  | 'controller_input'
  | 'activate_power'
  | 'start_game'
  | 'reset_game'
  | 'pause_game'
  | 'resume_game'
  | 'toggle_ai'
  | 'ping';

export interface ClientMessage {
  type: ClientMessageType;
  roomId?: string;
  role?: PlayerRole;
  name?: string;
  // Controller input fields
  y?: number;
  x?: number;
  vy?: number;
  gesture?: 'flick_up' | 'flick_down' | 'flick_forward' | 'curve_left' | 'curve_right' | 'tap' | 'tilt';
  tiltBeta?: number; // tilt forward/backward
  tiltGamma?: number; // tilt left/right
  powerType?: PowerUpType;
  timestamp?: number;
}

export type ServerMessageType =
  | 'room_joined'
  | 'state_sync'
  | 'player_joined'
  | 'player_left'
  | 'game_event'
  | 'error'
  | 'pong';

export interface GameEventPayload {
  event: 'paddle_hit' | 'wall_bounce' | 'goal' | 'countdown' | 'gameover' | 'powerup_collected' | 'powerup_spawned' | 'super_smash';
  scorer?: 'p1' | 'p2';
  player?: 'p1' | 'p2';
  powerType?: PowerUpType;
  x?: number;
  y?: number;
}

export interface ServerMessage {
  type: ServerMessageType;
  roomId?: string;
  role?: PlayerRole;
  state?: GameState;
  event?: GameEventPayload;
  message?: string;
  timestamp?: number;
}
