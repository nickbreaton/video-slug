"use client";

import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, Layer, Stream } from "effect";
import { DownloadRpcs } from "./rpc/download";

const RpcLive = RpcClient.layerProtocolHttp({
  url: "/api/rpc",
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <button onClick={handleClick} className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
        Download
      </button>
    </div>
  );
}
