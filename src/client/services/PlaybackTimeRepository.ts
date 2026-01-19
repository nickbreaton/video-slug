import { KeyValueStore } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Effect, Option, Schema } from "effect";

interface PlaybackTimeEntry {
  readonly time: number;
  readonly updatedAt: number;
}

const PlaybackTimeEntrySchema = Schema.Struct({
  time: Schema.Number,
  updatedAt: Schema.Number,
});

export class PlaybackTimeRepository extends Effect.Service<PlaybackTimeRepository>()("PlaybackTimeRepository", {
  dependencies: [BrowserKeyValueStore.layerLocalStorage],
  effect: Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore;
    const store = kv.forSchema(PlaybackTimeEntrySchema);

    const key = (id: string) => `playback-time:${id}`;

    return {
      setPlaybackTime: Effect.fn(function* (id: string, time: number) {
        const entry: PlaybackTimeEntry = { time, updatedAt: Date.now() };
        yield* store.set(key(id), entry);
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
