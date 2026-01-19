import { Headers, HttpClient } from "@effect/platform";
import { Data, Effect, Fiber, Option, Ref, Stream, SubscriptionRef } from "effect";
import { BlobWriterService } from "./BlobWriterService";
import { parse as parseContentRange } from "content-range";
import { BlobService } from "../services/BlobService";

export class VideoFetchError extends Data.TaggedError("VideoFetchError")<{
  readonly reason: string;
}> {}

export class VideoFetchService extends Effect.Service<VideoFetchService>()("VideoFetchService", {
  dependencies: [BlobWriterService.Default, BlobService.Default],
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const blobService = yield* BlobService;
    const blobWriterService = yield* BlobWriterService;

    const fetch = Effect.fn(function* (id: string, progress: SubscriptionRef.SubscriptionRef<number>) {
      const chunkSize = 1024 * 1024; // 1 MB

      let prevWriteFiber: Fiber.Fiber<void, "TODO_OPFSWriteError"> | undefined;

      const writeHandle = yield* blobWriterService.createWriteHandle(id);

      while (true) {
        const progressValue = yield* Ref.get(progress);

        const [response] = yield* Effect.all(
          [
            httpClient
              .get(`/api/video/${id}`, {
                headers: {
                  Range: `bytes=${progressValue}-${progressValue + chunkSize}`,
                  "Cache-Control": "no-store",
                },
              })
              .pipe(Effect.mapError((error) => new VideoFetchError({ reason: error.message }))),
            prevWriteFiber ? Fiber.join(prevWriteFiber) : Effect.void,
          ],
          { concurrency: "unbounded" },
        );

        const contentRangeHeader = Headers.get(response.headers, "Content-Range");

        if (Option.isNone(contentRangeHeader)) {
          return yield* Effect.fail(new VideoFetchError({ reason: "Missing content-range header" }));
        }

        const contentRange = parseContentRange(contentRangeHeader.value);
        const buffer = yield* response.arrayBuffer.pipe(
          Effect.mapError((error) => new VideoFetchError({ reason: error.message })),
        );

        yield* writeHandle.write(progressValue, buffer);

        const nextProgress = (contentRange?.end ?? 0) + 1;
        const totalSize = contentRange?.size ?? 0;

        yield* Ref.set(progress, nextProgress);

        if (nextProgress >= totalSize) {
          break;
        }
      }

      if (prevWriteFiber) yield* Fiber.join(prevWriteFiber);
    });

    const fetchStream = (id: string) =>
      Effect.gen(function* () {
        const blob = yield* blobService.get(id);
        const initialProgress = Option.map(blob, (value) => value.size).pipe(Option.getOrElse(() => 0));

        const progress = yield* SubscriptionRef.make(initialProgress);

        return progress.changes.pipe(Stream.haltWhen(fetch(id, progress)));
      }).pipe(Stream.unwrapScoped);

    return { fetch: fetchStream };
  }),
}) {}
