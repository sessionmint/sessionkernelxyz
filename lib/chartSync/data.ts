import { ChartDataPoint } from './types';

export async function fetchChartData(tokenMint: string): Promise<ChartDataPoint[]> {
  // Simulate fetching chart data for a token
  // In a real implementation, this would call an API like DexScreener
  const mockData: ChartDataPoint[] = [];
  const now = Date.now();

  for (let i = 0; i < 100; i++) {
    const timestamp = now - (100 - i) * 60000; // 1-minute intervals
    const basePrice = 1 + Math.sin(i / 10) * 0.5;
    const randomFactor = (Math.random() - 0.5) * 0.1;
    const price = Math.max(0.000001, basePrice + randomFactor);

    mockData.push({
      timestamp,
      price,
      volume: Math.random() * 1000000
    });
  }

  return mockData;
}

export async function updateChartForToken(tokenMint: string, params?: {
  boost?: number;
  volatility?: number;
  trend?: 'up' | 'down' | 'neutral'
}): Promise<ChartDataPoint[]> {
  // Simulate updating chart based on token and parameters
  let data = await fetchChartData(tokenMint);

  if (params?.boost) {
    // Apply boost factor to recent prices
    const boostFactor = params.boost;
    const recentCount = Math.min(10, data.length);

    for (let i = data.length - recentCount; i < data.length; i++) {
      data[i].price *= (1 + (Math.random() * 0.05 * boostFactor));
    }
  }

  if (params?.volatility) {
    // Apply volatility to recent prices
    const volFactor = params.volatility;
    for (let i = data.length - 20; i < data.length; i++) {
      const change = (Math.random() - 0.5) * 0.1 * volFactor;
      data[i].price = Math.max(0.000001, data[i].price * (1 + change));
    }
  }

  if (params?.trend) {
    // Apply trend direction to recent prices
    const multiplier = params.trend === 'up' ? 1.005 : params.trend === 'down' ? 0.995 : 1;
    for (let i = data.length - 15; i < data.length; i++) {
      data[i].price *= multiplier;
    }
  }

  return data;
}
