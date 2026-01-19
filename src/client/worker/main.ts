import * as BrowserRunner from "@effect/platform-browser/BrowserWorkerRunner";
import * as RpcServer from "@effect/rpc/RpcServer";
import { Effect, Layer, Stream } from "effect";
import { VideoFetchService } from "./VideoFetchService";
import { FetchHttpClient } from "@effect/platform";
import { WorkerRpcs, WorkerVideoFetchError } from "@/schema/worker";

const WorkerLive = RpcServer.layer(WorkerRpcs).pipe(
  Layer.provide(
    WorkerRpcs.toLayer({
      FetchVideo: (payload) =>
        Effect.gen(function* () {
          const fetchService = yield* VideoFetchService;
          return fetchService.fetch(payload.id);
        }).pipe(
          Stream.unwrap,
          Stream.mapError((error) =>
            new WorkerVideoFetchError({
              reason: typeof error === "object" && error !== null && "message" in error
                ? String(error.message)
                : String(error),
              id: payload.id,
            }),
          ),
        ),
    }),
  ),
  Layer.provide(RpcServer.layerProtocolWorkerRunner),
  Layer.provide(BrowserRunner.layer),
  Layer.provide(VideoFetchService.Default),
  Layer.provide(FetchHttpClient.layer),
);

Effect.runFork(BrowserRunner.launch(WorkerLive));
