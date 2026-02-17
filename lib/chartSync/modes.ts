import { SessionMode } from './types';

export const CHART_MODES: Record<string, SessionMode> = {
  'passive': {
    name: 'Passive',
    speed: 0.5,
    pattern: 'stable',
    intensity: 0.2,
  },
  'active': {
    name: 'Active',
    speed: 1.0,
    pattern: 'trend',
    intensity: 0.5,
  },
  'volatile': {
    name: 'Volatile',
    speed: 1.5,
    pattern: 'volatile',
    intensity: 0.8,
  },
  'hyper': {
    name: 'Hyper',
    speed: 2.0,
    pattern: 'random',
    intensity: 1.0,
  },
};

export function getModeByName(name: string): SessionMode | undefined {
  return CHART_MODES[name];
}

export function getDefaultMode(): SessionMode {
  return CHART_MODES['active'];
}

export function getNextMode(currentMode: string): SessionMode {
  const modeNames = Object.keys(CHART_MODES);
  const currentIndex = modeNames.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % modeNames.length;
  return CHART_MODES[modeNames[nextIndex]];
}