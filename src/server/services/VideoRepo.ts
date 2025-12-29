import { VideoInfo } from "@/schema/videos";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect, Schema } from "effect";
import { SqlResolver, SqlSchema } from "@effect/sql";

export class VideoRepo extends Effect.Service<VideoRepo>()("VideoRepo", {
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
