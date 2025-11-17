export interface Game 
{
    id?: number;
    player1_id: number;
    player2_id?: number;
    player1_score: number;
    player2_score: number;
    status: 'waiting' | 'playing' | 'finished';
    is_ai_game: boolean;
    created_at?: string;
    finished_at?: string;
  }
  
  export interface GameMessage 
  {
    type: 'join' | 'move' | 'update' | 'end';
    gameId?: string;
    playerId?: number;
    data?: any;
  }