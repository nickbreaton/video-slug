import { FetchHttpClient } from "@effect/platform";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Cause, Console, Effect, Layer, Option, Stream } from "effect";
import { Atom } from "@effect-atom/atom-react";
import { Reactivity } from "@effect/experimental";
import { EnhancedVideoInfo } from "@/schema/videos";
import { LocalVideoRepository } from "../services/LocalVideoRepository";
import { VideoSlugRpcClient } from "../services/DownloadClient";
import { LocalBlobService } from "../services/LocalBlobService";
import { RpcClient } from "@effect/rpc";
import { WorkerRpcs } from "@/schema/worker";
import WorkerModule from "../worker/main.ts?worker";

export const runtime = Atom.runtime(
  VideoSlugRpcClient.layer.pipe(
    Layer.merge(Layer.orDie(LocalVideoRepository.Default)),
    Layer.provide(FetchHttpClient.layer),
    Layer.provideMerge(LocalBlobService.Default),
  ),
);

export const videosAtom = runtime.atom(() => {
  return LocalVideoRepository.pipe(
    Effect.andThen((repo) => repo.videos),
    Stream.unwrap,
  );
});

export const downloadAtom = runtime.fn(
  Effect.fnUntraced(
    function* (url: string) {
      const client = yield* VideoSlugRpcClient;
      const localVideoRepository = yield* LocalVideoRepository;

      // TODO: move this into the repository
      const videoInfo = yield* client("SaveVideo", {
        url: new URL(url),
      });

      yield* localVideoRepository.invalidate;

      return videoInfo;
    },
    Effect.tapErrorCause((err) => Console.log("Failed to download video", Cause.pretty(err))),
  ),
);

export const getVideoByIdAtom = Atom.family((id: string) => {
  return runtime.atom((get) => {
    return get.streamResult(videosAtom).pipe(
      Stream.map((videos) => videos.find((v) => v.info.id === id)),
      Stream.filter((v): v is EnhancedVideoInfo => v !== undefined),
    );
  });
});

export const getDownloadProgressByIdAtom = Atom.family((id: string | null) => {
  return runtime.atom(
    id == null
      ? Stream.empty
      : Effect.gen(function* () {
          const client = yield* VideoSlugRpcClient;
          return client("GetDownloadProgress", { id });
        }).pipe(Stream.unwrap, Stream.onEnd(Reactivity.invalidate(["videos"]))),
  );
});

export const getLocalDownloadProgressAtom = Atom.family((video: EnhancedVideoInfo) => {
  return runtime
    .atom(
      Effect.gen(function* () {
        const localBlobService = yield* LocalBlobService;
        const file = yield* localBlobService.get(video.info.id);

        if (Option.isNone(file) || !video.totalBytes) {
          return 0;
        }

        return Math.round((file.value.size / video.totalBytes) * 100);
      }),
    )
    .pipe(Atom.withReactivity(["download", video.info.id]));
});

export const openLocalVideoAtom = runtime.fn((id: string) => {
  return Effect.gen(function* () {
    const localBlobService = yield* LocalBlobService;

    const blob = yield* localBlobService.get(id);

    if (Option.isSome(blob)) {
      const video = document.createElement("video");
      video.controls = true;
      document.body.appendChild(video);
      video.src = URL.createObjectURL(blob.value);
    }
  });
});

export const localVideoUrl = Atom.family((id: string) => {
  return runtime.atom(() => {
    return Effect.gen(function* () {
      const localBlobService = yield* LocalBlobService;
      const blob = yield* localBlobService.get(id);

      if (Option.isSome(blob)) {
        const url = URL.createObjectURL(blob.value);
        yield* Effect.addFinalizer(() => Effect.sync(() => URL.revokeObjectURL(url)));
        return url;
      }

      return null;
    });
  });
});

export const deleteLocalVideoAtom = runtime.fn((id: string) => {
  return Effect.gen(function* () {
    const localBlobService = yield* LocalBlobService;
    yield* localBlobService.delete(id);
    yield* Reactivity.invalidate(["download", id]);
  });
});

export const videoDownloadAtom = Atom.family((id: string) => {
  return runtime.fn(() => {
    return Effect.gen(function* () {
      const protocol = yield* RpcClient.makeProtocolWorker({ size: 1 });
      const client = yield* RpcClient.make(WorkerRpcs).pipe(
        Effect.provide(Layer.succeed(RpcClient.Protocol, protocol)),
      );
      const stream = client.FetchVideo({ id });
      return stream.pipe(Stream.tap(() => Reactivity.invalidate(["download", id])));
    }).pipe(Effect.provide(BrowserWorker.layerPlatform(() => new WorkerModule())), Stream.unwrapScoped);
  });
});

export const deleteFromLibraryAtom = Atom.family((id: string) => {
  return runtime.fn(() => {
    return Effect.gen(function* () {
      if (!window.confirm("Are you sure you want to permanently remove this video from your library?")) {
        return;
      }
      const client = yield* VideoSlugRpcClient;
      const localVideoRepository = yield* LocalVideoRepository;
      yield* Atom.set(deleteLocalVideoAtom, id);
      yield* localVideoRepository.deleteFromLocalCache(id);
      yield* client("DeleteVideo", { id });
      yield* localVideoRepository.invalidate;
    });
  });
});
