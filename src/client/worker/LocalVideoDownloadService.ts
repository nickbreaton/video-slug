import { Headers, HttpClient } from "@effect/platform";
import { Effect, Fiber, Option } from "effect";
import { LocalBlobWriterService } from "./LocalBlobWriterService";
import { parse as parseContentRange } from "content-range";

export class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()(
  "LocalVideoDownloadService",
  {
    dependencies: [LocalBlobWriterService.Default],
    effect: Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const localBlobWriterService = yield* LocalBlobWriterService;

      const download = Effect.fn(function* (id: string) {
        // TODO: Consider storage quota checks before storing large video blobs

        const chunkSize = 1024 * 1024 * 5; // 10 MB

        let offset = 0;
        let prevWriteFiber: Fiber.Fiber<void, "TODO_OPFSWriteError"> | undefined;

        const writeHandle = yield* localBlobWriterService.createWriteHandle(id);

        while (true) {
          const [response] = yield* Effect.all([
            httpClient.get(`/api/videos/${id}`, {
              headers: {
                Range: `bytes=${offset}-${offset + chunkSize}`,
              },
            }),
            prevWriteFiber ? Fiber.join(prevWriteFiber) : Effect.void,
          ]);

          const contentRangeHeader = Headers.get(response.headers, "Content-Range");

          if (Option.isNone(contentRangeHeader)) {
            return yield* Effect.dieMessage("Missing content-range header");
          }

          const contentRange = parseContentRange(contentRangeHeader.value);
          const buffer = yield* response.arrayBuffer;

          // Write chunk after next network call to avoid blocking thread before initiating request
          prevWriteFiber = yield* Effect.fork(writeHandle.write(offset, buffer));

          offset = contentRange?.end ?? 0;

          if (offset >= (contentRange?.size ?? 0)) {
            break;
          }
        }

        // In case of not iterating again ensure previous has completed
        if (prevWriteFiber) yield* Fiber.join(prevWriteFiber);
      });

      return { download };
    }),
  },
) {}
