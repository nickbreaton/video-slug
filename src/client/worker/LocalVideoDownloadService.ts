import { Headers, HttpClient } from "@effect/platform";
import { Effect, Option } from "effect";
import { LocalBlobService } from "./LocalBlobService";
import { parse as parseContentRange } from "content-range";

export class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()(
  "LocalVideoDownloadService",
  {
    dependencies: [LocalBlobService.Default],
    effect: Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const localBlobService = yield* LocalBlobService;

      const download = Effect.fn(function* (id: string) {
        // TODO: Consider storage quota checks before storing large video blobs

        const chunkSize = 1024 * 1024 * 25; // 25 MB

        let offset = 0;
        const writeHandle = yield* localBlobService.createWriteHandle(id);

        while (true) {
          const response = yield* httpClient.get(`/api/videos/${id}`, {
            headers: {
              Range: `bytes=${offset}-${offset + chunkSize}`,
            },
          });

          const contentRangeHeader = Headers.get(response.headers, "Content-Range");

          if (Option.isNone(contentRangeHeader)) {
            return yield* Effect.dieMessage("Missing content-range header");
          }

          const contentRange = parseContentRange(contentRangeHeader.value);
          const buffer = yield* response.arrayBuffer;

          yield* writeHandle.write(offset, buffer);

          offset = contentRange?.end ?? 0;

          if (!contentRange || (contentRange.end ?? 0) >= (contentRange.size ?? 0)) {
            break;
          }
        }

        const blob = yield* Effect.promise(() => writeHandle.fileHandle.getFile());
        return URL.createObjectURL(blob);

        // const blob = new Blob(buffer);
      });

      return { download };
    }),
  },
) {}
