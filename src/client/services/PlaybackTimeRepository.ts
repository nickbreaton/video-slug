import { KeyValueStore } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Effect, Option } from "effect";
import { PlaybackTimeEntry } from "@/schema/videos";
import { VideoSlugRpcClient } from "./VideoSlugRpcClient";

export class PlaybackTimeRepository extends Effect.Service<PlaybackTimeRepository>()("PlaybackTimeRepository", {
  dependencies: [BrowserKeyValueStore.layerLocalStorage, VideoSlugRpcClient.layer],
  effect: Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore;
    const store = kv.forSchema(PlaybackTimeEntry);
    const rpc = yield* VideoSlugRpcClient;

    const key = (id: string) => `playback-time:${id}`;

    return {
      setPlaybackTime: Effect.fn(function* (id: string, time: number) {
        const value = PlaybackTimeEntry.make({ time, updatedAt: Date.now() });
        yield* store.set(key(id), value);

        // TODO: error here
        yield* rpc("UpdateTimestamp", { id, value });
      }),

      getPlaybackTime: Effect.fn(function* (id: string) {
        const entry = yield* store.get(key(id));
        return entry.pipe(
          Option.map((value) => value.time),
          Option.getOrElse(() => 0),
        );
      }),
    };
  }),
}) {}
