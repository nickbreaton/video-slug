"use client";

import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Effect, Layer } from "effect";
import { UserRpcs } from "../rpc/download";

const RpcLive = RpcClient.layerProtocolHttp({
  url: "/api/rpc",
}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));

export function DownloadButton() {
  const handleClick = () => {
    const program = Effect.gen(function* () {
      const client = yield* RpcClient.make(UserRpcs);
      const user = yield* client.UserById({ id: "123" });
      console.log("User:", user);
      return user;
    }).pipe(Effect.scoped, Effect.provide(RpcLive));

    Effect.runPromiseExit(program).then((exit) => {
      console.log(exit);
    });
  };

  return (
    <button
      onClick={handleClick}
      className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
    >
      Download
    </button>
  );
}
