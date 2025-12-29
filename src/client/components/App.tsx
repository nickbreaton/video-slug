import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, Layer, Option, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet, AtomRpc, Result } from "@effect-atom/atom-react";
import { DownloadRpcs } from "@/schema/rpc/download";
import { Add01Icon, VideoReplayIcon } from "hugeicons-react";
import { Reactivity } from "@effect/experimental";
import type { VideoInfo } from "@/schema/videos";
import type { VideoDownloadStatus } from "@/schema/videos";
import { EnhancedVideoInfo } from "@/schema/videos";

class LocalVideoService extends Effect.Service<LocalVideoService>()("LocalVideoService", {
  effect: Effect.gen(function* () {
    return {
      writeCache: (value: EnhancedVideoInfo[]) =>
        Effect.sync(() => localStorage.setItem("videos", JSON.stringify(value))),
      readCache: (): Effect.Effect<Option.Option<EnhancedVideoInfo[]>> =>
        Effect.sync(() =>
          Option.fromNullable(localStorage.getItem("videos")).pipe(Option.map((value) => JSON.parse(value))),
        ),
    };
  }),
}) {}

class DownloadClient extends AtomRpc.Tag<DownloadClient>()("DownloadClient", {
  group: DownloadRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson),
  ),
}) {}

const videosAtom = DownloadClient.query("GetVideos", void 0, { reactivityKeys: ["videos"] });
const runtime = Atom.runtime(DownloadClient.layer.pipe(Layer.merge(LocalVideoService.Default)));

const cachedVideosAtom = runtime.atom((get) => {
  return Effect.gen(function* () {
    const service = yield* LocalVideoService;
    const cache = yield* service.readCache();

    const cacheStream = Option.isSome(cache) ? Stream.make(cache.value) : Stream.empty;

    const serverStream = get.streamResult(videosAtom).pipe(
      Stream.tap((value) => {
        return service.writeCache(value as EnhancedVideoInfo[]);
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

function DownloadLineItem({ video, status }: { video: VideoInfo; status: VideoDownloadStatus }) {
  const result = useAtomValue(getDownloadProgressByIdAtom(status === "downloading" ? video.id : null));
  return (
    <li>
      {video.title} <span className="text-neutral-10">({status})</span>
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
