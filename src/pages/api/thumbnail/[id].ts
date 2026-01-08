import type { APIRoute } from "astro";
import { Effect, Layer, ManagedRuntime, Option } from "effect";

import { memoMap } from "@/server/memoMap";
import { VideoDirectoryService } from "@/server/services/VideoDirectoryService";
import { BunContext } from "@effect/platform-bun";
import { FetchHttpClient, HttpClient, HttpClientResponse, HttpServerResponse } from "@effect/platform";
import { VideoRepo } from "@/server/services/VideoRepo";
import { SqlLive } from "@/server/layers/SqlLive";

const runtime = ManagedRuntime.make(
  VideoRepo.Default.pipe(
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provide(SqlLive),
    Layer.provide(VideoDirectoryService.Default),
    Layer.provide(BunContext.layer),
  ),
  memoMap,
);

export const GET: APIRoute = async ({ params }) => {
  const program = Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const videoRepo = yield* VideoRepo;

    if (!params["id"]) {
      return yield* Effect.dieMessage("Missing video ID");
    }

    const videoOption = yield* videoRepo.getById(params["id"]);

    if (Option.isNone(videoOption)) {
      return yield* Effect.dieMessage("Video not found");
    }

    const thumbnail = videoOption.value.info.thumbnail;

    if (!thumbnail) {
      return yield* Effect.dieMessage("Video has no thumbnail");
    }

    const response = yield* httpClient.get(thumbnail);

    if (response.status >= 300) {
      return yield* Effect.dieMessage(`Failed to fetch thumbnail: ${response.status}`);
    }

    return HttpServerResponse.stream(response.stream).pipe(
      HttpServerResponse.setHeader("Cache-Control", "max-age=31536000, immutable"),
      HttpServerResponse.toWeb,
    );
  });

  return runtime.runPromise(program);
};

export const prerender = false;
