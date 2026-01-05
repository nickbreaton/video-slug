import { RpcClient } from "@effect/rpc";
import * as BrowserWorker from "@effect/platform-browser/BrowserWorker";
import { Effect, Layer } from "effect";
import { WorkerRpcs } from "@/schema/worker";
import WorkerModule from "../worker/main.ts?worker";

export const WorkerRpcClientLive = RpcClient.layerProtocolWorker({
  minSize: 0,
  maxSize: 10,
  timeToLive: "5 minutes",
  concurrency: 10,
}).pipe(
  Layer.provide(BrowserWorker.layerPlatform(() => new WorkerModule())),
);
