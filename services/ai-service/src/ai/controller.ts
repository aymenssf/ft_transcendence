import { Ball, Paddles, DifficultySettings } from '../types/index.js';

export class AIController {
  private settings: DifficultySettings;

  constructor(settings: DifficultySettings) {
    this.settings = settings;
  }

  public calculateMove(ball: Ball, paddles: Paddles): { up: boolean; down: boolean } {
    const aiPaddle = paddles.right;
    const paddleHeight = paddles.height || 150;
    const paddleCenter = aiPaddle.y + (paddleHeight / 2);

    const shouldMove = Math.random() < this.settings.reactionRate;
    if (!shouldMove) {
      return { up: false, down: false };
    }

    const targetY = this.predictBallPosition(ball);

    if (targetY < paddleCenter - this.settings.threshold) {
      return { up: true, down: false };
    } else if (targetY > paddleCenter + this.settings.threshold) {
      return { up: false, down: true };
    }

    return { up: false, down: false };
  }

  private predictBallPosition(ball: Ball): number {
    let targetY = ball.y;

    if (ball.dx && ball.dy && ball.dx > 0 && this.settings.predictionFrames > 0) {
      targetY = ball.y + (ball.dy * this.settings.predictionFrames);
    }

    return targetY;
  }

  public updateSettings(settings: DifficultySettings): void {
    this.settings = settings;
  }
}
