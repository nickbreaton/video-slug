import { VideoDeletionError, VideoSlugRpcs } from "@/schema/rpc";
import { DownloadProgress } from "@/schema/videos";
import { DownloadGarbageCollecter } from "@/server/services/DownloadGarbageCollector";
import { DownloadStreamManager } from "@/server/services/DownloadStreamManager";
import { VideoDownloadManager } from "@/server/services/VideoDownloadManager";
import { VideoRepo } from "@/server/services/VideoRepo";
import { HttpServer } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import type { APIRoute } from "astro";
import { Effect, Layer, Option, Stream } from "effect";

const VideoSlugRpcsLive = VideoSlugRpcs.toLayer(
  Effect.gen(function* () {
    const videoDownloadManager = yield* VideoDownloadManager;
    const downloadStreamManager = yield* DownloadStreamManager;
    const videoRepo = yield* VideoRepo;

    return {
      SaveVideo: ({ url }: { url: URL }) => videoDownloadManager.initiateDownload(url),
      GetDownloadProgress: ({ id }: { id: string }) =>
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

      GetVideos: () => videoRepo.getAll(),

      DeleteVideo: ({ id }: { id: string }) =>
        videoRepo.deleteVideoById(id).pipe(
          Effect.catchAll((error) => {
            console.error(error);
            return new VideoDeletionError();
          }),
        ),

      UpdateTimestamp: ({ id, value }) => videoRepo.upsertTimestamp({ id, value }),
    };
  }),
).pipe(
  Layer.provide(VideoDownloadManager.Default),
  Layer.provide(DownloadStreamManager.Default),
  Layer.provide(VideoRepo.Default),
);

const RpcLive = Layer.mergeAll(
  VideoSlugRpcsLive,
  RpcSerialization.layerNdjson,
  DownloadGarbageCollecter.Default,
  HttpServer.layerContext,
).pipe(Layer.provide(BunContext.layer), Layer.provide(HttpServer.layerContext));

const { handler } = RpcServer.toWebHandler(VideoSlugRpcs, { layer: RpcLive });

export const POST: APIRoute = async ({ request }) => {
  return handler(request);
};

export const prerender = false;
