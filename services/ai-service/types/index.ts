export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameState {
  ball: {
    x: number;
    y: number;

  };
  paddle: {
    y: number;
    height: number;
  };
}

export interface AIMoveRequest {
  gameState: GameState;
  difficulty: Difficulty;
}