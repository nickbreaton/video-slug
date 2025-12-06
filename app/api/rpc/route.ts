import { DownloadRpcs } from "@/app/rpc/download";
import { VideoInfo, YtDlpOutput } from "@/app/schema";
import { Command } from "@effect/platform";
import { NodeContext, NodeHttpServer } from "@effect/platform-node";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import {
  Chunk,
  Console,
  Effect,
  Exit,
  Layer,
  Option,
  PubSub,
  Queue,
  Schema,
  Scope,
  Stream,
  Take,
} from "effect";

class VideoDownloadCommand extends Effect.Service<VideoDownloadCommand>()(
  "VideoDownloadCommand",
  {
    effect: Effect.gen(function* () {
      const download = function (url: URL) {
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
          Stream.onStart(Console.log("💔")),
          Stream.decodeText(),
          Stream.splitLines,
          Stream.mapEffect(Schema.decodeUnknown(YtDlpOutput)),
          Stream.orDie, // TODO: remove
        );
      };

      return { download };
    }),
  },
) {}

class VideoDownloadManager extends Effect.Service<VideoDownloadManager>()(
  "VideoDownloadManager",
  {
    dependencies: [VideoDownloadCommand.Default],
    effect: Effect.gen(function* () {
      const videoDownloadCommand = yield* VideoDownloadCommand;

      const initiateDownload = Effect.fn(function* (url: URL) {
        const downloadScope = yield* Scope.make();

        const download = yield* videoDownloadCommand.download(url).pipe(
          Stream.tap((value) => Console.log(value)),
          Stream.share({ capacity: "unbounded" }),
          Scope.extend(downloadScope),
        );

        // Fork stream into background
        yield* Effect.forkDaemon(Stream.runDrain(download));

        // Stop the download if this handler ended in error
        yield* Effect.addFinalizer((exit) => {
          if (Exit.isSuccess(exit)) {
            return Effect.void;
          }
          return Scope.close(downloadScope, exit);
        });

        const videoInfo = yield* download.pipe(
          Stream.find((value) => value instanceof VideoInfo),
          Stream.runHead,
        );

        if (Option.isNone(videoInfo)) {
          // TODO: handle via actual error
          return yield* Effect.dieMessage("Video info not found");
        }

        return videoInfo.value;
      });

      return { initiateDownload };
    }),
  },
) {}

export const DownloadLive = DownloadRpcs.toLayer(
  Effect.gen(function* () {
    const videoDownloadManager = yield* VideoDownloadManager;

    return {
      Download: ({ url }) => {
        return videoDownloadManager.initiateDownload(url);
      },
    };
  }),
);

const RpcLive = Layer.mergeAll(
  DownloadLive,
  RpcSerialization.layerNdjson,
  NodeHttpServer.layerContext,
).pipe(
  Layer.provide(NodeContext.layer),
  Layer.provide(VideoDownloadManager.Default),
);

const { handler } = RpcServer.toWebHandler(DownloadRpcs, { layer: RpcLive });

export const POST = (request: Request) => handler(request);
