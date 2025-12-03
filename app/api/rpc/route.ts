import { DownloadRpcs } from "@/app/rpc/download";
import { YtDlpOutput } from "@/app/schema";
import { Command } from "@effect/platform";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer, Schema, Stream } from "effect";

export const DownloadLive = DownloadRpcs.toLayer(
  Effect.gen(function* () {
    return {
      Download: ({ url }) => {
        return Effect.gen(function* () {
          const command = Command.make(
            "yt-dlp",
            url.href,
            "--newline",
            "--progress-template",
            'download:{ "status": "downloading", "downloaded_bytes": %(progress.downloaded_bytes)s, "total_bytes": %(progress.total_bytes|null)s, "eta": %(progress.eta|null)s, "speed": %(progress.speed|null)s }',
            "-P",
            "tmp",
          );
          return Command.stream(command).pipe(
            Stream.decodeText(),
            Stream.splitLines,
            Stream.mapEffect(Schema.decodeUnknown(YtDlpOutput)),
            Stream.orDie,
          );
        }).pipe(Stream.unwrap);
      },
    };
  }),
);

const RpcLive = Layer.mergeAll(
  DownloadLive,
  RpcSerialization.layerNdjson,
  NodeHttpServer.layerContext,
).pipe(Layer.provide(NodeContext.layer));

const { handler } = RpcServer.toWebHandler(DownloadRpcs, { layer: RpcLive });

export const POST = (request: Request) => handler(request);
