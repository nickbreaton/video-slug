import { Effect, Option } from "effect";
import { IndexedDBReadError, IndexedDBService, IndexedDBWriteError } from "./IndexedDBService";

export class LocalBlobService extends Effect.Service<LocalBlobService>()("LocalBlobService", {
  dependencies: [IndexedDBService.Default],
  effect: Effect.gen(function* () {
    const db = yield* IndexedDBService;

    return {
      set: (id: string, blob: Uint8Array): Effect.Effect<void, IndexedDBWriteError> =>
        Effect.async((resume) => {
          console.log(id, blob);
          const transaction = db.transaction("blobs", "readwrite");
          const store = transaction.objectStore("blobs");

          store.put({ id, blob });

          transaction.oncomplete = () => resume(Effect.void);
          transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
        }),

      get: (id: string): Effect.Effect<Option.Option<Uint8Array<ArrayBuffer>>, IndexedDBReadError> =>
        Effect.async((resume) => {
          const transaction = db.transaction("blobs", "readonly");
          const store = transaction.objectStore("blobs");
          const request = store.get(id);

          request.onsuccess = () => {
            const record = request.result;
            if (record?.blob) {
              resume(Effect.succeed(Option.some(record.blob)));
            } else {
              resume(Effect.succeed(Option.none()));
            }
          };
          request.onerror = () => resume(Effect.fail(new IndexedDBReadError({ cause: request.error })));
        }),

      garbageCollect: (validIds: string[]): Effect.Effect<void, IndexedDBWriteError | IndexedDBReadError> =>
        Effect.gen(function* () {
          const validIdSet = new Set(validIds);

          // Get all blob IDs currently stored
          const storedIds = yield* Effect.async<string[], IndexedDBReadError>((resume) => {
            const transaction = db.transaction("blobs", "readonly");
            const store = transaction.objectStore("blobs");
            const request = store.getAllKeys();

            request.onsuccess = () => {
              resume(Effect.succeed(request.result as string[]));
            };
            request.onerror = () => resume(Effect.fail(new IndexedDBReadError({ cause: request.error })));
          });

          // Find IDs to delete (those not in validIds)
          const idsToDelete = storedIds.filter((id) => !validIdSet.has(id));

          if (idsToDelete.length === 0) return;

          // Delete invalid blobs
          yield* Effect.async<void, IndexedDBWriteError>((resume) => {
            const transaction = db.transaction("blobs", "readwrite");
            const store = transaction.objectStore("blobs");

            for (const id of idsToDelete) {
              store.delete(id);
            }

            transaction.oncomplete = () => resume(Effect.void);
            transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
          });
        }),
    };
  }),
}) {}
