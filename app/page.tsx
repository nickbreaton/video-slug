"use client";

import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, Layer, Stream } from "effect";
import { DownloadRpcs } from "./rpc/download";
import { css } from "../styled-system/css";

const RpcLive = RpcClient.layerProtocolHttp({
  url: "/api/rpc",
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

const buttonClass = css({
  px: 4,
  py: 2,
  rounded: "md",
  bg: "background",
  color: "foreground",
  borderWidth: "1px",
  borderColor: "accent.400",
  cursor: "pointer",
  _hover: { bg: "accent.200" },
});

export default function Home() {
  const handleClick = () => {
    const program = Effect.gen(function* () {
      const client = yield* RpcClient.make(DownloadRpcs);
      const videoInfo = yield* client.Download({
        url: new URL("https://www.youtube.com/watch?v=3PFLeteDuyQ"),
      });
      const progress = client.GetDownloadProgress({ id: videoInfo.id });
      yield* Stream.runForEach(Console.log)(progress);
    }).pipe(Effect.scoped, Effect.provide(RpcLive));

    Effect.runPromiseExit(program).then((exit) => {
      console.log("exit:", exit);
    });
  };

  return (
    <div>
      <button onClick={handleClick} className={buttonClass}>
        Download
      </button>
    </div>
  );
}
