import WebSocket from 'ws';
import { GameMessage, AIMove } from '../types/index.js';
import { AIController } from '../ai/controller.js';
import { getDifficultySettings } from '../config/difficulty.js';

export class GameConnectionHandler {
  private ws: WebSocket;
  private gameId: string | null = null;
  private difficulty: string = 'easy';
  private aiController: AIController;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.aiController = new AIController(getDifficultySettings('easy'));
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('close', () => this.handleClose());
    this.ws.on('error', (error) => this.handleError(error));
  }

  private handleMessage(data: WebSocket.Data): void {
    const message: GameMessage = JSON.parse(data.toString());

    switch (message.type) {
      case 'game_config':
        this.handleGameConfig(message.payload);
        break;
      case 'game_start':
        this.handleGameStart();
        break;
      case 'game_update':
        this.handleGameUpdate(message.payload);
        break;
      case 'game_finish':
        this.handleGameFinish(message.payload);
        break;
    }
  }

  private handleGameConfig(payload: any): void {
    this.gameId = payload.gameId;
    this.difficulty = payload.difficulty || 'easy';

    const settings = getDifficultySettings(this.difficulty);
    this.aiController.updateSettings(settings);
  }

  private handleGameStart(): void {
  }

  private handleGameUpdate(payload: any): void {
    const { ball, paddles } = payload;

    if (!ball || !paddles || !paddles.right) {
      return;
    }

    const move = this.aiController.calculateMove(ball, paddles);

    const aiMove: AIMove = {
      type: 'game_update',
      payload: {
        gameId: this.gameId,
        playerId: 'ai',
        input: move
      }
    };

    this.ws.send(JSON.stringify(aiMove));
  }

  private handleGameFinish(payload: any): void {
    console.log(`Game finished - Winner: ${payload.winner}`);
  }

  private handleClose(): void {
    console.log('Connection closed');
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
  }
}
