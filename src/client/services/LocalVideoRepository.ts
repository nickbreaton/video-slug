import { Console, Data, Effect, identity, Mailbox, Option, ParseResult, Queue, Schedule, Schema, Stream } from "effect";
import { EnhancedVideoInfo } from "@/schema/videos";
// import { LocalBlobWriterService } from "./LocalBlobWriterService";
import { KeyValueStore } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { LocalBlobService } from "./LocalBlobService";
import { Reactivity } from "@effect/experimental";
import { VideoSlugRpcClient } from "./DownloadClient";

export class LocalVideoRepository extends Effect.Service<LocalVideoRepository>()("LocalVideoRepository", {
  dependencies: [BrowserKeyValueStore.layerLocalStorage, VideoSlugRpcClient.layer],
  scoped: Effect.gen(function* () {
    const kv = yield* KeyValueStore.KeyValueStore;
    const store = kv.forSchema(Schema.Array(EnhancedVideoInfo));
    const blobService = yield* LocalBlobService;
    const client = yield* VideoSlugRpcClient;

    const storageKey = "videos";

    const mailbox = yield* Mailbox.make();
    const refresh = mailbox.offer(void 0).pipe(Effect.asVoid);

    const getFromClientCache = store.get(storageKey).pipe(
      Effect.catchAll(() => {
        return Effect.dieMessage("Failed to read from local storage");
      }),
    );

    const getFromServer = client("GetVideos", void 0).pipe(
      Effect.tap((videos) => {
        return Effect.gen(function* () {
          const ids = videos.map((video) => video.info.id);
          yield* store.set(storageKey, videos);
          yield* blobService.garbageCollect(ids);
        });
      }),
      Effect.asSome,
      Effect.catchAllCause((error) => {
        console.log(
          "TODO: Throw a toast or something to inform user of error but still keep online working well",
          error,
        );
        return Effect.succeedNone;
      }),
    );

    const videos = Mailbox.toStream(mailbox).pipe(
      Stream.flatMap(
        () => {
          const fromCache = Stream.fromEffect(getFromClientCache);
          const fromServer = Stream.fromEffect(getFromServer);
          return Stream.concat(fromCache, fromServer).pipe(Stream.filterMap(identity));
        },
        { switch: true },
      ),
    );

    // Refresh once on initialization
    yield* refresh;

    // yield* refresh.pipe(Effect.repeat(Schedule.spaced("1 second")), Effect.forkDaemon);

    return {
      videos,

      // TODO: update this to handle deleting from API and local
      deleteFromLocalCache: (id: string) =>
        Effect.asVoid(store.modify(storageKey, (videos) => videos.filter((video) => video.info.id !== id))),

      invalidate: refresh,
    };
  }),
}) {}
