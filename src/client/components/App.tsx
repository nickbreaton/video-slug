import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, Layer, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet, AtomRpc } from "@effect-atom/atom-react";
import { DownloadRpcs } from "@/schema/rpc/download";
import { Add01Icon } from "hugeicons-react";
import { Reactivity } from "@effect/experimental";

// const RpcLive = RpcClient.layerProtocolHttp({
//   url: "/api/rpc",
// }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

class DownloadClient extends AtomRpc.Tag<DownloadClient>()("DownloadClient", {
  group: DownloadRpcs,
  // Provide a `Layer` that provides the RpcClient.Protocol
  protocol: RpcClient.layerProtocolHttp({
    url: "/api/rpc",
  }).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(RpcSerialization.layerNdjson)),
}) {}

// Create runtime atom from the RPC layer
// const runtimeAtom = DownloadClient.runtime;

// Create atom for fetching videos
const videosAtom = DownloadClient.query("GetVideos", void 0, { reactivityKeys: ["videos"] });

// Create function atom for downloading
const downloadAtom = DownloadClient.runtime.fn(
  Effect.fnUntraced(function* (url: string) {
    const client = yield* DownloadClient;

    const videoInfo = yield* client("Download", {
      url: new URL(url),
    });

    yield* Reactivity.invalidate(["videos"]);
    const progress = client("GetDownloadProgress", { id: videoInfo.id });
    yield* Stream.runForEach(Console.log)(progress);
    return videoInfo;
  }),
);

export default function HomePage() {
  // Use the videos atom - this will automatically fetch on mount
  const videosResult = useAtomValue(videosAtom);

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
        {videosResult._tag === "Success" && videosResult.value.map((video) => <li key={video.id}>{video.title}</li>)}
      </ul>
    </div>
  );
}
