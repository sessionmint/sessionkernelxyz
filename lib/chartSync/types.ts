export interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface ChartSessionState {
  isActive: boolean;
  tokenMint: string;
  startTime: number;
  endTime: number;
  currentPrice: number;
  targetPrice: number;
  volatility: number;
  trendDirection: 'up' | 'down' | 'neutral';
}

export interface BoosterSettings {
  boostFactor: number;
  duration: number;
  active: boolean;
  startTime: number;
}

export interface SafetyLimits {
  maxPriceChange: number;
  minPrice: number;
  maxPrice: number;
  maxVolatility: number;
}

export interface SessionMode {
  name: string;
  speed: number;
  pattern: 'random' | 'trend' | 'volatile' | 'stable';
  intensity: number;
}