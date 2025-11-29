import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { GameConnectionHandler } from './websocket/handler.js';

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
  new GameConnectionHandler(ws);
});

server.listen(PORT, () => {
});
