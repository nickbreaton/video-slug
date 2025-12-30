import { Data, Effect } from "effect";

// IndexedDB Error Types
export class IndexedDBOpenError extends Data.TaggedError("IndexedDBOpenError")<{
  cause: unknown;
}> {}

export class IndexedDBReadError extends Data.TaggedError("IndexedDBReadError")<{
  cause: unknown;
}> {}

export class IndexedDBWriteError extends Data.TaggedError("IndexedDBWriteError")<{
  cause: unknown;
}> {}

export class IndexedDBService extends Effect.Service<IndexedDBService>()("IndexedDBService", {
  effect: Effect.async<IDBDatabase, IndexedDBOpenError>((resume) => {
    const request = indexedDB.open("dlp-ui", 3);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "id" });
      }
      // Recreate blobs store without keyPath (out-of-line keys)
      if (db.objectStoreNames.contains("blobs")) {
        db.deleteObjectStore("blobs");
      }
      db.createObjectStore("blobs", { keyPath: "id" });
    };

    request.onsuccess = () => resume(Effect.succeed(request.result));
    request.onerror = () => resume(Effect.fail(new IndexedDBOpenError({ cause: request.error })));
  }),
}) {}
