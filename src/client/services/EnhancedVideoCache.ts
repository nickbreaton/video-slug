import { EnhancedVideoInfo } from "@/schema/videos";
import { KeyValueStore } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Context, Effect, Layer, Option, Schema } from "effect";

export class EnhancedVideoCache extends Effect.Service<EnhancedVideoCache>()("EnhancedVideoCache", {
  dependencies: [BrowserKeyValueStore.layerLocalStorage],
  effect: Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore;
    const store = kv.forSchema(Schema.Array(EnhancedVideoInfo));
    const storageKey = "videos";

    return {
      get: () => store.get(storageKey),

      set: Effect.fn(function* (info: readonly EnhancedVideoInfo[]) {
        yield* Effect.asVoid(store.set(storageKey, info));
      }),

      removeItem: Effect.fn(function* (id: string) {
        yield* store.modify(storageKey, (videos) => {
          return videos.filter((video) => video.info.id !== id);
        });
      }),
    };
  }),
}) {}
