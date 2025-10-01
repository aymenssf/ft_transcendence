import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import Database from './loadSharedDb.js';


const app = express();
const PORT = process.env.PORT || 3012;
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());


app.get('/game', (req, res)=>
{
  res.json({status: 'DONE' , service: "game-service"});   
});


wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
  
    ws.on('message', (message) => {
      console.log('Received:', message.toString());
    });
  
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });



server.listen(PORT, () =>
{
    console.log("the service of the game is working ");
});