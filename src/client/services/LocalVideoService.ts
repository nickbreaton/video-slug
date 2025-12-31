import { Data, Effect, Option, ParseResult, Schema } from "effect";
import { EnhancedVideoInfo } from "@/schema/videos";
// import { LocalBlobWriterService } from "./LocalBlobWriterService";
import { KeyValueStore } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { LocalBlobService } from "./LocalBlobService";

export class LocalVideoService extends Effect.Service<LocalVideoService>()("LocalVideoService", {
  dependencies: [BrowserKeyValueStore.layerLocalStorage],
  effect: Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore;
    const store = kv.forSchema(Schema.Array(EnhancedVideoInfo));
    const blobService = yield* LocalBlobService;

    const key = "videos";

    return {
      set: (videos: EnhancedVideoInfo[]) =>
        Effect.gen(function* () {
          const ids = videos.map((video) => video.info.id);
          yield* store.set(key, videos);
          yield* blobService.garbageCollect(ids);
        }),

      get: () => store.get(key).pipe(Effect.catchAll(() => Effect.dieMessage("Failed to read from local storage"))),
    };
  }),
}) {}
