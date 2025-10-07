# AI Service

AI opponent service for Pong game.

## Features

- WebSocket communication with game service
- Three difficulty levels: easy, medium, hard
- Ball velocity prediction for higher difficulties

## Setup

```bash
npm install
npm run build
npm start
```

## Development

```bash
npm run dev
```

## Endpoints

- **WebSocket**: `ws://localhost:3013` - Game communication
- **Health**: `GET /api/ai/test` - Service status

## Difficulty Levels

- **Easy**: Low reaction rate (25%), no prediction
- **Medium**: Good reaction (85%), moderate prediction
- **Hard**: High reaction (90%), advanced prediction
