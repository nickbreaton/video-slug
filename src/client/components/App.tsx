import { FetchHttpClient } from "@effect/platform";
import { Effect, Layer, Option, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { Add01Icon } from "hugeicons-react";
import { Reactivity } from "@effect/experimental";
import type { VideoInfo } from "@/schema/videos";
import type { VideoDownloadStatus } from "@/schema/videos";
import { EnhancedVideoInfo } from "@/schema/videos";
import { LocalVideoService } from "../services/LocalVideoService";
import { DownloadClient } from "../services/DownloadClient";
import { LocalVideoDownloadService } from "../services/LocalVideoDownloadService";

const videosAtom = DownloadClient.query("GetVideos", void 0, { reactivityKeys: ["videos"] });
const runtime = Atom.runtime(
  DownloadClient.layer.pipe(
    Layer.merge(Layer.orDie(LocalVideoService.Default)),
    Layer.merge(LocalVideoDownloadService.Default),
    Layer.provide(FetchHttpClient.layer),
  ),
);

const cachedVideosAtom = runtime.atom((get) => {
  return Effect.gen(function* () {
    const localVideoService = yield* LocalVideoService;
    const cache = yield* localVideoService.get();

    const cacheStream = Option.isSome(cache) ? Stream.make(cache.value) : Stream.empty;

    const serverStream = get.streamResult(videosAtom).pipe(
      Stream.tap((value) => {
        return localVideoService.set(value as EnhancedVideoInfo[]);
      }),
      Stream.catchAll(() => {
        console.log("TODO: Throw a toast or something to inform user of error but still keep online working well");
        return Stream.empty;
      }),
    );

    return Stream.concat(cacheStream, serverStream);
  }).pipe(Stream.unwrap);
});

const downloadAtom = DownloadClient.runtime.fn(
  Effect.fnUntraced(function* (url: string) {
    const client = yield* DownloadClient;

    const videoInfo = yield* client("Download", {
      url: new URL(url),
    });

    yield* Reactivity.invalidate(["videos"]);

    return videoInfo;
  }),
);

const getDownloadProgressByIdAtom = Atom.family((id: string | null) => {
  return DownloadClient.runtime.atom(
    id == null
      ? Stream.empty
      : Effect.gen(function* () {
          const client = yield* DownloadClient;
          return client("GetDownloadProgress", { id });
        }).pipe(Stream.unwrap, Stream.onEnd(Reactivity.invalidate(["videos"]))),
  );
});

const videoDownloadAtom = runtime.fn(Effect.serviceFunctions(LocalVideoDownloadService).download);
const openLocalCopyAtom = runtime.fn((id: string) => {
  return Effect.gen(function* () {
    const data = yield* Effect.serviceFunctions(LocalVideoService).getBlob(id);

    if (Option.isSome(data)) {
      const blob = new Blob([data.value.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  });
});

function DownloadLineItem({ video, status }: { video: VideoInfo; status: VideoDownloadStatus }) {
  const result = useAtomValue(getDownloadProgressByIdAtom(status === "downloading" ? video.id : null));
  const downloadToLocal = useAtomSet(videoDownloadAtom);
  const openLocalCopy = useAtomSet(openLocalCopyAtom);

  return (
    <li>
      {video.title} <span className="text-neutral-10">({status})</span>
      {status === "complete" && (
        <div className="border border-neutral-6 p-2 inline-block">
          <button onClick={async () => downloadToLocal(video.id)}>Download</button>
          {" • "}
          <button onClick={async () => openLocalCopy(video.id)}>Open</button>
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

export default function HomePage() {
  // Use the videos atom - this will automatically fetch on mount
  const videosResult = useAtomValue(cachedVideosAtom);

  // Get the download function
  const download = useAtomSet(downloadAtom);

  const handleClick = () => {
    const video = prompt("Enter video URL", "https://www.youtube.com/watch?v=3PFLeteDuyQ");

    if (!video) return;

    // Trigger the download
    download(video);
  };

  return (
    <div>
      <header className="flex justify-end p-4">
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
      </header>
      <ul>
        {videosResult._tag === "Success" &&
          videosResult.value.map((video) => (
            <DownloadLineItem key={video.info.id} video={video.info} status={video.status} />
          ))}
      </ul>
    </div>
  );
}
