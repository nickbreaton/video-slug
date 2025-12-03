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
          const progressTemplate = [
            "download:{",
            '"downloaded_bytes": %(progress.downloaded_bytes)s,',
            '"total_bytes": %(progress.total_bytes|null)s,',
            '"eta": %(progress.eta|null)s,',
            '"speed": %(progress.speed|null)s,',
            '"elapsed": %(progress.elapsed|null)s,',
            '"id": "%(info.id|)s"',
            "}",
          ].join(" ");

          const command = Command.make(
            "yt-dlp",
            url.href,
            "--newline",
            "--progress",
            "--progress-template",
            progressTemplate,
            "--dump-json",
            "--no-quiet",
            "--no-simulate",
            "--restrict-filenames",
            "--paths",
            "tmp", // TODO: run command in tmp folder instead
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
