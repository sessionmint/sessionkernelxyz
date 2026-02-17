import { ChartSessionState } from './types';
import { AUTOBLOW_PUBLIC_ENABLED } from '@/lib/constants';

export async function createChartSession(tokenMint: string, duration: number): Promise<ChartSessionState> {
  const now = Date.now();
  
  // Fetch initial chart data
  const currentPrice = 1; // Default price
  
  // Start Autoblow session for the token
  if (AUTOBLOW_PUBLIC_ENABLED) {
    try {
      const response = await fetch('/api/autoblow', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenMint,
          action: 'start',
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to start Autoblow session:', await response.text());
      }
    } catch (error) {
      console.error('Error starting Autoblow session:', error);
    }
  }
  
  return {
    isActive: true,
    tokenMint,
    startTime: now,
    endTime: now + duration,
    currentPrice,
    targetPrice: currentPrice,
    volatility: 0.1,
    trendDirection: 'neutral',
  };
}

export async function updateChartSession(session: ChartSessionState, booster?: any): Promise<ChartSessionState> {
  // Calculate time elapsed
  const now = Date.now();
  const timeElapsed = now - session.startTime;
  const timeRemaining = session.endTime - now;
  
  // Determine if session is still active
  const isActive = timeRemaining > 0;
  
  // Apply some random movement to simulate chart activity
  const randomMovement = (Math.random() - 0.5) * 0.02; // ±1% movement
  const newPrice = session.currentPrice * (1 + randomMovement);
  
  return {
    ...session,
    isActive,
    currentPrice: newPrice,
    targetPrice: newPrice,
  };
}

export async function syncChartWithAutoblow(session: ChartSessionState, autoblowIntensity: number): Promise<ChartSessionState> {
  // Adjust chart parameters based on autoblow intensity
  const adjustedVolatility = Math.min(0.5, session.volatility + (autoblowIntensity * 0.05));
  const trendDirection = autoblowIntensity > 0.7 ? 'up' : autoblowIntensity < 0.3 ? 'down' : 'neutral';

  // Apply intensity to price movement
  const intensityMultiplier = 1 + (autoblowIntensity * 0.1); // Up to 10% additional movement
  const priceChange = (Math.random() - 0.5) * 0.02 * intensityMultiplier;
  const newPrice = Math.max(0.000001, session.currentPrice * (1 + priceChange));

  // Sync with Autoblow device if enabled
  if (AUTOBLOW_PUBLIC_ENABLED) {
    try {
      // Calculate device parameters based on chart activity and intensity
      const speed = Math.min(100, Math.max(0, Math.floor(autoblowIntensity * 100)));
      const range = 80 + (autoblowIntensity * 20); // Range from 80-100% (more active = wider range)
      const lowPoint = Math.floor((100 - range) / 2); // Calculate low point based on range
      const highPoint = Math.floor(lowPoint + range); // Calculate high point based on range

      const response = await fetch('/api/autoblow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          speed,
          minY: lowPoint,
          maxY: highPoint,
          tokenMint: session.tokenMint,
        }),
      });

      if (!response.ok) {
        console.error('Failed to sync with Autoblow device:', await response.text());
      }
    } catch (error) {
      console.error('Error syncing with Autoblow device:', error);
    }
  }

  return {
    ...session,
    currentPrice: newPrice,
    volatility: adjustedVolatility,
    trendDirection,
  };
}

export function calculateSessionProgress(session: ChartSessionState): number {
  const totalDuration = session.endTime - session.startTime;
  const elapsed = Date.now() - session.startTime;
  return Math.min(1, Math.max(0, elapsed / totalDuration));
}

export function getSessionTimeRemaining(session: ChartSessionState): number {
  return Math.max(0, session.endTime - Date.now());
}
