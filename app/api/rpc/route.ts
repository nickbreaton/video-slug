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
            '"status": "downloading",',
            '"downloaded_bytes": %(progress.downloaded_bytes)s,',
            '"total_bytes": %(progress.total_bytes|null)s,',
            '"eta": %(progress.eta|null)s,',
            '"speed": %(progress.speed|null)s,',
            '"percentage": %(progress._percent|null)s,',
            '"elapsed": %(progress.elapsed|null)s,',
            '"id": "%(info.id|)s",',
            '"title": "%(info.title|)s",',
            '"ext": "%(info.ext|)s",',
            '"filename": "%(info.filename|)s",',
            '"duration": %(info.duration|null)s,',
            '"uploader": "%(info.uploader|)s",',
            '"upload_date": "%(info.upload_date|)s",',
            '"channel": "%(info.channel|)s",',
            '"view_count": %(info.view_count|null)s,',
            '"thumbnail": "%(info.thumbnail|)s",',
            '"webpage_url": "%(info.webpage_url|)s"',
            "}",
          ].join(" ");

          const command = Command.make(
            "yt-dlp",
            url.href,
            "--newline",
            "--progress-template",
            progressTemplate,
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
