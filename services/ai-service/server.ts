import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const PORT = process.env.PORT || 3013;

app.use(cors());
app.use(express.json());

app.get('/ai', (req, res) => {
  res.json({ status: 'DONE', service: 'ai-service' });
});

app.get('/api/ai/test', (req, res) => {
  res.json({
    message: 'AI service is ready',
    service: 'ai-service'
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let gameId: string | null = null;
  let difficulty: string = 'easy';
  let moveCounter = 0;

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === 'game_config') {
      gameId = message.payload.gameId;
      difficulty = message.payload.difficulty || 'easy';
      moveCounter = 0;

    } else if (message.type === 'game_start') {
      console.log(`Game started - Difficulty: ${difficulty}`);

    } else if (message.type === 'game_update') {
      moveCounter++;
      const { ball, paddles } = message.payload;

      if (ball && paddles && paddles.right) {
        const aiPaddle = paddles.right;
        const paddleHeight = paddles.height || 150;
        const paddleCenter = aiPaddle.y + (paddleHeight / 2);

        let threshold = 30;
        let shouldMove = true;
        let predictionFrames = 0;

        switch (difficulty.toLowerCase()) {
          case 'easy':
            threshold = 150;
            shouldMove = Math.random() > 0.75;
            predictionFrames = 0;
            break;
          case 'medium':
            threshold = 30;
            shouldMove = Math.random() > 0.15;
            predictionFrames = 10;
            break;
          case 'hard':
            threshold = 20;
            shouldMove = Math.random() > 0.1;
            predictionFrames = 12;
            break;
          default:
            threshold = 40;
            shouldMove = Math.random() > 0.2;
            predictionFrames = 8;
            break;
        }

        let targetY = ball.y;

        if (ball.dx && ball.dy && ball.dx > 0 && predictionFrames > 0) {
          targetY = ball.y + (ball.dy * predictionFrames);
        }

        let moveUp = false;
        let moveDown = false;

        if (shouldMove) {
          if (targetY < paddleCenter - threshold) {
            moveUp = true;
          } else if (targetY > paddleCenter + threshold) {
            moveDown = true;
          }
        }

        const aiMove = {
          type: 'game_update',
          payload: {
            gameId: gameId,
            playerId: 'ai',
            input: {
              up: moveUp,
              down: moveDown
            }
          }
        };

        ws.send(JSON.stringify(aiMove));
      }
    } else if (message.type === 'game_finish') {
    }
  });

  ws.on('close', () => {
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

server.listen(PORT, () => {
});
