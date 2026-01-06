import { FetchHttpClient } from "@effect/platform";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Effect, Layer, Option, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet, Result, useAtomSuspense } from "@effect-atom/atom-react";
import { Add01Icon } from "hugeicons-react";
import { Reactivity } from "@effect/experimental";
import { EnhancedVideoInfo } from "@/schema/videos";
import { LocalVideoRepository } from "../services/LocalVideoRepository";
import { VideoSlugRpcClient } from "../services/DownloadClient";
import { LocalBlobService } from "../services/LocalBlobService";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { WorkerRpcs } from "@/schema/worker";
import WorkerModule from "../worker/main.ts?worker";
import { BrowserRouter, Link, Route, Routes, useParams } from "react-router-dom";
import { Suspense } from "react";

const videosAtom = VideoSlugRpcClient.query("GetVideos", void 0, { reactivityKeys: ["videos"] });

const runtime = Atom.runtime(
  VideoSlugRpcClient.layer.pipe(
    Layer.merge(Layer.orDie(LocalVideoRepository.Default)),
    Layer.provide(FetchHttpClient.layer),
    Layer.provideMerge(LocalBlobService.Default),
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
  });
});

const localVideoUrl = Atom.family((id: string) => {
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
        BrowserWorker.layerPlatform(() => new WorkerModule()),
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
    <li className="border-b border-neutral-6 last:border-b-0">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex gap-3 sm:gap-4">
            {video.info.thumbnail && (
              <img
                src={video.info.thumbnail}
                alt=""
                className="h-20 w-20 flex-shrink-0 rounded-sm object-cover border border-neutral-6"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link to={`/video/${video.info.id}`} className="font-medium text-neutral-11 hover:text-neutral-12 hover:underline">
                {video.info.title}
              </Link>
              <span className="text-xs text-neutral-10">({video.status})</span>
              {result._tag === "Success" && (
                <span className="text-xs text-neutral-10">
                  {result.value.downloaded_bytes} / {result.value.total_bytes}
                </span>
              )}
            </div>
          </div>
        </div>
        {video.status === "complete" && (
          <div className="flex shrink-0 gap-2">
            {Result.match(localDownloadProgressResult, {
              onInitial: () => null,
              onSuccess: ({ value }) =>
                value === 100 ? (
                  <button className="border border-neutral-6 bg-neutral-2 px-3 py-1.5 text-sm text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4" onClick={async () => deleteLocalVideo(video.info.id)}>
                    🗑️
                  </button>
                ) : (
                  <button
                    className="border border-neutral-6 bg-neutral-2 px-3 py-1.5 text-sm text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4"
                    onClick={async () => downloadToLocal().then(console.log, console.error)}
                  >
                    {value ? `Downloading... (${value}%)` : "Download"}
                  </button>
                ),
              onFailure: (error) => JSON.stringify(error),
            })}
          </div>
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

function HomePage() {
  // Use the videos atom - this will automatically fetch on mount
  const videosResult = useAtomSuspense(cachedVideosAtom);

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
    <div className="min-h-screen bg-neutral-1">
      <div className="mx-auto max-w-4xl">
        <div className="border-x border-neutral-6 border-t border-neutral-6">
          <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
            <h1 className="text-lg font-medium text-neutral-12 sm:text-xl">VideoSlug</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <button className="border border-neutral-6 bg-neutral-2 px-3 py-1.5 text-sm text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4 sm:px-4 sm:py-2 sm:text-sm" onClick={() => deleteAllLocalVideos()}>
                Delete all
              </button>
              <button
                onClick={handleClick}
                className={`
                  flex items-center justify-center border border-neutral-6 bg-neutral-2 p-2 text-neutral-11 transition-all hover:border-neutral-7 hover:bg-neutral-3 active:bg-neutral-4 sm:p-2.5
                `}
              >
                <span className="sr-only">Add video</span>
                <Add01Icon strokeWidth={2.5} size={16} />
              </button>
            </div>
          </header>
        </div>

        <main className="divide-y divide-neutral-6 border-x border-neutral-6 sm:border-x">
          {videosResult._tag === "Success" &&
            videosResult.value.map((video) => <DownloadLineItem key={video.info.id} video={video} />)}
          {videosResult._tag === "Success" && videosResult.value.length === 0 && (
            <div className="border-x border-neutral-6 px-6 py-12 text-center text-neutral-10">
              <p className="mb-2">No videos yet</p>
              <p className="text-sm">Add a video to get started</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function VideoPage() {
  const params = useParams<{ id: string }>();
  const localVideoUrlResult = useAtomSuspense(localVideoUrl(params.id!));

  const videoSrc = Result.getOrElse(localVideoUrlResult, () => null) ?? `/api/videos/${params.id}`;

  return (
    <div className="min-h-screen bg-neutral-1">
      <div className="mx-auto max-w-4xl">
        <div className="border-x border-neutral-6 border-t border-neutral-6">
          <header className="flex items-center gap-2 px-4 py-4 sm:px-6 sm:py-5">
            <Link to="/" className="text-sm text-neutral-11 hover:text-neutral-12 hover:underline">
              ← Back
            </Link>
          </header>
        </div>

        <main className="border-x border-neutral-6 px-4 py-6 sm:px-6 sm:py-8">
          <h1 className="mb-6 border-b border-neutral-6 pb-4 text-xl font-medium text-neutral-12 sm:text-2xl">
            Video: {params.id}
          </h1>
          <div className="bg-neutral-2">
            <video src={videoSrc} controls className="w-full" />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-neutral-1 text-neutral-11">
        Loading...
      </div>
    }>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/video/:id" element={<VideoPage />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}
