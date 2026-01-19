import { BrowserWorker } from "@effect/platform-browser";
import { RpcClient } from "@effect/rpc";
import { Effect, Layer, Stream } from "effect";
import WorkerModule from "../worker/main.ts?worker";
import { WorkerRpcs } from "@/schema/worker";

export class VideoDownloadWorkerService extends Effect.Service<VideoDownloadWorkerService>()(
  "VideoDownloadWorkerService",
  {
    effect: Effect.gen(function* () {
      const download = (id: string) =>
        Effect.gen(function* () {
          const protocol = yield* RpcClient.makeProtocolWorker({ size: 1 });
          const client = yield* RpcClient.make(WorkerRpcs).pipe(
            Effect.provide(Layer.succeed(RpcClient.Protocol, protocol)),
          );
          return client.FetchVideo({ id });
        }).pipe(
          // Layer is provided inline due to force recreation on each request. This works around
          // seemingly some weird behavior within the RPC worker implementation where one worker finishing
          // causes all other workers to disconnect.
          Effect.provide(BrowserWorker.layerPlatform(() => new WorkerModule())),
          Stream.unwrapScoped,
        );

      return { download };
    }),
  },
) {}
