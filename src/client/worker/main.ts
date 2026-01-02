import * as BrowserRunner from "@effect/platform-browser/BrowserWorkerRunner";
import * as Runner from "@effect/platform/WorkerRunner";
import { Effect, Layer, Stream } from "effect";
import { LocalVideoFetchService, VideoFetchError } from "./LocalVideoFetchService";
import { FetchHttpClient } from "@effect/platform";

const WorkerLive = Runner.layer(
  (id: string) => {
    return Effect.gen(function* () {
      const fetchService = yield* LocalVideoFetchService;
      return fetchService.fetch(id);
    }).pipe(Stream.unwrap);
  },
  {
    // Encode errors to plain objects for worker boundary (avoid DataCloneError)
    encodeError: (_request, error) =>
      Effect.succeed(
        typeof error === "object" && error !== null && "_tag" in error
          ? { _tag: error._tag, ...(("reason" in error) ? { reason: error.reason } : {}) }
          : { _tag: "UnknownError", reason: String(error) },
      ),
  },
).pipe(
  Layer.provide(BrowserRunner.layer),
  Layer.provide(LocalVideoFetchService.Default),
  Layer.provide(FetchHttpClient.layer),
);

Effect.runFork(Runner.launch(WorkerLive));
