/**
 * IndexedDB storage for the vault and scan photos. Browser only; every read is validated by
 * the caller. Data never leaves the device.
 */

const DB_NAME = "glowtrace";
const DB_VERSION = 1;
const STATE_STORE = "state";
const PHOTO_STORE = "photos";
const VAULT_KEY = "vault";

export const storageAvailable = (): boolean =>
  typeof window !== "undefined" && typeof indexedDB !== "undefined";

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
        if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("Could not open storage"));
      };
    });
  }
  return dbPromise;
};

const store = async (name: string, mode: IDBTransactionMode) => {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
};

export const readVaultRaw = async (): Promise<unknown> =>
  requestToPromise((await store(STATE_STORE, "readonly")).get(VAULT_KEY));

export const writeVaultRaw = async (vault: unknown): Promise<void> => {
  await requestToPromise((await store(STATE_STORE, "readwrite")).put(vault, VAULT_KEY));
};

export const putPhoto = async (id: string, photo: Blob): Promise<void> => {
  await requestToPromise((await store(PHOTO_STORE, "readwrite")).put(photo, id));
};

export const deletePhoto = async (id: string): Promise<void> => {
  await requestToPromise((await store(PHOTO_STORE, "readwrite")).delete(id));
};

export const getPhotos = async (ids: readonly string[]): Promise<Map<string, Blob>> => {
  const photos = await store(PHOTO_STORE, "readonly");
  const entries = await Promise.all(
    ids.map(async (id) => [id, await requestToPromise(photos.get(id))] as const),
  );
  const result = new Map<string, Blob>();
  for (const [id, value] of entries) if (value instanceof Blob) result.set(id, value);
  return result;
};

/** Photo ids that belong to the person, not to a scan (the profile picture); never pruned. */
export const PROFILE_PHOTO_ID = "profile:avatar";

/** Remove photos that no saved scan points at any more (the profile picture always stays). */
export const prunePhotos = async (keep: ReadonlySet<string>): Promise<void> => {
  const photos = await store(PHOTO_STORE, "readwrite");
  const keys = await requestToPromise(photos.getAllKeys());
  await Promise.all(
    keys
      .filter((key) => typeof key === "string" && !keep.has(key) && !key.startsWith("profile:"))
      .map((key) => requestToPromise(photos.delete(key))),
  );
};

/** Erase everything Glowtrace stored in this browser. */
export const clearAll = async (): Promise<void> => {
  const db = await openDb();
  db.close();
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not delete storage"));
  });
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"));
    reader.readAsDataURL(blob);
  });
