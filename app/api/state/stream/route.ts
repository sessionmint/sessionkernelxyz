import { AppStateSnapshot } from '@/lib/state';
import { getAppStateSnapshotWithRevision } from '@/lib/server/stateStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;

function toSseEvent(event: string, payload: AppStateSnapshot): Uint8Array {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(message);
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let isPolling = false;
  let lastRevision = -1;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (pollTimer) clearInterval(pollTimer);
    try {
      streamController?.close();
    } catch {
      // Already closed.
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;

      const sendSnapshot = (snapshot: AppStateSnapshot) => {
        try {
          controller.enqueue(toSseEvent('state', snapshot));
        } catch {
          close();
        }
      };

      try {
        const initial = await getAppStateSnapshotWithRevision();
        lastRevision = initial.revision;
        sendSnapshot(initial.snapshot);
      } catch {
        close();
        return;
      }

      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);

      pollTimer = setInterval(() => {
        if (closed || isPolling) return;
        isPolling = true;

        void (async () => {
          try {
            const next = await getAppStateSnapshotWithRevision();
            if (next.revision !== lastRevision) {
              lastRevision = next.revision;
              sendSnapshot(next.snapshot);
            }
          } catch {
            close();
          } finally {
            isPolling = false;
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      close();
    },
  });
  request.signal.addEventListener('abort', close);

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  });
}
