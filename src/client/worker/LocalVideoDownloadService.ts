import { Headers, HttpClient } from "@effect/platform";
import { Console, Effect, Fiber, Option, Ref, Stream, SubscriptionRef } from "effect";
import { LocalBlobWriterService } from "./LocalBlobWriterService";
import { parse as parseContentRange } from "content-range";

export class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()(
  "LocalVideoDownloadService",
  {
    dependencies: [LocalBlobWriterService.Default],
    effect: Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const localBlobWriterService = yield* LocalBlobWriterService;

      const download = Effect.fn(function* (id: string, progress: SubscriptionRef.SubscriptionRef<number>) {
        // TODO: Consider storage quota checks before storing large video blobs
        // TODO: Implement resumability – the total size likely needs to be stored to know if resuming is needed, along with gathering the offset from the current file size

        const chunkSize = 1024 * 1024 * 5; // 5 MB

        let prevWriteFiber: Fiber.Fiber<void, "TODO_OPFSWriteError"> | undefined;

        const writeHandle = yield* localBlobWriterService.createWriteHandle(id);

        while (true) {
          const progressValue = yield* Ref.get(progress);

          const [response] = yield* Effect.all(
            [
              httpClient.get(`/api/videos/${id}`, {
                headers: {
                  Range: `bytes=${progressValue}-${progressValue + chunkSize}`,
                },
              }),
              prevWriteFiber ? Fiber.join(prevWriteFiber) : Effect.void,
            ],
            { concurrency: "unbounded" },
          );

          const contentRangeHeader = Headers.get(response.headers, "Content-Range");

          if (Option.isNone(contentRangeHeader)) {
            return yield* Effect.dieMessage("Missing content-range header");
          }

          const contentRange = parseContentRange(contentRangeHeader.value);
          const buffer = yield* response.arrayBuffer;

          // Write chunk after next network call to avoid blocking thread before initiating request
          prevWriteFiber = yield* Effect.fork(writeHandle.write(progressValue, buffer));

          const nextProgress = contentRange?.end ?? 0;

          yield* Ref.set(progress, nextProgress);

          if (nextProgress >= (contentRange?.size ?? 0)) {
            break;
          }
        }

        // In case of not iterating again ensure previous has completed
        if (prevWriteFiber) yield* Fiber.join(prevWriteFiber);
      });

      const downloadStream = (id: string) =>
        Effect.gen(function* () {
          const progress = yield* SubscriptionRef.make(0);

          const fiber = yield* Effect.fork(download(id, progress));

          return progress.changes.pipe(Stream.interruptWhen(Fiber.join(fiber)));
        }).pipe(Stream.unwrapScoped);

      return { download: downloadStream };
    }),
  },
) {}
