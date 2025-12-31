import type { APIRoute } from "astro";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { lookup } from "mime-types";

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
  const fileStat = await stat(videoFilePath);
  const fileSize = fileStat.size;
  const mimeType = lookup(videoFilePath) || "video/mp4";

  // Handle Range requests for video streaming
  const range = request.headers.get("Range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = Math.min(parts[1] ? parseInt(parts[1], 10) : fileSize, fileSize);

    const stream = createReadStream(videoFilePath, { start, end: end });
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start),
        "Content-Type": mimeType,
      },
    });
  }

  // Return full file
  const stream = createReadStream(videoFilePath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
    },
  });
};

export const prerender = false;
