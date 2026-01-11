import { Array, Effect, Runtime, Stream } from "effect";
import { Collection } from "@signaldb/core";
import { SyncManager } from "@signaldb/sync";
import createLocalStorageAdapter from "@signaldb/localstorage";
import { EnhancedVideoInfo } from "@/schema/videos";
import { VideoSlugRpcClient } from "./DownloadClient";

export class LocalVideoCollection extends Effect.Service<LocalVideoCollection>()("LocalVideoCollection", {
  dependencies: [VideoSlugRpcClient.layer],
  effect: Effect.gen(function* () {
    const runtime = yield* Effect.runtime();
    const client = yield* VideoSlugRpcClient;

    const collection = new Collection<EnhancedVideoInfo>({
      persistence: createLocalStorageAdapter("videos"),
    });

    const syncManager = new SyncManager({
      persistenceAdapter: (name) => createLocalStorageAdapter(`sync_${name}`),

      pull: () =>
        Effect.gen(function* () {
          const response = yield* client("GetVideos", void 0);
          return { items: Array.fromIterable(response) };
        }).pipe(Runtime.runPromise(runtime)),

      push: (_, { changes }) =>
        Effect.gen(function* () {
          const mutations = changes.removed.map(({ id }) => client("DeleteVideo", { id }));
          yield* Effect.all(mutations, { concurrency: "unbounded" });
        }).pipe(Runtime.runPromise(runtime)),
    });

    const videos = Stream.asyncEffect<EnhancedVideoInfo[], "TODO_FetchVideoError">(
      (emit) => {
        const exec = () => emit.single(collection.find().fetch());

        collection
          .isReady()
          .then(() => exec())
          .catch(() => emit.fail("TODO_FetchVideoError"));

        collection.on("added", exec);
        collection.on("changed", exec);
        collection.on("removed", exec);

        return Effect.sync(() => {
          collection.off("added", exec);
          collection.off("changed", exec);
          collection.off("removed", exec);
        });
      },
      { strategy: "dropping" },
    );
    syncManager.addCollection(collection, {
      name: "videos",
    });

    // Begin sycning on startup
    syncManager.syncAll();

    return {
      videos,
    };
  }),
}) {}
