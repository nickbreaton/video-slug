import { RpcClient } from "@effect/rpc";
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
