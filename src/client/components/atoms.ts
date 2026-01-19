import { FetchHttpClient } from "@effect/platform";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Cause, Console, Effect, Layer, Option, Stream } from "effect";
import { Atom } from "@effect-atom/atom-react";
import { Reactivity } from "@effect/experimental";
import { EnhancedVideoInfo } from "@/schema/videos";
import { VideoRepository } from "../services/VideoRepository";
import { VideoSlugRpcClient } from "../services/DownloadClient";
import { BlobService } from "../services/BlobService";
import { RpcClient } from "@effect/rpc";
import { WorkerRpcs } from "@/schema/worker";
import { VideoDownloadWorkerService } from "../services/VideoDownloadWorkerService";
import { PlaybackTimeRepository } from "../services/PlaybackTimeRepository";

export const runtime = Atom.runtime(
  VideoSlugRpcClient.layer.pipe(
    Layer.merge(Layer.orDie(VideoRepository.Default)),
    Layer.merge(VideoDownloadWorkerService.Default),
    Layer.merge(PlaybackTimeRepository.Default),
    Layer.provide(FetchHttpClient.layer),
    Layer.provideMerge(BlobService.Default),
  ),
);

export const videosAtom = runtime.atom(() => {
  return VideoRepository.pipe(
    Effect.andThen((repo) => repo.videos),
    Stream.unwrap,
  );
});

export const downloadAtom = runtime.fn(
  Effect.fnUntraced(
    function* (url: string) {
      const client = yield* VideoSlugRpcClient;
      const videoRepository = yield* VideoRepository;

      // TODO: move this into the repository
      const videoInfo = yield* client("SaveVideo", {
        url: new URL(url),
      });

      yield* videoRepository.invalidate;

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
        const blobService = yield* BlobService;
        const file = yield* blobService.get(video.info.id);

        if (Option.isNone(file) || Option.isNone(video.totalBytes)) {
          return 0;
        }

        return Math.round((file.value.size / video.totalBytes.value) * 100);
      }),
    )
    .pipe(Atom.withReactivity(["download", video.info.id]));
});

export const openLocalVideoAtom = runtime.fn((id: string) => {
  return Effect.gen(function* () {
    const blobService = yield* BlobService;

    const blob = yield* blobService.get(id);

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
      const blobService = yield* BlobService;
      const blob = yield* blobService.get(id);

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
    const blobService = yield* BlobService;
    yield* blobService.delete(id);
    yield* Reactivity.invalidate(["download", id]);
  });
});

export const videoDownloadAtom = Atom.family((id: string) => {
  return runtime.fn(() =>
    Stream.fromEffect(VideoDownloadWorkerService).pipe(
      Stream.flatMap((service) => service.download(id)),
      Stream.tap(() => Reactivity.invalidate(["download", id])),
    ),
  );
});

export const deleteFromLibraryAtom = Atom.family((id: string) => {
  return runtime.fn(() => {
    return Effect.gen(function* () {
      if (!window.confirm("Are you sure you want to permanently remove this video from your library?")) {
        return;
      }
      const client = yield* VideoSlugRpcClient;
      const videoRepository = yield* VideoRepository;
      yield* Atom.set(deleteLocalVideoAtom, id);
      yield* videoRepository.deleteFromLocalCache(id);
      yield* client("DeleteVideo", { id });
      yield* videoRepository.invalidate;
    });
  });
});

export const getPlaybackTimeAtom = Atom.family((id: string) => {
  return runtime.atom(() => {
    return PlaybackTimeRepository.pipe(Effect.andThen((repo) => repo.getPlaybackTime(id)));
  });
});

export const setPlaybackTimeAtom = Atom.family((id: string) => {
  return runtime.fn((time: number) => {
    return Effect.gen(function* () {
      const repo = yield* PlaybackTimeRepository;
      yield* repo.setPlaybackTime(id, time);
    });
  });
});
