import { BoosterSettings } from './types';

export function createBooster(boostFactor: number, duration: number): BoosterSettings {
  return {
    boostFactor,
    duration,
    active: true,
    startTime: Date.now(),
  };
}

export function isBoosterActive(booster: BoosterSettings): boolean {
  if (!booster.active) return false;
  return Date.now() - booster.startTime < booster.duration;
}

export function getBoosterEffect(booster: BoosterSettings): number {
  if (!isBoosterActive(booster)) return 0;
  
  const elapsed = Date.now() - booster.startTime;
  const remaining = booster.duration - elapsed;
  const decayFactor = remaining / booster.duration;
  
  return booster.boostFactor * decayFactor;
}

export function applyBoostToPrice(basePrice: number, booster: BoosterSettings): number {
  const effect = getBoosterEffect(booster);
  return basePrice * (1 + effect * 0.01); // Boost as percentage
}