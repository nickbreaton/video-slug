import { Effect, identity, Mailbox, Stream } from "effect";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { VideoSlugRpcClient } from "./DownloadClient";
import { EnhancedVideoCache } from "./EnhancedVideoCache";
import { LocalBlobService } from "./LocalBlobService";

export class LocalVideoRepository extends Effect.Service<LocalVideoRepository>()("LocalVideoRepository", {
  dependencies: [VideoSlugRpcClient.layer, EnhancedVideoCache.Default],
  scoped: Effect.gen(function* () {
    const cache = yield* EnhancedVideoCache;
    const client = yield* VideoSlugRpcClient;
    const blobService = yield* LocalBlobService;

    const mailbox = yield* Mailbox.make();
    const refresh = mailbox.offer(void 0).pipe(Effect.asVoid);

    const getFromClientCache = cache.get().pipe(
      Effect.catchAll(() => {
        return Effect.dieMessage("Failed to read from local storage");
      }),
    );

    const getFromServer = client("GetVideos", void 0).pipe(
      Effect.tap((videos) => {
        return Effect.gen(function* () {
          const ids = videos.map((video) => video.info.id);
          yield* cache.set(videos);
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

    return {
      videos,

      // TODO: update this to handle deleting from API and local
      deleteFromLocalCache: (id: string) => cache.removeItem(id),

      invalidate: refresh,
    };
  }),
}) {}
