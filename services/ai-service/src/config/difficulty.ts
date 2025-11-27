import { DifficultySettings } from '../types/index.js';

export const DIFFICULTY_LEVELS: Record<string, DifficultySettings> = {
  easy: {
    threshold: 150,
    reactionRate: 0.25,
    predictionFrames: 0
  },
  medium: {
    threshold: 70,
    reactionRate: 0.50,
    predictionFrames: 3
  },
  hard: {
    threshold: 20,
    reactionRate: 0.90,
    predictionFrames: 12
  }
};

export const DEFAULT_DIFFICULTY: DifficultySettings = {
  threshold: 40,
  reactionRate: 0.80,
  predictionFrames: 8
};

export function getDifficultySettings(difficulty: string): DifficultySettings {
  return DIFFICULTY_LEVELS[difficulty.toLowerCase()] || DEFAULT_DIFFICULTY;
}
