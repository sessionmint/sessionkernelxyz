import { SafetyLimits } from './types';

export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  maxPriceChange: 0.5, // Max 50% price change
  minPrice: 0.000001,  // Minimum price
  maxPrice: 1000000,   // Maximum price
  maxVolatility: 0.3,  // Max volatility factor
};

export function validatePrice(price: number, limits: SafetyLimits = DEFAULT_SAFETY_LIMITS): boolean {
  return price >= limits.minPrice && price <= limits.maxPrice;
}

export function validatePriceChange(oldPrice: number, newPrice: number, limits: SafetyLimits = DEFAULT_SAFETY_LIMITS): boolean {
  const changePercent = Math.abs(newPrice - oldPrice) / oldPrice;
  return changePercent <= limits.maxPriceChange;
}

export function applySafetyLimits(value: number, limits: SafetyLimits = DEFAULT_SAFETY_LIMITS): number {
  return Math.min(Math.max(value, limits.minPrice), limits.maxPrice);
}

export function validateVolatility(volatility: number, limits: SafetyLimits = DEFAULT_SAFETY_LIMITS): boolean {
  return volatility <= limits.maxVolatility;
}

export function sanitizeChartData(data: number[], limits: SafetyLimits = DEFAULT_SAFETY_LIMITS): number[] {
  return data.map(price => applySafetyLimits(price, limits));
}