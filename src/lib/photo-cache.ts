/**
 * Local (IndexedDB) cache of meal photo thumbnails.
 *
 * The diary stores small JPEG thumbs in Vercel Blob; caching the blobs
 * client-side keeps the diary instant and offline-friendly. Everything here
 * is best-effort: private browsing, quota errors, or a blocked DB degrade to
 * a plain network fetch and never surface an error to callers.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "calorai-photos";
const DB_VERSION = 1;
const STORE = "photos";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null; // SSR / non-browser env
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
  return dbPromise;
}

/** Store a meal photo blob locally. Never throws. */
export async function cacheMealPhoto(
  mealId: string,
  blob: Blob,
): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    const handle = await db;
    await handle.put(STORE, blob, mealId);
  } catch {
    // Quota/private-mode/upgrade failures: the remote URL still works.
  }
}

/** Return the cached blob for a meal, or null on miss/failure. */
export async function getCachedMealPhoto(mealId: string): Promise<Blob | null> {
  try {
    const db = getDb();
    if (!db) return null;
    const handle = await db;
    // Untyped store: the value generic isn't available here.
    const blob = (await handle.get(STORE, mealId)) as Blob | undefined;
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

/** Drop a meal's cached photo (e.g. after the meal was deleted). */
export async function evictMealPhoto(mealId: string): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    const handle = await db;
    await handle.delete(STORE, mealId);
  } catch {
    // Nothing to do — eviction is opportunistic by definition.
  }
}
