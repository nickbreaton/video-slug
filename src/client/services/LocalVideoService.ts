import { Data, Effect, Option, ParseResult, Schema } from "effect";
import { EnhancedVideoInfo } from "@/schema/videos";

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

export class IndexedDBParseError extends Data.TaggedError("IndexedDBParseError")<{
  cause: ParseResult.ParseError;
}> {}

// Schema for stored records
const Uint8ArraySchema = Schema.declare(
  (input): input is Uint8Array<ArrayBuffer> => input instanceof Uint8Array,
);

const StoredVideo = Schema.Struct({
  id: Schema.String,
  index: Schema.Number,
  data: EnhancedVideoInfo,
  blob: Schema.optionalWith(Uint8ArraySchema, { as: "Option" }),
});

const StoredVideos = Schema.Array(StoredVideo);

// Helper to open IndexedDB
const openDatabase = (): Effect.Effect<IDBDatabase, IndexedDBOpenError> =>
  Effect.async((resume) => {
    const request = indexedDB.open("dlp-ui", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resume(Effect.succeed(request.result));
    request.onerror = () => resume(Effect.fail(new IndexedDBOpenError({ cause: request.error })));
  });

export class LocalVideoService extends Effect.Service<LocalVideoService>()("LocalVideoService", {
  effect: Effect.gen(function* () {
    const db = yield* openDatabase();

    return {
      set: (videos: EnhancedVideoInfo[]): Effect.Effect<void, IndexedDBWriteError | IndexedDBReadError> =>
        Effect.gen(function* () {
          // First, read existing records to preserve blobs
          const existingBlobs = yield* Effect.async<Map<string, Uint8Array>, IndexedDBReadError>((resume) => {
            const transaction = db.transaction("videos", "readonly");
            const store = transaction.objectStore("videos");
            const request = store.getAll();

            request.onsuccess = () => {
              const blobMap = new Map<string, Uint8Array>();
              for (const record of request.result) {
                if (record.blob) blobMap.set(record.id, record.blob);
              }
              resume(Effect.succeed(blobMap));
            };
            request.onerror = () => resume(Effect.fail(new IndexedDBReadError({ cause: request.error })));
          });

          // Now write with preserved blobs
          yield* Effect.async<void, IndexedDBWriteError>((resume) => {
            const transaction = db.transaction("videos", "readwrite");
            const store = transaction.objectStore("videos");

            store.clear();
            videos.forEach((video, index) => {
              const existingBlob = existingBlobs.get(video.info.id);
              store.put({
                id: video.info.id,
                index,
                data: video,
                blob: existingBlob,
              });
            });

            transaction.oncomplete = () => resume(Effect.void);
            transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
          });
        }),

      setBlob: (id: string, blob: Uint8Array): Effect.Effect<void, IndexedDBWriteError | IndexedDBReadError> =>
        Effect.async((resume) => {
          const transaction = db.transaction("videos", "readwrite");
          const store = transaction.objectStore("videos");
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (existing) {
              existing.blob = blob;
              store.put(existing);
            }
          };

          transaction.oncomplete = () => resume(Effect.void);
          transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
        }),

      getBlob: (id: string): Effect.Effect<Option.Option<Uint8Array<ArrayBuffer>>, IndexedDBReadError> =>
        Effect.async((resume) => {
          const transaction = db.transaction("videos", "readonly");
          const store = transaction.objectStore("videos");
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

      get: (): Effect.Effect<Option.Option<EnhancedVideoInfo[]>, IndexedDBReadError | IndexedDBParseError> =>
        Effect.async<unknown[], IndexedDBReadError>((resume) => {
          const transaction = db.transaction("videos", "readonly");
          const store = transaction.objectStore("videos");
          const request = store.getAll();

          request.onsuccess = () => resume(Effect.succeed(request.result));
          request.onerror = () => resume(Effect.fail(new IndexedDBReadError({ cause: request.error })));
        }).pipe(
          Effect.flatMap((records) =>
            Schema.decodeUnknown(StoredVideos)(records).pipe(
              Effect.mapError((cause) => new IndexedDBParseError({ cause })),
            ),
          ),
          Effect.map((records) => {
            const sorted = records.toSorted((a, b) => a.index - b.index);
            const videos = sorted.map((r) => r.data);
            return videos.length === 0 ? Option.none() : Option.some(videos);
          }),
        ),
    };
  }),
}) {}
