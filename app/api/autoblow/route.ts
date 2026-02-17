import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { isRateLimited } from '@/lib/server/rateLimit';
import { isValidSolanaAddress } from '@/lib/server/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ConnectionData {
  connected: boolean;
  cluster?: string;
}

interface OscillatePayload {
  speed?: number;
  minY?: number;
  maxY?: number;
  tokenMint?: string;
}

interface SessionPayload {
  tokenMint?: string;
  action?: 'start' | 'stop';
}

interface AutoblowConfig {
  enabled: boolean;
  apiUrl: string;
  deviceToken: string;
  timeoutMs: number;
}

function getAutoblowConfig(): AutoblowConfig {
  const env = getServerEnv();
  return {
    enabled: env.autoblowEnabled,
    apiUrl: env.autoblowApiUrl,
    deviceToken: env.autoblowDeviceToken,
    timeoutMs: env.autoblowTimeoutMs,
  };
}

function autoblowUnavailableResponse() {
  return NextResponse.json(
    { error: 'Autoblow not enabled or device token not configured' },
    { status: 503 }
  );
}

function serviceErrorResponse(message: string, status: number = 502) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function normalizeClusterBaseUrl(cluster: string): string | null {
  const trimmed = cluster.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function buildClusterUrl(cluster: string, path: string): string | null {
  const normalizedBaseUrl = normalizeClusterBaseUrl(cluster);
  if (!normalizedBaseUrl) return null;

  return new URL(path, `${normalizedBaseUrl}/`).toString();
}

async function fetchAutoblow(url: string, init: RequestInit): Promise<Response> {
  const { timeoutMs } = getAutoblowConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchConnection(): Promise<{
  ok: boolean;
  response?: NextResponse;
  connection?: ConnectionData;
}> {
  const { apiUrl, deviceToken } = getAutoblowConfig();
  try {
    const connectionResponse = await fetchAutoblow(`${apiUrl}/autoblow/connected`, {
      method: 'GET',
      headers: {
        'x-device-token': deviceToken,
      },
    });

    if (!connectionResponse.ok) {
      return {
        ok: false,
        response: serviceErrorResponse('Could not reach Autoblow connection service'),
      };
    }

    const connection = (await connectionResponse.json()) as ConnectionData;
    if (!connection.connected || !connection.cluster) {
      return {
        ok: false,
        response: serviceErrorResponse('Device is not connected'),
      };
    }

    return { ok: true, connection };
  } catch {
    return {
      ok: false,
      response: serviceErrorResponse('Autoblow connection request failed'),
    };
  }
}

function normalizeOscillationParams(payload: OscillatePayload): {
  speed: number;
  minY: number;
  maxY: number;
  tokenMint?: string;
} | null {
  const speed = payload.speed ?? 50;
  const minY = payload.minY ?? 0;
  const maxY = payload.maxY ?? 100;

  if (
    typeof speed !== 'number' ||
    typeof minY !== 'number' ||
    typeof maxY !== 'number' ||
    speed < 0 ||
    speed > 100 ||
    minY < 0 ||
    minY > 100 ||
    maxY < 0 ||
    maxY > 100 ||
    minY >= maxY
  ) {
    return null;
  }

  const tokenMint = payload.tokenMint?.trim();
  if (tokenMint && !isValidSolanaAddress(tokenMint)) {
    return null;
  }

  return { speed, minY, maxY, tokenMint };
}

function applyDefaultTokenAdjustment(params: {
  speed: number;
  minY: number;
  maxY: number;
  tokenMint?: string;
}): { speed: number; minY: number; maxY: number } {
  return {
    speed: params.speed,
    minY: params.minY,
    maxY: params.maxY,
  };
}

export async function GET(request: NextRequest) {
  const { enabled, deviceToken } = getAutoblowConfig();
  if (!enabled || !deviceToken) {
    return autoblowUnavailableResponse();
  }

  if (await isRateLimited(request, 'autoblow-get', 120)) {
    return serviceErrorResponse('Rate limit exceeded', 429);
  }

  const connection = await fetchConnection();
  if (!connection.ok) {
    return connection.response as NextResponse;
  }

  return NextResponse.json(connection.connection, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  const { enabled, deviceToken } = getAutoblowConfig();
  if (!enabled || !deviceToken) {
    return autoblowUnavailableResponse();
  }

  if (await isRateLimited(request, 'autoblow-post', 120)) {
    return serviceErrorResponse('Rate limit exceeded', 429);
  }

  let payload: OscillatePayload;
  try {
    payload = (await request.json()) as OscillatePayload;
  } catch {
    return serviceErrorResponse('Invalid request body', 400);
  }

  const params = normalizeOscillationParams(payload);
  if (!params) {
    return serviceErrorResponse(
      'Invalid parameters: speed (0-100), minY (0-100), maxY (0-100), tokenMint (base58)',
      400
    );
  }

  const connection = await fetchConnection();
  if (!connection.ok) {
    return connection.response as NextResponse;
  }

  const oscillateUrl = buildClusterUrl(
    (connection.connection as ConnectionData).cluster || '',
    'autoblow/oscillate'
  );
  if (!oscillateUrl) {
    return serviceErrorResponse('Invalid Autoblow cluster endpoint');
  }

  const adjusted = applyDefaultTokenAdjustment(params);
  try {
    const response = await fetchAutoblow(oscillateUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': deviceToken,
      },
      body: JSON.stringify(adjusted),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return serviceErrorResponse(
        `Autoblow oscillate command failed (${response.status}): ${
          errorText || 'no response body'
        }`
      );
    }

    const result = await response.json();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return serviceErrorResponse(
      `Autoblow oscillate command request failed: ${
        (error as Error).message || 'unknown error'
      }`
    );
  }
}

export async function PUT(request: NextRequest) {
  const { enabled, deviceToken } = getAutoblowConfig();
  if (!enabled || !deviceToken) {
    return autoblowUnavailableResponse();
  }

  if (await isRateLimited(request, 'autoblow-put', 120)) {
    return serviceErrorResponse('Rate limit exceeded', 429);
  }

  let payload: SessionPayload;
  try {
    payload = (await request.json()) as SessionPayload;
  } catch {
    return serviceErrorResponse('Invalid request body', 400);
  }

  const action = payload.action;
  if (action !== 'start' && action !== 'stop') {
    return serviceErrorResponse('Invalid action. Use: start or stop', 400);
  }

  const tokenMint = payload.tokenMint?.trim();
  if (action === 'start' && (!tokenMint || !isValidSolanaAddress(tokenMint))) {
    return serviceErrorResponse('Valid token mint is required for start action', 400);
  }

  const connection = await fetchConnection();
  if (!connection.ok) {
    return connection.response as NextResponse;
  }

  const startSessionUrl = buildClusterUrl(
    (connection.connection as ConnectionData).cluster || '',
    'autoblow/sync-script/start'
  );
  const stopSessionUrl = buildClusterUrl(
    (connection.connection as ConnectionData).cluster || '',
    'autoblow/oscillate/stop'
  );
  if (!startSessionUrl || !stopSessionUrl) {
    return serviceErrorResponse('Invalid Autoblow cluster endpoint');
  }

  try {
    if (action === 'start') {
      const response = await fetchAutoblow(startSessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken,
        },
        body: JSON.stringify({
          tokenMint,
          startTimeMs: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return serviceErrorResponse(
          `Autoblow start session command failed (${response.status}): ${
            errorText || 'no response body'
          }`
        );
      }

      const result = await response.json();
      return NextResponse.json({ success: true, result });
    }

    const response = await fetchAutoblow(stopSessionUrl, {
      method: 'PUT',
      headers: {
        'x-device-token': deviceToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return serviceErrorResponse(
        `Autoblow stop session command failed (${response.status}): ${
          errorText || 'no response body'
        }`
      );
    }

    const result = await response.json();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return serviceErrorResponse(
      `Autoblow session command request failed: ${
        (error as Error).message || 'unknown error'
      }`
    );
  }
}
