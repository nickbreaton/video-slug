import { VideoInfo } from "@/schema/videos";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect, Option, Schema } from "effect";
import { SqlResolver, SqlSchema } from "@effect/sql";
import { VideoDirectoryService } from "./VideoDirectoryService";
import { FileSystem, Path } from "@effect/platform";
import { DownloadStreamManager } from "./DownloadStreamManager";
import { EnhancedVideoInfo } from "@/schema/videos";

export class VideoRepo extends Effect.Service<VideoRepo>()("VideoRepo", {
  dependencies: [VideoDirectoryService.Default, DownloadStreamManager.Default],
  effect: Effect.gen(function* () {
    const sql = yield* SqliteClient.SqliteClient;
    const { videosDir } = yield* VideoDirectoryService;
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const downloadStreamManager = yield* DownloadStreamManager;

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

    const getVideoById = SqlSchema.findOne({
      Request: Schema.String,
      Result: VideoInfo,
      execute: (id) => sql`SELECT * FROM videos WHERE id = ${id}`,
    });

    const deleteVideoById = SqlSchema.void({
      Request: Schema.String,
      execute: (id) => sql`DELETE FROM videos WHERE id = ${id}`,
    });

    const enhanceVideo = Effect.fn(function* (video: VideoInfo) {
      const filePath = path.join(videosDir, video.filename);

      const hasFile = yield* fs.exists(filePath);
      const hasStream = Option.isSome(downloadStreamManager.get(video.id));

      const stat = hasFile ? Option.some(yield* fs.stat(filePath)) : Option.none();

      const result: typeof EnhancedVideoInfo.Type = {
        info: video,
        status: hasFile ? "complete" : hasStream ? "downloading" : "error",
        totalBytes: Option.map(stat, (s) => Number(s.size)).pipe(Option.getOrUndefined),
      };

      return result;
    });

    return {
      insert: InsertVideoInfo.execute,
      deleteVideoById,
      getAll: () =>
        Effect.gen(function* () {
          const videos = yield* getAllVideos();

          return yield* Effect.all(videos.map(enhanceVideo), { concurrency: "unbounded" });
        }),
      getById: (id: string) =>
        Effect.gen(function* () {
          const videoOption = yield* getVideoById(id);

          if (Option.isNone(videoOption)) {
            return Option.none<typeof EnhancedVideoInfo.Type>();
          }

          return Option.some(yield* enhanceVideo(videoOption.value));
        }),
    };
  }),
}) {}
