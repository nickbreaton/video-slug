import * as BrowserRunner from "@effect/platform-browser/BrowserWorkerRunner";
import * as Runner from "@effect/platform/WorkerRunner";
import { Effect, Layer, Stream } from "effect";
import { LocalVideoDownloadService } from "./LocalVideoDownloadService";
import { FetchHttpClient } from "@effect/platform";

const WorkerLive = Runner.layer((id: string) => {
  return Effect.gen(function* () {
    const downloadService = yield* LocalVideoDownloadService;
    return downloadService.download(id);
  }).pipe(Stream.unwrap);
}).pipe(
  Layer.provide(BrowserRunner.layer),
  Layer.provide(LocalVideoDownloadService.Default),
  Layer.provide(FetchHttpClient.layer),
);

Effect.runFork(Runner.launch(WorkerLive));
