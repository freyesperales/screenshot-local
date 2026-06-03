import type { DraftRecord, Op } from "./types";

const DB_NAME = "screenshot-local";
const STORE = "drafts";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(args: {
  imageBlob: Blob;
  ops: Op[];
  width: number;
  height: number;
}): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const record: DraftRecord = {
        id: "current",
        imageBlob: args.imageBlob,
        ops: args.ops,
        width: args.width,
        height: args.height,
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore – persistence is best-effort
  }
}

export async function loadDraft(): Promise<DraftRecord | null> {
  try {
    const db = await openDb();
    const record = await new Promise<DraftRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get("current");
      req.onsuccess = () => resolve((req.result as DraftRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!record) return null;
    if (Date.now() - record.updatedAt > SEVEN_DAYS_MS) {
      await clearDraft();
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
