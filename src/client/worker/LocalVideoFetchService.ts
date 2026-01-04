import { Headers, HttpClient } from "@effect/platform";
import { Data, Effect, Fiber, Option, Ref, Stream, SubscriptionRef } from "effect";
import { LocalBlobWriterService } from "./LocalBlobWriterService";
import { parse as parseContentRange } from "content-range";
import { LocalBlobService } from "../services/LocalBlobService";

export class VideoFetchError extends Data.TaggedError("VideoFetchError")<{
  readonly reason: string;
}> {}

export class LocalVideoFetchService extends Effect.Service<LocalVideoFetchService>()("LocalVideoFetchService", {
  dependencies: [LocalBlobWriterService.Default, LocalBlobService.Default],
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const localBlobService = yield* LocalBlobService;
    const localBlobWriterService = yield* LocalBlobWriterService;

    const fetch = Effect.fn(function* (id: string, progress: SubscriptionRef.SubscriptionRef<number>) {
      const chunkSize = 1024 * 1024 * 5;

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
        const blob = yield* localBlobService.get(id);
        const initialProgress = Option.map(blob, (value) => value.size).pipe(Option.getOrElse(() => 0));

        const progress = yield* SubscriptionRef.make(initialProgress);

        return progress.changes.pipe(Stream.haltWhen(fetch(id, progress)));
      }).pipe(Stream.unwrapScoped);

    return { fetch: fetchStream };
  }),
}) {}
