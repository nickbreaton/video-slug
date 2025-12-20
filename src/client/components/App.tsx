import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, Layer, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { DownloadRpcs } from "@/schema/rpc/download";
import { css } from "../../../styled-system/css";
import { Add01Icon } from "hugeicons-react";

const RpcLive = RpcClient.layerProtocolHttp({
  url: "/api/rpc",
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

// Create runtime atom from the RPC layer
const runtimeAtom = Atom.runtime(RpcLive);

// Create atom for fetching videos
const videosAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const client = yield* RpcClient.make(DownloadRpcs);
    const videos = yield* client.GetVideos();
    return videos;
  }).pipe(Effect.scoped),
);

// Create function atom for downloading
const downloadAtom = runtimeAtom.fn(
  Effect.fnUntraced(function* (url: string) {
    const client = yield* RpcClient.make(DownloadRpcs);
    const videoInfo = yield* client.Download({
      url: new URL(url),
    });
    const progress = client.GetDownloadProgress({ id: videoInfo.id });
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
      <header className={css({ p: "4", display: "flex", justifyContent: "flex-end" })}>
        <button
          onClick={handleClick}
          className={css({
            rounded: "full",
            bg: "accent.50",
            boxShadow: "xs",
            boxShadowColor: "accent.100",
            borderColor: "accent.100",
            borderStyle: "solid",
            borderWidth: "1",
            p: "3",
            color: "accent.700",
          })}
        >
          <span className={css({ srOnly: true })}>Add</span>
          <Add01Icon strokeWidth={2.5} size={16} />
        </button>
      </header>
      <ul>
        {videosResult._tag === "Success" && videosResult.value.map((video) => <li key={video.id}>{video.title}</li>)}
      </ul>
    </div>
  );
}
