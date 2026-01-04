import { FetchHttpClient } from "@effect/platform";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Effect, Layer, Option, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet, Result } from "@effect-atom/atom-react";
import { Add01Icon } from "hugeicons-react";
import { Reactivity } from "@effect/experimental";
import { EnhancedVideoInfo } from "@/schema/videos";
import { LocalVideoRepository } from "../services/LocalVideoRepository";
import { VideoSlugRpcClient } from "../services/DownloadClient";
import { LocalBlobService } from "../services/LocalBlobService";
import { WorkerRpcClientLive } from "../services/WorkerRpcClient";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { WorkerRpcs } from "@/schema/worker";

const videosAtom = VideoSlugRpcClient.query("GetVideos", void 0, { reactivityKeys: ["videos"] });

const runtime = Atom.runtime(
  VideoSlugRpcClient.layer.pipe(
    Layer.merge(Layer.orDie(LocalVideoRepository.Default)),
    Layer.provide(FetchHttpClient.layer),
    Layer.provideMerge(LocalBlobService.Default),
    Layer.merge(WorkerRpcClientLive),
  ),
);

const cachedVideosAtom = runtime.atom((get) => {
  return Effect.gen(function* () {
    const localVideoRepository = yield* LocalVideoRepository;
    const cache = yield* localVideoRepository.get();

    const cacheStream = Option.isSome(cache) ? Stream.make(cache.value) : Stream.empty;

    const serverStream = get.streamResult(videosAtom).pipe(
      Stream.tap((value) => {
        return localVideoRepository.set(value as EnhancedVideoInfo[]);
      }),
      Stream.catchAll((error) => {
        console.log(
          "TODO: Throw a toast or something to inform user of error but still keep online working well",
          error,
        );
        return Stream.empty;
      }),
    );

    return Stream.concat(cacheStream, serverStream);
  }).pipe(Stream.unwrap);
});

const downloadAtom = VideoSlugRpcClient.runtime.fn(
  Effect.fnUntraced(function* (url: string) {
    const client = yield* VideoSlugRpcClient;

    const videoInfo = yield* client("SaveVideo", {
      url: new URL(url),
    });

    yield* Reactivity.invalidate(["videos"]);

    return videoInfo;
  }),
);

const getDownloadProgressByIdAtom = Atom.family((id: string | null) => {
  return runtime.atom(
    id == null
      ? Stream.empty
      : Effect.gen(function* () {
          const client = yield* VideoSlugRpcClient;
          return client("GetDownloadProgress", { id });
        }).pipe(Stream.unwrap, Stream.onEnd(Reactivity.invalidate(["videos"]))),
  );
});

const getLocalDownloadProgressAtom = Atom.family((video: EnhancedVideoInfo) => {
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

const openLocalVideoAtom = runtime.fn((id: string) => {
  return Effect.gen(function* () {
    const localBlobService = yield* LocalBlobService;

    const blob = yield* localBlobService.get(id);

    if (Option.isSome(blob)) {
      const video = document.createElement("video");
      video.controls = true;
      document.body.appendChild(video);
      video.src = URL.createObjectURL(blob.value);
    }

    yield* Reactivity.invalidate(["download", id]);
  });
});

const deleteLocalVideoAtom = runtime.fn((id: string) => {
  return Effect.gen(function* () {
    const localBlobService = yield* LocalBlobService;
    yield* localBlobService.delete(id);
    yield* Reactivity.invalidate(["download", id]);
  });
});

const videoDownloadAtom = Atom.family((id: string) => {
  return runtime.fn(() => {
    return Effect.gen(function* () {
      // Create a fresh worker protocol for this download
      const protocol = yield* RpcClient.makeProtocolWorker({ size: 1 });
      const client = yield* RpcClient.make(WorkerRpcs).pipe(
        Effect.provide(Layer.succeed(RpcClient.Protocol, protocol)),
      );
      const stream = client.FetchVideo({ id });
      return stream.pipe(Stream.tap(() => Reactivity.invalidate(["download", id])));
    }).pipe(
      Effect.provide(
        // Create a dedicated worker for each download to avoid concurrent stream bug (potentially) in @effect/rpc worker protocol
        BrowserWorker.layerPlatform(() => {
          return new globalThis.Worker(new URL("../worker/main.ts", import.meta.url), {
            type: "module",
          });
        }),
      ),
      Stream.unwrapScoped,
    );
  });
});

function DownloadLineItem({ video }: { video: EnhancedVideoInfo }) {
  const result = useAtomValue(getDownloadProgressByIdAtom(video.status === "downloading" ? video.info.id : null));
  const localDownloadProgressResult = useAtomValue(getLocalDownloadProgressAtom(video));

  const openLocalVideo = useAtomSet(openLocalVideoAtom, {
    mode: "promise",
  });

  const deleteLocalVideo = useAtomSet(deleteLocalVideoAtom);

  const downloadToLocal = useAtomSet(videoDownloadAtom(video.info.id), {
    mode: "promise",
  });

  return (
    <li>
      {video.info.title} <span className="text-neutral-10">({video.status})</span>
      {video.status === "complete" && (
        <div className="inline-block">
          {Result.match(localDownloadProgressResult, {
            onInitial: () => null,
            onSuccess: ({ value }) =>
              value === 100 ? (
                <span className="space-x-2">
                  <button className="border border-neutral-6 p-2" onClick={async () => openLocalVideo(video.info.id)}>
                    Open
                  </button>
                  <button className="border border-neutral-6 p-2" onClick={async () => deleteLocalVideo(video.info.id)}>
                    🗑️
                  </button>
                </span>
              ) : (
                <button
                  className="border border-neutral-6 p-2"
                  onClick={async () => downloadToLocal().then(console.log, console.error)}
                >
                  {value ? `Downloading... (${value}%)` : "Download"}
                </button>
              ),
            onFailure: (error) => JSON.stringify(error),
          })}
        </div>
      )}
      <div>
        {result._tag === "Success" && (
          <span>
            {result.value.downloaded_bytes} / {result.value.total_bytes}
          </span>
        )}
      </div>
    </li>
  );
}

const deleteAllLocalVideosAtom = runtime.fn(() => {
  return Effect.gen(function* () {
    const localBlobService = yield* LocalBlobService;
    yield* localBlobService.deleteAll();
    yield* Reactivity.invalidate(["download"]);
  });
});

export default function HomePage() {
  // Use the videos atom - this will automatically fetch on mount
  const videosResult = useAtomValue(cachedVideosAtom);

  // Get the download function
  const download = useAtomSet(downloadAtom);

  const deleteAllLocalVideos = useAtomSet(deleteAllLocalVideosAtom);

  const handleClick = () => {
    const video = prompt("Enter video URL", "https://www.youtube.com/watch?v=3PFLeteDuyQ");

    if (!video) return;

    // Trigger the download
    download(video);
  };

  return (
    <div>
      <header className="flex justify-end p-4">
        <span className="space-x-2">
          <button className="border border-neutral-6 p-2" onClick={() => deleteAllLocalVideos()}>
            Delete all local videos
          </button>
          <button
            onClick={handleClick}
            className={`
              rounded-full border border-solid border-neutral-6 bg-neutral-3 p-3 text-neutral-12
              shadow-xs shadow-neutral-4
              hover:border-neutral-7 hover:bg-neutral-4
            `}
          >
            <span className="sr-only">Add</span>
            <Add01Icon strokeWidth={2.5} size={16} />
          </button>
        </span>
      </header>
      <ul>
        {videosResult._tag === "Success" &&
          videosResult.value.map((video) => <DownloadLineItem key={video.info.id} video={video} />)}
      </ul>
    </div>
  );
}
