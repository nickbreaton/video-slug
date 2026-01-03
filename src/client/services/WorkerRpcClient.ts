import * as RpcClient from "@effect/rpc/RpcClient";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Effect, Layer } from "effect";
import { WorkerRpcs } from "@/schema/worker";

export const WorkerRpcClientLive = RpcClient.layerProtocolWorker({
  size: 1,
}).pipe(
  Layer.provide(
    BrowserWorker.layerPlatform(
      () =>
        new globalThis.Worker(new URL("../worker/main.ts", import.meta.url), {
          type: "module",
        }),
    ),
  ),
);

export const fetchVideo = (id: string) =>
  Effect.gen(function* () {
    const client = yield* RpcClient.make(WorkerRpcs);
    return client.FetchVideo({ id });
  });
