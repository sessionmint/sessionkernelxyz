// ChartSync and Autoblow integration helpers.
// These helpers intentionally call our own API route so the Autoblow device token
// remains server-side and is never exposed in the browser bundle.

import { AUTOBLOW_PUBLIC_ENABLED } from '@/lib/constants';

async function parseApiResponse(response: Response): Promise<boolean> {
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ChartSync] Autoblow API route error:', errorText);
    return false;
  }

  const payload = (await response.json()) as { success?: boolean; connected?: boolean };
  if (typeof payload.success === 'boolean') {
    return payload.success;
  }

  if (typeof payload.connected === 'boolean') {
    return payload.connected;
  }

  return true;
}

type MotionStyle = 'surge' | 'chop' | 'wave' | 'drift';

interface MotionState {
  phase: number;
  style: MotionStyle;
  nextSwitchAt: number;
  burstUntil: number;
}

const MOTION_STYLES: MotionStyle[] = ['surge', 'chop', 'wave', 'drift'];
const motionStateByToken = new Map<string, MotionState>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickNextStyle(current: MotionStyle): MotionStyle {
  const options = MOTION_STYLES.filter((style) => style !== current);
  return options[Math.floor(Math.random() * options.length)] || current;
}

function getMotionState(tokenMint: string): MotionState {
  const tokenKey = tokenMint || 'sessionmint';
  const existing = motionStateByToken.get(tokenKey);
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const next: MotionState = {
    phase: randomBetween(0, Math.PI * 2),
    style: MOTION_STYLES[Math.floor(Math.random() * MOTION_STYLES.length)] || 'wave',
    nextSwitchAt: now + randomBetween(4500, 9000),
    burstUntil: 0,
  };
  motionStateByToken.set(tokenKey, next);
  return next;
}

function buildMotionProfile(activity: number, tokenMint: string): {
  speed: number;
  minY: number;
  maxY: number;
} {
  const state = getMotionState(tokenMint);
  const now = Date.now();

  if (now >= state.nextSwitchAt) {
    state.style = pickNextStyle(state.style);
    state.nextSwitchAt = now + randomBetween(4500, 12000);
  }

  state.phase = (state.phase + 0.22 + activity * 0.4) % (Math.PI * 2);

  if (now > state.burstUntil && Math.random() < 0.025 + activity * 0.03) {
    state.burstUntil = now + randomBetween(900, 2200);
  }

  const wave = Math.sin(state.phase);
  const fastWave = Math.sin(state.phase * 2.7);
  const jitter = (Math.random() - 0.5) * 0.22;

  let styleModulation = 0;
  switch (state.style) {
    case 'surge':
      styleModulation = 0.24 * wave + 0.12 * fastWave + 0.08 * jitter;
      break;
    case 'chop':
      styleModulation = 0.18 * Math.sign(fastWave) + 0.1 * jitter;
      break;
    case 'drift':
      styleModulation = 0.12 * Math.sin(state.phase * 0.45) + 0.08 * wave + 0.06 * jitter;
      break;
    case 'wave':
    default:
      styleModulation = 0.2 * wave + 0.09 * Math.sin(state.phase * 0.55);
      break;
  }

  const burstModulation = now < state.burstUntil ? 0.22 : 0;
  const dynamicActivity = clamp(activity + styleModulation + burstModulation, 0, 1);

  const speed = Math.round(clamp(12 + dynamicActivity * 88, 0, 100));
  const baseRange = 44 + dynamicActivity * 48;
  const pulseRange = Math.abs(fastWave) * (8 + dynamicActivity * 10);
  const range = clamp(baseRange + pulseRange, 26, 98);
  const centerSwing = 6 + dynamicActivity * 12;
  const center = clamp(50 + wave * centerSwing + jitter * 8, 10, 90);

  let minY = Math.floor(clamp(center - range / 2, 0, 96));
  let maxY = Math.floor(clamp(center + range / 2, 4, 100));

  if (maxY - minY < 8) {
    const shortfall = 8 - (maxY - minY);
    minY = Math.max(0, minY - shortfall);
    maxY = Math.min(100, maxY + shortfall);
  }

  if (minY >= maxY) {
    minY = 20;
    maxY = 80;
  }

  return { speed, minY, maxY };
}

// Sync chart activity to Autoblow device.
export async function syncChartToAutoblow(
  tokenMint: string,
  chartActivityLevel: number
): Promise<boolean> {
  if (!AUTOBLOW_PUBLIC_ENABLED) {
    return false;
  }

  const clampedActivity = Math.min(1, Math.max(0, chartActivityLevel));
  const motion = buildMotionProfile(clampedActivity, tokenMint);

  try {
    const response = await fetch('/api/autoblow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        speed: motion.speed,
        minY: motion.minY,
        maxY: motion.maxY,
        tokenMint,
      }),
    });

    return parseApiResponse(response);
  } catch (error) {
    console.error('[ChartSync] Error syncing chart to Autoblow device:', error);
    return false;
  }
}

// Start Autoblow session for a token.
export async function startAutoblowSession(tokenMint: string): Promise<boolean> {
  if (!AUTOBLOW_PUBLIC_ENABLED) {
    return false;
  }

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

    return parseApiResponse(response);
  } catch (error) {
    console.error('[ChartSync] Error starting Autoblow session:', error);
    return false;
  }
}

// Stop Autoblow session.
export async function stopAutoblowSession(): Promise<boolean> {
  if (!AUTOBLOW_PUBLIC_ENABLED) {
    return false;
  }

  try {
    const response = await fetch('/api/autoblow', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'stop',
      }),
    });

    return parseApiResponse(response);
  } catch (error) {
    console.error('[ChartSync] Error stopping Autoblow session:', error);
    return false;
  }
}
