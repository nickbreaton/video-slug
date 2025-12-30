import { HttpClient } from "@effect/platform";
import { Effect } from "effect";
import { LocalVideoService } from "./LocalVideoService";

export class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()("LocalVideoDownloadService", {
  dependencies: [LocalVideoService.Default],
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const localVideoService = yield* LocalVideoService;

    const download = Effect.fn(function* (id: string) {
      // TODO: Consider storage quota checks before storing large video blobs
      const response = yield* httpClient.get(`/api/videos/${id}`);
      const buffer = yield* response.arrayBuffer;
      const blob = new Uint8Array(buffer);

      yield* localVideoService.setBlob(id, blob);
    });

    return { download };
  }),
}) {}
