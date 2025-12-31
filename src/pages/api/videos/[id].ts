import type { APIRoute } from "astro";
import { Effect, Layer, ManagedRuntime, Option } from "effect";

import { memoMap } from "@/server/memoMap";
import { VideoDirectoryService } from "@/server/services/VideoDirectoryService";
import { BunContext } from "@effect/platform-bun";
import { Path } from "@effect/platform";
import { VideoRepo } from "@/server/services/VideoRepo";
import { SqlLive } from "@/server/layers/SqlLive";

const runtime = ManagedRuntime.make(
  VideoRepo.Default.pipe(
    Layer.provide(SqlLive),
    Layer.provideMerge(VideoDirectoryService.Default),
    Layer.provideMerge(BunContext.layer),
  ),
  memoMap,
);

export const GET: APIRoute = async ({ request, params }) => {
  const getVideoFilePath = Effect.gen(function* () {
    const { videosDir } = yield* VideoDirectoryService;
    const videoRepo = yield* VideoRepo;
    const path = yield* Path.Path;

    yield* Effect.logWarning("Video download endpoint is still unsecured, do so before launching");

    if (!params["id"]) {
      return yield* Effect.dieMessage("Missing video ID");
    }

    const videoOption = yield* videoRepo.getById(params["id"]);

    if (Option.isNone(videoOption)) {
      return yield* Effect.dieMessage("Video not found");
    }

    const filename = videoOption.value.info.filename;

    return path.join(videosDir, filename);
  });

  const videoFilePath = await runtime.runPromise(getVideoFilePath);
  const file = Bun.file(videoFilePath);

  // Handle Range requests for video streaming
  // Based on implementation here: https://github.com/oven-sh/bun/blob/ecb6c810c892a4d1c2da7d0515bd3374b4646eb1/examples/http-file-extended.ts
  const range = request.headers.get("Range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const fileSize = file.size;
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const slice = file.slice(start, end + 1);

    return new Response(slice, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(slice.size),
        "Content-Type": file.type,
      },
    });
  }

  // Return full file
  return new Response(file, {
    headers: {
      "Content-Type": file.type || "video/mp4",
      "Accept-Ranges": "bytes",
    },
  });
};

export const prerender = false;
