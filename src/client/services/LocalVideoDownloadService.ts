import { HttpClient } from "@effect/platform";
import { Effect } from "effect";
import { LocalBlobService } from "./LocalBlobService";

export class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()("LocalVideoDownloadService", {
  dependencies: [LocalBlobService.Default],
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const localBlobService = yield* LocalBlobService;

    const download = Effect.fn(function* (id: string) {
      // TODO: Consider storage quota checks before storing large video blobs
      const response = yield* httpClient.get(`/api/videos/${id}`);
      const buffer = yield* response.arrayBuffer;
      const blob = new Uint8Array(buffer);

      yield* localBlobService.set(id, blob);
    });

    return { download };
  }),
}) {}
