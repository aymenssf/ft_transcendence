export interface GameMessage {
  type: 'game_config' | 'game_start' | 'game_update' | 'game_finish';
  payload: any;
}

export interface GameConfig {
  gameId: string;
  mode: string;
  difficulty: string;
}

export interface GameState {
  ball: Ball;
  paddles: Paddles;
}

export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius?: number;
}

export interface Paddles {
  left: Paddle;
  right: Paddle;
  width: number;
  height: number;
}

export interface Paddle {
  x: number;
  y: number;
  score?: number;
  up?: boolean;
  down?: boolean;
}

export interface AIMove {
  type: string;
  payload: {
    gameId: string | null;
    playerId: string;
    input: {
      up: boolean;
      down: boolean;
    };
  };
}

export interface DifficultySettings {
  threshold: number;
  reactionRate: number;
  predictionFrames: number;
}
