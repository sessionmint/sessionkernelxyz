import { App, applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { MissingServerEnvError, getServerEnv } from '@/lib/env/server';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

function resolveProjectId(): string {
  const env = getServerEnv();
  return (
    env.firebaseProjectId ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ''
  );
}

function getOrCreateApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    throw new MissingServerEnvError(['firebaseProjectId']);
  }

  const existingApp = getApps()[0];
  if (existingApp) {
    cachedApp = existingApp;
    return cachedApp;
  }

  cachedApp = initializeApp({
    credential: applicationDefault(),
    projectId,
  });
  return cachedApp;
}

export function getFirestoreDb(): Firestore {
  if (cachedDb) {
    return cachedDb;
  }

  const app = getOrCreateApp();
  const env = getServerEnv();
  cachedDb = getFirestore(app, env.firestoreDatabaseId);
  return cachedDb;
}
