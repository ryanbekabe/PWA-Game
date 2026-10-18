import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  GameState,
  ClientMessage,
  ServerMessage,
  PlayerRole,
  GameEventPayload,
  PowerUpItem,
  PowerUpType,
} from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ARENA_WIDTH = 1000;
const ARENA_HEIGHT = 600;
const PADDLE_HEIGHT_PERCENT = 24; // 24% of arena height
const PADDLE_WIDTH = 20;
const BALL_BASE_SPEED = 7.5;
const BALL_MAX_SPEED = 18.0;
const WINNING_SCORE = 7;

interface ConnectedClient {
  ws: WebSocket;
  role: PlayerRole;
  name: string;
  roomId: string;
  isAlive: boolean;
}

interface Room {
  id: string;
  state: GameState;
  clients: Set<ConnectedClient>;
  intervalId: NodeJS.Timeout | null;
  aiIntervalId: NodeJS.Timeout | null;
  goalPauseUntil: number;
}

const rooms = new Map<string, Room>();

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function createInitialGameState(roomId: string): GameState {
  return {
    roomId,
    status: 'waiting',
    countdown: 3,
    p1: {
      id: '',
      name: 'Player 1',
      connected: false,
      score: 0,
      y: 50,
      x: 4,
      vy: 0,
      energy: 50,
      powerActive: null,
      lastGesture: null,
      isAI: false,
    },
    p2: {
      id: '',
      name: 'Player 2',
      connected: false,
      score: 0,
      y: 50,
      x: 96,
      vy: 0,
      energy: 50,
      powerActive: null,
      lastGesture: null,
      isAI: false,
    },
    ball: {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      vx: Math.random() > 0.5 ? BALL_BASE_SPEED : -BALL_BASE_SPEED,
      vy: (Math.random() * 4 - 2),
      speed: BALL_BASE_SPEED,
      radius: 12,
      spin: 0,
      powerType: null,
      trail: [],
    },
    powerups: [],
    winner: null,
    targetScore: WINNING_SCORE,
    stats: {
      rallies: 0,
      highestRally: 0,
      maxSpeed: BALL_BASE_SPEED,
      lastScorer: null,
      goalsP1: 0,
      goalsP2: 0,
    },
    lastUpdate: Date.now(),
  };
}

function broadcastToRoom(room: Room, message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const client of room.clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastEvent(room: Room, event: GameEventPayload) {
  broadcastToRoom(room, {
    type: 'game_event',
    event,
    timestamp: Date.now(),
  });
}

function resetBall(room: Room, towardP1: boolean = false) {
  const ball = room.state.ball;
  ball.x = ARENA_WIDTH / 2;
  ball.y = ARENA_HEIGHT / 2;
  const dir = towardP1 ? -1 : 1;
  ball.speed = BALL_BASE_SPEED;
  ball.vx = dir * BALL_BASE_SPEED;
  ball.vy = (Math.random() * 4 - 2);
  ball.spin = 0;
  ball.powerType = null;
  ball.trail = [];
}

function spawnPowerUp(room: Room) {
  if (room.state.powerups.length >= 2 || room.state.status !== 'playing') return;
  const types: PowerUpType[] = ['mega_smash', 'shield', 'fast_ball', 'curve_spin'];
  const type = types[Math.floor(Math.random() * types.length)];
  const powerup: PowerUpItem = {
    id: `pw_${Date.now()}_${Math.random()}`,
    type,
    x: 250 + Math.random() * 500, // spawn in central 50%
    y: 100 + Math.random() * 400,
    radius: 18,
    active: true,
  };
  room.state.powerups.push(powerup);
  broadcastEvent(room, {
    event: 'powerup_spawned',
    powerType: type,
    x: powerup.x,
    y: powerup.y,
  });
}

function startCountdown(room: Room) {
  room.state.status = 'countdown';
  room.state.countdown = 3;
  resetBall(room, Math.random() > 0.5);
  broadcastToRoom(room, { type: 'state_sync', state: room.state });
  broadcastEvent(room, { event: 'countdown' });

  const countdownInterval = setInterval(() => {
    room.state.countdown -= 1;
    if (room.state.countdown <= 0) {
      clearInterval(countdownInterval);
      room.state.status = 'playing';
      broadcastToRoom(room, { type: 'state_sync', state: room.state });
    } else {
      broadcastToRoom(room, { type: 'state_sync', state: room.state });
      broadcastEvent(room, { event: 'countdown' });
    }
  }, 1000);
}

function updateRoomPhysics(room: Room) {
  const state = room.state;
  if (state.status !== 'playing') return;

  const now = Date.now();
  if (room.goalPauseUntil > now) return;

  const ball = state.ball;
  const p1 = state.p1;
  const p2 = state.p2;

  // Add trail position
  ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 1.0 });
  if (ball.trail.length > 8) {
    ball.trail.pop();
  }
  for (let i = 0; i < ball.trail.length; i++) {
    ball.trail[i].alpha *= 0.82;
  }

  // Spin curve effect
  if (ball.spin !== 0) {
    ball.vy += ball.spin * 0.35;
    ball.spin *= 0.98; // decay spin
  }

  // Move ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall collisions (top and bottom)
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = -ball.vy;
    broadcastEvent(room, { event: 'wall_bounce', x: ball.x, y: ball.y });
  } else if (ball.y + ball.radius >= ARENA_HEIGHT) {
    ball.y = ARENA_HEIGHT - ball.radius;
    ball.vy = -ball.vy;
    broadcastEvent(room, { event: 'wall_bounce', x: ball.x, y: ball.y });
  }

  // Paddle dimensions in arena units
  const paddleHalfHeight = (PADDLE_HEIGHT_PERCENT / 100) * ARENA_HEIGHT * 0.5;

  // Check collision with Player 1 (Left)
  const p1CenterY = (p1.y / 100) * ARENA_HEIGHT;
  const p1Top = p1CenterY - paddleHalfHeight;
  const p1Bottom = p1CenterY + paddleHalfHeight;
  const p1X = (p1.x / 100) * ARENA_WIDTH;

  if (
    ball.vx < 0 &&
    ball.x - ball.radius <= p1X + PADDLE_WIDTH &&
    ball.x + ball.radius >= p1X &&
    ball.y + ball.radius >= p1Top &&
    ball.y - ball.radius <= p1Bottom
  ) {
    // Collision with P1!
    ball.x = p1X + PADDLE_WIDTH + ball.radius;
    state.stats.rallies += 1;
    if (state.stats.rallies > state.stats.highestRally) {
      state.stats.highestRally = state.stats.rallies;
    }

    // Relative hit point: -1 (top edge) to 1 (bottom edge)
    const relativeIntersectY = (ball.y - p1CenterY) / paddleHalfHeight;
    const bounceAngle = relativeIntersectY * (Math.PI / 3.4); // max ~53 degrees

    // Speed boost & smash check
    const isSmash = p1.powerActive === 'mega_smash' || p1.lastGesture === 'flick_up' || p1.lastGesture === 'flick_forward';
    let speed = Math.min(BALL_MAX_SPEED, ball.speed + 0.35);
    if (isSmash) {
      speed = Math.min(BALL_MAX_SPEED * 1.25, speed * 1.35);
      ball.powerType = 'mega_smash';
      p1.powerActive = null;
    }

    ball.speed = speed;
    ball.vx = Math.abs(speed * Math.cos(bounceAngle));
    ball.vy = speed * Math.sin(bounceAngle) + p1.vy * 0.25;

    // Add spin if curving gesture
    if (p1.lastGesture === 'curve_left') ball.spin = -0.8;
    if (p1.lastGesture === 'curve_right') ball.spin = 0.8;

    p1.energy = Math.min(100, p1.energy + 15);
    p1.lastGesture = null;

    if (ball.speed > state.stats.maxSpeed) {
      state.stats.maxSpeed = Math.round(ball.speed * 10) / 10;
    }

    broadcastEvent(room, {
      event: isSmash ? 'super_smash' : 'paddle_hit',
      player: 'p1',
      x: ball.x,
      y: ball.y,
    });
  }

  // Check collision with Player 2 (Right)
  const p2CenterY = (p2.y / 100) * ARENA_HEIGHT;
  const p2Top = p2CenterY - paddleHalfHeight;
  const p2Bottom = p2CenterY + paddleHalfHeight;
  const p2X = (p2.x / 100) * ARENA_WIDTH;

  if (
    ball.vx > 0 &&
    ball.x + ball.radius >= p2X - PADDLE_WIDTH &&
    ball.x - ball.radius <= p2X &&
    ball.y + ball.radius >= p2Top &&
    ball.y - ball.radius <= p2Bottom
  ) {
    // Collision with P2!
    ball.x = p2X - PADDLE_WIDTH - ball.radius;
    state.stats.rallies += 1;
    if (state.stats.rallies > state.stats.highestRally) {
      state.stats.highestRally = state.stats.rallies;
    }

    const relativeIntersectY = (ball.y - p2CenterY) / paddleHalfHeight;
    const bounceAngle = relativeIntersectY * (Math.PI / 3.4);

    const isSmash = p2.powerActive === 'mega_smash' || p2.lastGesture === 'flick_up' || p2.lastGesture === 'flick_forward';
    let speed = Math.min(BALL_MAX_SPEED, ball.speed + 0.35);
    if (isSmash) {
      speed = Math.min(BALL_MAX_SPEED * 1.25, speed * 1.35);
      ball.powerType = 'mega_smash';
      p2.powerActive = null;
    }

    ball.speed = speed;
    ball.vx = -Math.abs(speed * Math.cos(bounceAngle));
    ball.vy = speed * Math.sin(bounceAngle) + p2.vy * 0.25;

    if (p2.lastGesture === 'curve_left') ball.spin = -0.8;
    if (p2.lastGesture === 'curve_right') ball.spin = 0.8;

    p2.energy = Math.min(100, p2.energy + 15);
    p2.lastGesture = null;

    if (ball.speed > state.stats.maxSpeed) {
      state.stats.maxSpeed = Math.round(ball.speed * 10) / 10;
    }

    broadcastEvent(room, {
      event: isSmash ? 'super_smash' : 'paddle_hit',
      player: 'p2',
      x: ball.x,
      y: ball.y,
    });
  }

  // Check Power-Up collisions
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const pw = state.powerups[i];
    const dist = Math.hypot(ball.x - pw.x, ball.y - pw.y);
    if (dist < ball.radius + pw.radius) {
      const collectingPlayer = ball.vx > 0 ? p1 : p2;
      collectingPlayer.energy = 100;
      collectingPlayer.powerActive = pw.type;
      ball.powerType = pw.type;

      broadcastEvent(room, {
        event: 'powerup_collected',
        player: ball.vx > 0 ? 'p1' : 'p2',
        powerType: pw.type,
        x: pw.x,
        y: pw.y,
      });

      state.powerups.splice(i, 1);
    }
  }

  // Random power-up spawn chance (every ~10-15s)
  if (Math.random() < 0.003) {
    spawnPowerUp(room);
  }

  // Goal Detection
  // P2 scores if ball passes P1 left boundary
  if (ball.x < -20) {
    p2.score += 1;
    state.stats.goalsP2 += 1;
    state.stats.lastScorer = 'p2';
    state.stats.rallies = 0;
    room.goalPauseUntil = Date.now() + 1800;

    broadcastEvent(room, { event: 'goal', scorer: 'p2' });

    if (p2.score >= state.targetScore) {
      state.status = 'gameover';
      state.winner = 'p2';
      broadcastEvent(room, { event: 'gameover', player: 'p2' });
    } else {
      setTimeout(() => {
        if (state.status === 'playing') {
          resetBall(room, false); // serve towards P2
        }
      }, 1500);
    }
  } else if (ball.x > ARENA_WIDTH + 20) {
    // P1 scores if ball passes P2 right boundary
    p1.score += 1;
    state.stats.goalsP1 += 1;
    state.stats.lastScorer = 'p1';
    state.stats.rallies = 0;
    room.goalPauseUntil = Date.now() + 1800;

    broadcastEvent(room, { event: 'goal', scorer: 'p1' });

    if (p1.score >= state.targetScore) {
      state.status = 'gameover';
      state.winner = 'p1';
      broadcastEvent(room, { event: 'gameover', player: 'p1' });
    } else {
      setTimeout(() => {
        if (state.status === 'playing') {
          resetBall(room, true); // serve towards P1
        }
      }, 1500);
    }
  }

  state.lastUpdate = Date.now();
  // Broadcast state sync
  broadcastToRoom(room, { type: 'state_sync', state: room.state });
}

function updateAI(room: Room) {
  const p2 = room.state.p2;
  if (!p2.isAI || room.state.status !== 'playing') return;

  const ball = room.state.ball;
  const targetY = (ball.y / ARENA_HEIGHT) * 100;

  // Add human-like reaction smoothing
  const diff = targetY - p2.y;
  const aiSpeed = ball.vx > 0 ? 3.2 : 1.4; // react faster when ball approaches P2

  if (Math.abs(diff) > 2) {
    const move = Math.sign(diff) * Math.min(Math.abs(diff), aiSpeed);
    p2.y = Math.max(12, Math.min(88, p2.y + move));
    p2.vy = move;
  }

  // AI smash gesture if energy is full and ball is close
  if (p2.energy >= 100 && ball.vx > 0 && ball.x > 750 && Math.abs(diff) < 15) {
    p2.powerActive = 'mega_smash';
    p2.lastGesture = 'flick_up';
    p2.energy = 0;
  }
}

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      state: createInitialGameState(roomId),
      clients: new Set(),
      intervalId: null,
      aiIntervalId: null,
      goalPauseUntil: 0,
    };

    // Start physics loop at ~60fps
    room.intervalId = setInterval(() => {
      updateRoomPhysics(room!);
    }, 1000 / 60);

    // AI loop at ~30fps
    room.aiIntervalId = setInterval(() => {
      updateAI(room!);
    }, 1000 / 30);

    rooms.set(roomId, room);
  }
  return room;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // API endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size });
  });

  app.get('/api/rooms/new', (req, res) => {
    let roomId = generateRoomId();
    while (rooms.has(roomId)) {
      roomId = generateRoomId();
    }
    getOrCreateRoom(roomId);
    res.json({ roomId });
  });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    let client: ConnectedClient = {
      ws,
      role: 'spectator',
      name: 'Guest',
      roomId: '',
      isAlive: true,
    };

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (raw: string) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'join_room': {
            const requestedRoom = (msg.roomId || 'CYBER').toUpperCase();
            const room = getOrCreateRoom(requestedRoom);
            client.roomId = requestedRoom;
            client.name = msg.name || 'Pemain';

            // Assign role
            if (msg.role === 'tv') {
              client.role = 'tv';
            } else if (msg.role === 'p1') {
              client.role = 'p1';
              room.state.p1.connected = true;
              room.state.p1.name = client.name;
              room.state.p1.isAI = false;
            } else if (msg.role === 'p2') {
              client.role = 'p2';
              room.state.p2.connected = true;
              room.state.p2.name = client.name;
              room.state.p2.isAI = false;
            } else {
              // Auto-assign player slot if not explicit
              if (!room.state.p1.connected) {
                client.role = 'p1';
                room.state.p1.connected = true;
                room.state.p1.name = client.name;
                room.state.p1.isAI = false;
              } else if (!room.state.p2.connected && !room.state.p2.isAI) {
                client.role = 'p2';
                room.state.p2.connected = true;
                room.state.p2.name = client.name;
                room.state.p2.isAI = false;
              } else {
                client.role = 'spectator';
              }
            }

            room.clients.add(client);

            // Send confirmation
            ws.send(
              JSON.stringify({
                type: 'room_joined',
                roomId: requestedRoom,
                role: client.role,
                state: room.state,
                timestamp: Date.now(),
              } as ServerMessage)
            );

            // Broadcast update to all
            broadcastToRoom(room, {
              type: 'state_sync',
              state: room.state,
              message: `${client.name} bergabung sebagai ${client.role}`,
            });

            // If both players are connected or TV with 1 player + AI, auto ready
            if (
              (room.state.p1.connected && (room.state.p2.connected || room.state.p2.isAI)) &&
              room.state.status === 'waiting'
            ) {
              startCountdown(room);
            }
            break;
          }

          case 'controller_input': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;

            const player = client.role === 'p1' ? room.state.p1 : client.role === 'p2' ? room.state.p2 : null;
            if (!player) return;

            if (typeof msg.y === 'number') {
              // Clamp between 10% and 90%
              player.y = Math.max(10, Math.min(90, msg.y));
            }
            if (typeof msg.vy === 'number') {
              player.vy = msg.vy;
            }
            if (msg.gesture) {
              player.lastGesture = msg.gesture;
            }
            break;
          }

          case 'activate_power': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;

            const player = client.role === 'p1' ? room.state.p1 : client.role === 'p2' ? room.state.p2 : null;
            if (!player) return;

            if (player.energy >= 80) {
              player.powerActive = msg.powerType || 'mega_smash';
              player.energy = 0;
              broadcastEvent(room, {
                event: 'super_smash',
                player: client.role as 'p1' | 'p2',
              });
            }
            break;
          }

          case 'start_game': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;
            room.state.p1.score = 0;
            room.state.p2.score = 0;
            room.state.winner = null;
            startCountdown(room);
            break;
          }

          case 'reset_game': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;
            room.state.p1.score = 0;
            room.state.p2.score = 0;
            room.state.winner = null;
            room.state.status = 'waiting';
            resetBall(room);
            broadcastToRoom(room, { type: 'state_sync', state: room.state });
            break;
          }

          case 'pause_game': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;
            if (room.state.status === 'playing') {
              room.state.status = 'paused';
              broadcastToRoom(room, { type: 'state_sync', state: room.state });
            }
            break;
          }

          case 'resume_game': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;
            if (room.state.status === 'paused') {
              room.state.status = 'playing';
              broadcastToRoom(room, { type: 'state_sync', state: room.state });
            }
            break;
          }

          case 'toggle_ai': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (!room) return;
            room.state.p2.isAI = !room.state.p2.isAI;
            if (room.state.p2.isAI) {
              room.state.p2.name = 'Cyber AI Bot';
              room.state.p2.connected = true;
            } else {
              room.state.p2.name = 'Player 2';
              room.state.p2.connected = false;
            }
            broadcastToRoom(room, { type: 'state_sync', state: room.state });
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    ws.on('close', () => {
      if (client.roomId) {
        const room = rooms.get(client.roomId);
        if (room) {
          room.clients.delete(client);
          if (client.role === 'p1') {
            room.state.p1.connected = false;
          } else if (client.role === 'p2') {
            room.state.p2.connected = false;
          }

          broadcastToRoom(room, {
            type: 'state_sync',
            state: room.state,
            message: `${client.name} keluar.`,
          });

          // If all clients left, cleanup after 5 minutes
          if (room.clients.size === 0) {
            setTimeout(() => {
              if (room.clients.size === 0) {
                if (room.intervalId) clearInterval(room.intervalId);
                if (room.aiIntervalId) clearInterval(room.aiIntervalId);
                rooms.delete(room.id);
              }
            }, 300000);
          }
        }
      }
    });
  });

  // Keep-alive ping interval
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 25000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  // Mount Vite or static server
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CyberPong Server] Running on http://0.0.0.0:${PORT} in ${isDev ? 'development' : 'production'} mode`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
