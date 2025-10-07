# AI Service

AI opponent service

## Features

- WebSocket communication with game service
- Difficulty levels: easy, medium, hard

## Endpoints

- **WebSocket**: `ws://localhost:3013` - Game communication
- **Health**: `GET /api/ai/test` - Service status

## Difficulty Levels

- **Easy**: Low reaction rate (25%), no prediction
- **Medium**: Good reaction (85%), moderate prediction
- **Hard**: High reaction (90%), advanced prediction
