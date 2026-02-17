import { AUTOBLOW_PUBLIC_ENABLED } from '@/lib/constants';

interface AutoblowState {
  operationalMode: string;
  oscillatorTargetSpeed: number;
  oscillatorLowPoint: number;
  oscillatorHighPoint: number;
  motorTemperature: number;
}

interface OscillateParams {
  speed: number;
  minY: number;
  maxY: number;
  tokenMint?: string;
}

interface ConnectionStatus {
  connected: boolean;
  cluster?: string;
  error?: string;
}

async function readResponse<T>(response: Response): Promise<T | null> {
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

export class AutoblowService {
  async isConnected(): Promise<ConnectionStatus> {
    if (!AUTOBLOW_PUBLIC_ENABLED) {
      return { connected: false, error: 'Autoblow disabled' };
    }

    try {
      const response = await fetch('/api/autoblow', { method: 'GET' });
      const payload = await readResponse<ConnectionStatus>(response);
      if (!payload) {
        return { connected: false, error: 'Connection check failed' };
      }
      return payload;
    } catch (error) {
      return { connected: false, error: (error as Error).message };
    }
  }

  async getState(): Promise<AutoblowState | null> {
    // State endpoint is not exposed yet from /api/autoblow.
    return null;
  }

  async oscillate(params: OscillateParams): Promise<AutoblowState | null> {
    if (!AUTOBLOW_PUBLIC_ENABLED) {
      return null;
    }

    try {
      const response = await fetch('/api/autoblow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const payload = await readResponse<{ success: boolean; result?: AutoblowState }>(response);
      if (!payload?.success || !payload.result) {
        return null;
      }
      return payload.result;
    } catch {
      return null;
    }
  }

  async startOscillation(tokenMint: string = 'sessionmint'): Promise<AutoblowState | null> {
    if (!AUTOBLOW_PUBLIC_ENABLED) {
      return null;
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

      const payload = await readResponse<{ success: boolean; result?: AutoblowState }>(response);
      if (!payload?.success || !payload.result) {
        return null;
      }
      return payload.result;
    } catch {
      return null;
    }
  }

  async stopOscillation(tokenMint: string = 'sessionmint'): Promise<AutoblowState | null> {
    if (!AUTOBLOW_PUBLIC_ENABLED) {
      return null;
    }

    try {
      const response = await fetch('/api/autoblow', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenMint,
          action: 'stop',
        }),
      });

      const payload = await readResponse<{ success: boolean; result?: AutoblowState }>(response);
      if (!payload?.success || !payload.result) {
        return null;
      }
      return payload.result;
    } catch {
      return null;
    }
  }

  async startSession(tokenMint: string): Promise<boolean> {
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

      const payload = await readResponse<{ success: boolean }>(response);
      return Boolean(payload?.success);
    } catch {
      return false;
    }
  }

  async keepAlive(): Promise<boolean> {
    if (!AUTOBLOW_PUBLIC_ENABLED) {
      return false;
    }

    try {
      const response = await fetch('/api/autoblow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          speed: 10,
          minY: 45,
          maxY: 55,
          tokenMint: 'sessionmint',
        }),
      });

      const payload = await readResponse<{ success: boolean }>(response);
      return Boolean(payload?.success);
    } catch {
      return false;
    }
  }

  async stopSession(tokenMint: string = 'sessionmint'): Promise<boolean> {
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
          action: 'stop',
        }),
      });

      const payload = await readResponse<{ success: boolean }>(response);
      return Boolean(payload?.success);
    } catch {
      return false;
    }
  }

  async syncToDevice(
    speed: number,
    minY: number,
    maxY: number,
    tokenMint: string = 'sessionmint'
  ): Promise<boolean> {
    if (!AUTOBLOW_PUBLIC_ENABLED) {
      return false;
    }

    try {
      const response = await fetch('/api/autoblow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          speed,
          minY,
          maxY,
          tokenMint,
        }),
      });

      const payload = await readResponse<{ success: boolean }>(response);
      return Boolean(payload?.success);
    } catch {
      return false;
    }
  }

  async loadSyncScript(_tokenMint: string): Promise<boolean> {
    return true;
  }
}

let autoblowService: AutoblowService | null = null;

export const getAutoblowService = (): AutoblowService => {
  if (!autoblowService) {
    autoblowService = new AutoblowService();
  }
  return autoblowService;
};

