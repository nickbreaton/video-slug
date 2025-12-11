import { DownloadInitiationError, DownloadRpcs } from "@/app/rpc/download";
import { DownloadMessage, DownloadProgress, VideoInfo, VideoNotFoundError, YtDlpOutput } from "@/app/schema";
import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform";
import { BunContext, BunHttpServer } from "@effect/platform-bun";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { PlatformError } from "@effect/platform/Error";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Config, Console, Effect, Exit, Layer, Option, Schema, Scope, Stream } from "effect";
import { SqlResolver, SqlSchema } from "@effect/sql";

class VideoRepo extends Effect.Service<VideoRepo>()("VideoRepo", {
  effect: Effect.gen(function* () {
    const sql = yield* SqliteClient.SqliteClient;

    yield* sql`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        uploader TEXT,
        duration REAL,
        webpage_url TEXT,
        thumbnail TEXT,
        upload_date TEXT,
        filename TEXT
      )
    `;

    const InsertVideoInfo = yield* SqlResolver.void("InsertVideoInfo", {
      Request: VideoInfo,
      execute: (requests) =>
        sql`
          INSERT INTO videos
          ${sql.insert(requests)}
        `,
    });

    const getAllVideos = SqlSchema.findAll({
      Request: Schema.Void,
      Result: VideoInfo,
      execute: () => sql`SELECT * FROM videos`,
    });

    return {
      insert: InsertVideoInfo.execute,
      getAll: () => getAllVideos(),
    };
  }),
}) {}

class VideoDirectoryService extends Effect.Service<VideoDirectoryService>()("VideoDirectoryService", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const baseDir = yield* Config.string("DOWNLOADS_DIR").pipe(Config.withDefault("./tmp"));
    const videosDir = path.join(baseDir, "videos");

    yield* fs.makeDirectory(videosDir, { recursive: true });

    return { baseDir, videosDir };
  }),
}) {}

class VideoDownloadCommand extends Effect.Service<VideoDownloadCommand>()("VideoDownloadCommand", {
  dependencies: [VideoDirectoryService.Default],
  effect: Effect.gen(function* () {
    const exec = yield* CommandExecutor.CommandExecutor;
    const { videosDir } = yield* VideoDirectoryService;

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
      ).pipe(Command.workingDirectory(videosDir));

      return exec.start(command).pipe(
        Effect.map((process) => Stream.concat(process.stdout, process.stderr)),
        Stream.unwrap,
        Stream.decodeText(),
        Stream.splitLines,
        Stream.mapEffect(Schema.decodeUnknown(YtDlpOutput)),
        Stream.tap((output) => {
          if (output instanceof DownloadMessage && output.message.includes("Video unavailable")) {
            return new VideoNotFoundError();
          }
          return Effect.void;
        }),
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
    const videoRepo = yield* VideoRepo;

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
      yield* download.pipe(
        Stream.onEnd(videoRepo.insert(videoInfo.value)),
        Stream.runDrain,
        Effect.tapError((error) => Console.error(error)),
        Effect.forkDaemon,
      );

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
    const videoRepo = yield* VideoRepo;

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
      GetVideos: () => {
        return videoRepo.getAll();
      },
    };
  }),
);

const SqlLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { baseDir } = yield* VideoDirectoryService;
    const path = yield* Path.Path;
    return SqliteClient.layer({ filename: path.resolve(baseDir, "videos.db") });
  }),
);

const RpcLive = Layer.mergeAll(DownloadLive, RpcSerialization.layerNdjson, BunHttpServer.layerContext).pipe(
  Layer.provide(VideoDownloadManager.Default),
  Layer.provide(DownloadStreamManager.Default),
  Layer.provide(VideoRepo.Default),
  Layer.provide(SqlLive),
  Layer.provide(VideoDirectoryService.Default),
  Layer.provide(BunContext.layer),
);

const { handler } = RpcServer.toWebHandler(DownloadRpcs, { layer: RpcLive });

export const POST = (request: Request) => handler(request);
