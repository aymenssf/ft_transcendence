import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import Database from './loadSharedDb.js';
import loadSharedDb from './loadSharedDb.js';


const app = express();
const PORT = process.env.PORT || 3012;
const server = createServer(app);
const wss = new WebSocketServer({ server });
const db = loadSharedDb();
app.use(cors());
app.use(express.json());

app.get('/test-db', async (req, res) => {
  const isConnected = await (await db).testConnection();
  res.json({ connected: isConnected });
});

app.get('/users', async (req, res) => {
  const users = await (await db).getAllUsers();
  res.json({ users });
});

app.get('/user/:id', async (req, res) => {
  const user = await (await db).findUserById(parseInt(req.params.id));
  res.json({ user });
});


server.listen(PORT, () =>
{
    console.log("the service of the game is working !!!!!");
});