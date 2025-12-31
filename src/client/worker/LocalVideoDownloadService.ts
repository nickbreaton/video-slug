import { Headers, HttpClient } from "@effect/platform";
import { Data, Effect, Fiber, Option, Ref, Stream, SubscriptionRef } from "effect";
import { LocalBlobWriterService } from "./LocalBlobWriterService";
import { parse as parseContentRange } from "content-range";
import { LocalBlobService } from "../services/LocalBlobService";

// Cloneable error for crossing worker boundary
export class VideoDownloadError extends Data.TaggedError("VideoDownloadError")<{
  readonly reason: string;
}> {}

export class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()(
  "LocalVideoDownloadService",
  {
    dependencies: [LocalBlobWriterService.Default, LocalBlobService.Default],
    effect: Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const localBlobService = yield* LocalBlobService;
      const localBlobWriterService = yield* LocalBlobWriterService;

      const download = Effect.fn(function* (id: string, progress: SubscriptionRef.SubscriptionRef<number>) {
        // TODO: Consider storage quota checks before storing large video blobs

        const chunkSize = 1024 * 1024 * 5; // 5 MB

        let prevWriteFiber: Fiber.Fiber<void, "TODO_OPFSWriteError"> | undefined;

        const writeHandle = yield* localBlobWriterService.createWriteHandle(id);

        while (true) {
          const progressValue = yield* Ref.get(progress);

          const [response] = yield* Effect.all(
            [
              httpClient
                .get(`/api/videos/${id}`, {
                  headers: {
                    Range: `bytes=${progressValue}-${progressValue + chunkSize}`,
                  },
                })
                .pipe(
                  // Convert non-cloneable HttpClientError to cloneable VideoDownloadError
                  Effect.mapError((error) => new VideoDownloadError({ reason: error.message })),
                ),
              prevWriteFiber ? Fiber.join(prevWriteFiber) : Effect.void,
            ],
            { concurrency: "unbounded" },
          );

          const contentRangeHeader = Headers.get(response.headers, "Content-Range");

          if (Option.isNone(contentRangeHeader)) {
            return yield* Effect.fail(new VideoDownloadError({ reason: "Missing content-range header" }));
          }

          const contentRange = parseContentRange(contentRangeHeader.value);
          const buffer = yield* response.arrayBuffer.pipe(
            Effect.mapError((error) => new VideoDownloadError({ reason: error.message })),
          );

          yield* writeHandle.write(progressValue, buffer);

          // end is inclusive (last byte index), so next position is end + 1
          const nextProgress = (contentRange?.end ?? 0) + 1;
          const totalSize = contentRange?.size ?? 0;

          yield* Ref.set(progress, nextProgress);

          if (nextProgress >= totalSize) {
            break;
          }
        }

        // In case of not iterating again ensure previous has completed
        if (prevWriteFiber) yield* Fiber.join(prevWriteFiber);
      });

      const downloadStream = (id: string) =>
        Effect.gen(function* () {
          const blob = yield* localBlobService.get(id);
          const initialProgress = Option.map(blob, (value) => value.size).pipe(Option.getOrElse(() => 0));

          const progress = yield* SubscriptionRef.make(initialProgress);

          const fiber = yield* Effect.fork(download(id, progress));

          return progress.changes.pipe(Stream.interruptWhen(Fiber.join(fiber)));
        }).pipe(Stream.unwrapScoped);

      return { download: downloadStream };
    }),
  },
) {}
