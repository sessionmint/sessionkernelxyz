import { CloudTasksClient } from '@google-cloud/tasks';
import { TickReason } from '@/lib/server/stateTypes';
import { MissingServerEnvError, assertServerEnv, getServerEnv } from '@/lib/env/server';

let tasksClient: CloudTasksClient | null = null;

function getTasksClient(): CloudTasksClient {
  if (!tasksClient) {
    tasksClient = new CloudTasksClient();
  }
  return tasksClient;
}

function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

export interface ScheduleStateTickTaskInput {
  executeAtMs: number;
  origin: string;
  reason?: TickReason;
}

export async function scheduleStateTickTask(
  input: ScheduleStateTickTaskInput
): Promise<boolean> {
  try {
    assertServerEnv(['firebaseProjectId', 'googleCloudRegion', 'stateTickQueueId', 'cronSecret']);
  } catch (error) {
    if (error instanceof MissingServerEnvError) {
      console.warn(
        `[state-tick-task] skipped scheduling because env is missing: ${error.keys.join(', ')}`
      );
      return false;
    }
    throw error;
  }

  const env = getServerEnv();
  const client = getTasksClient();
  const parent = client.queuePath(
    env.firebaseProjectId,
    env.googleCloudRegion,
    env.stateTickQueueId
  );
  const url = `${normalizeOrigin(input.origin)}/api/state/tick`;

  const body = Buffer.from(
    JSON.stringify({
      reason: input.reason || 'cloud-task',
    })
  ).toString('base64');

  try {
    const [response] = await client.createTask({
      parent,
      task: {
        scheduleTime: {
          seconds: Math.floor(input.executeAtMs / 1000),
          nanos: (input.executeAtMs % 1000) * 1_000_000,
        },
        httpRequest: {
          httpMethod: 'POST',
          url,
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': env.cronSecret,
          },
          body,
        },
      },
    });

    return Boolean(response.name);
  } catch (error) {
    console.warn(
      `[state-tick-task] failed to schedule task for ${new Date(
        input.executeAtMs
      ).toISOString()}: ${(error as Error).message}`
    );
    return false;
  }
}
