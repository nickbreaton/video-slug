import { Data, Effect, Option, ParseResult, Schema } from "effect";
import { EnhancedVideoInfo } from "@/schema/videos";
import { IndexedDBReadError, IndexedDBService, IndexedDBWriteError } from "./IndexedDBService";
import { LocalBlobService } from "./LocalBlobService";

export class IndexedDBParseError extends Data.TaggedError("IndexedDBParseError")<{
  cause: ParseResult.ParseError;
}> {}

// Schema for stored records (metadata only, no blob)
const StoredVideo = Schema.Struct({
  id: Schema.String,
  index: Schema.Number,
  data: EnhancedVideoInfo,
});

const StoredVideos = Schema.Array(StoredVideo);

export class LocalVideoService extends Effect.Service<LocalVideoService>()("LocalVideoService", {
  dependencies: [LocalBlobService.Default, IndexedDBService.Default],
  effect: Effect.gen(function* () {
    const db = yield* IndexedDBService;
    const localBlobService = yield* LocalBlobService;

    return {
      set: (videos: EnhancedVideoInfo[]): Effect.Effect<void, IndexedDBWriteError | IndexedDBReadError> =>
        Effect.gen(function* () {
          // Write video metadata
          yield* Effect.async<void, IndexedDBWriteError>((resume) => {
            const transaction = db.transaction("videos", "readwrite");
            const store = transaction.objectStore("videos");

            store.clear();
            videos.forEach((video, index) => {
              store.put({
                id: video.info.id,
                index,
                data: video,
              });
            });

            transaction.oncomplete = () => resume(Effect.void);
            transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
          });

          // Garbage collect blobs that no longer have corresponding videos
          const validIds = videos.map((v) => v.info.id);
          yield* localBlobService.garbageCollect(validIds);
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
