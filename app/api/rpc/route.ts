import { DownloadInitiationError, DownloadRpcs } from "@/app/rpc/download";
import { DownloadProgress, VideoInfo, VideoNotFoundError, YtDlpOutput } from "@/app/schema";
import { Command, CommandExecutor } from "@effect/platform";
import { NodeCommandExecutor, NodeContext, NodeFileSystem, NodeHttpServer } from "@effect/platform-node";
import { PlatformError } from "@effect/platform/Error";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Console, Effect, Exit, Layer, Option, Schema, Scope, Stream } from "effect";

class VideoDownloadCommand extends Effect.Service<VideoDownloadCommand>()("VideoDownloadCommand", {
  effect: Effect.gen(function* () {
    const exec = yield* CommandExecutor.CommandExecutor;

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
      ).pipe(Command.workingDirectory("./tmp")); // TODO: get working dir from env

      return exec.start(command).pipe(
        Effect.map((process) => Stream.concat(process.stdout, process.stderr)),
        Stream.unwrap,
        Stream.decodeText(),
        Stream.splitLines,
        Stream.tap((line) => (line.includes("Video unavailable") ? new VideoNotFoundError() : Effect.void)),
        Stream.mapEffect(Schema.decodeUnknown(YtDlpOutput)),
        Stream.catchTag("ParseError", () => Effect.dieMessage("ParseError should be impossible")),
        Stream.catchTag("BadArgument", () => Effect.dieMessage("Arguments should be static")),
      );
    };

    return { download };
  }),
}) {}

class DownloadStreamManager extends Effect.Service<DownloadStreamManager>()("DownloadStreamManager", {
  effect: Effect.gen(function* () {
    const streams: Record<string, Stream.Stream<typeof YtDlpOutput.Type, PlatformError>> = {};

    const add = (id: string, stream: Stream.Stream<typeof YtDlpOutput.Type, PlatformError>) => {
      return Effect.gen(function* () {
        streams[id] = stream;
      });
    };

    const get = (id: string) => {
      return Option.fromNullable(streams[id]);
    };

    return { add, get };
  }),
}) {}

class VideoDownloadManager extends Effect.Service<VideoDownloadManager>()("VideoDownloadManager", {
  dependencies: [VideoDownloadCommand.Default, DownloadStreamManager.Default],
  effect: Effect.gen(function* () {
    const videoDownloadCommand = yield* VideoDownloadCommand;
    const downloadStreamManager = yield* DownloadStreamManager;

    const initiateDownload = Effect.fn(function* (url: URL) {
      const downloadScope = yield* Scope.make();

      const download = yield* videoDownloadCommand.download(url).pipe(
        Stream.tap((value) => Console.log(value)),
        Stream.share({ capacity: "unbounded" }),
        Scope.extend(downloadScope),
      );

      // Stop the download if this handler ended in error
      yield* Effect.addFinalizer(
        Exit.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (exit) => Scope.close(downloadScope, Exit.failCause(exit)),
        }),
      );

      const videoInfo = yield* download.pipe(
        Stream.find((value) => value instanceof VideoInfo),
        Stream.runHead,
        Effect.catchTag("SystemError", () => new DownloadInitiationError({ message: "Error within download command" })),
        Effect.catchTag("VideoNotFoundError", () => new DownloadInitiationError({ message: "Video not found" })),
      );

      if (Option.isNone(videoInfo)) {
        return yield* new DownloadInitiationError({ message: "Video info not found in stream" });
      }

      // Fork stream into background
      yield* Effect.forkDaemon(Stream.runDrain(download));

      // Save a reference to the stream before returning
      yield* download.pipe(
        Stream.catchTag("VideoNotFoundError", () => Effect.dieMessage("Video must be found at this point")),
        (stream) => downloadStreamManager.add(videoInfo.value.id, stream),
      );

      return videoInfo.value;
    });

    return { initiateDownload };
  }),
}) {}

export const DownloadLive = DownloadRpcs.toLayer(
  Effect.gen(function* () {
    const videoDownloadManager = yield* VideoDownloadManager;
    const downloadStreamManager = yield* DownloadStreamManager;

    return {
      Download: ({ url }) => {
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
    };
  }),
);

const RpcLive = Layer.mergeAll(DownloadLive, RpcSerialization.layerNdjson, NodeHttpServer.layerContext).pipe(
  Layer.provide(NodeContext.layer),
  Layer.provide(VideoDownloadManager.Default),
  Layer.provide(DownloadStreamManager.Default),
  Layer.provide(NodeCommandExecutor.layer),
  Layer.provide(NodeFileSystem.layer),
);

const { handler } = RpcServer.toWebHandler(DownloadRpcs, { layer: RpcLive });

export const POST = (request: Request) => handler(request);
