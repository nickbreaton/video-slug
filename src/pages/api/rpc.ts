import type { APIRoute } from "astro";
import { VideoDeletionError, VideoSlugRpcs } from "@/schema/rpc";
import { DownloadProgress } from "@/schema/videos";
import { BunContext, BunHttpServer } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer, Option, Stream } from "effect";
import { VideoDownloadManager } from "@/server/services/VideoDownloadManager";
import { DownloadStreamManager } from "@/server/services/DownloadStreamManager";
import { VideoRepo } from "@/server/services/VideoRepo";
import { VideoDirectoryService } from "@/server/services/VideoDirectoryService";
import { DownloadGarbageCollecter } from "@/server/services/DownloadGarbageCollector";
import { memoMap } from "@/server/memoMap";
import { SqlLive } from "@/server/layers/SqlLive";

const VideoSlugRpcsLive = VideoSlugRpcs.toLayer(
  Effect.gen(function* () {
    const videoDownloadManager = yield* VideoDownloadManager;
    const downloadStreamManager = yield* DownloadStreamManager;
    const videoRepo = yield* VideoRepo;

    return {
      SaveVideo: ({ url }) => {
        return videoDownloadManager.initiateDownload(url);
      },

      GetDownloadProgress: ({ id }) =>
        Effect.gen(function* () {
          const result = downloadStreamManager.get(id);

          if (Option.isNone(result)) {
            return yield* Effect.dieMessage("TODO");
          }

          const next = result.value.pipe(
            Stream.filter((value): value is DownloadProgress => value instanceof DownloadProgress),
          );

          return next;
        }).pipe(Stream.unwrap),

      GetVideos: () => {
        return videoRepo.getAll();
      },

      DeleteVideo: ({ id }) => {
        return videoRepo.deleteVideoById(id).pipe(
          Effect.catchAll((error) => {
            console.error(error);
            return new VideoDeletionError();
          }),
        );
      },
    };
  }),
);

const RpcLive = Layer.mergeAll(
  VideoSlugRpcsLive,
  RpcSerialization.layerNdjson,
  BunHttpServer.layerContext,
  DownloadGarbageCollecter.Default,
).pipe(
  Layer.provide(VideoDownloadManager.Default),
  Layer.provide(DownloadStreamManager.Default),
  Layer.provide(VideoRepo.Default),
  Layer.provide(SqlLive),
  Layer.provide(VideoDirectoryService.Default),
  Layer.provide(BunContext.layer),
);

const { handler } = RpcServer.toWebHandler(VideoSlugRpcs, { layer: RpcLive, memoMap });

export const POST: APIRoute = async ({ request }) => {
  return handler(request);
};

export const prerender = false;
