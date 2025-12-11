"use client";

import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, Layer, Stream } from "effect";
import { DownloadRpcs } from "./rpc/download";
import { css } from "@/styled-system/css";
import { Add01Icon } from "hugeicons-react";
import { useEffect } from "react";

const RpcLive = RpcClient.layerProtocolHttp({
  url: "/api/rpc",
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

export default function Home() {
  useEffect(() => {
    const program = Effect.gen(function* () {
      const client = yield* RpcClient.make(DownloadRpcs);
      const videos = yield* client.GetVideos();
      console.log("videos:", videos);
    }).pipe(Effect.scoped, Effect.provide(RpcLive));

    Effect.runPromiseExit(program);
  }, []);

  const handleClick = () => {
    const video = prompt("Enter video URL", "https://www.youtube.com/watch?v=3PFLeteDuyQ");

    if (!video) return;

    const program = Effect.gen(function* () {
      const client = yield* RpcClient.make(DownloadRpcs);
      const videoInfo = yield* client.Download({
        url: new URL(video),
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
    </div>
  );
}
