import { PlaybackTimeEntry } from "@/schema/videos";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlResolver, SqlSchema } from "@effect/sql";
import { Effect, Schema } from "effect";

const VideoTimestamp = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  updatedAt: Schema.Number,
});

export class VideoTimestampService extends Effect.Service<VideoTimestampService>()("VideoTimestampService", {
  dependencies: [],
  effect: Effect.gen(function* () {
    const sql = yield* SqliteClient.SqliteClient;

    yield* sql`
        CREATE TABLE IF NOT EXISTS timestamps (
          video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
          time REAL NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        )
      `;

    const upsertTimestamp = yield* SqlResolver.void("UpsertTimestamp", {
      Request: VideoTimestamp,
      execute: (requests) =>
        sql`
            INSERT INTO timestamps (video_id, time, updated_at)
            VALUES (${requests.map((r) => r.id)}, ${requests.map((r) => r.time)}, ${requests.map((r) => r.updatedAt)})
            ON CONFLICT(video_id) DO UPDATE SET
              time = excluded.time,
              updated_at = excluded.updated_at
          `,
    });

    const getTimestampByVideoId = SqlSchema.findOne({
      Request: Schema.String,
      Result: PlaybackTimeEntry,
      execute: (videoId) => sql`SELECT time, updated_at FROM timestamps WHERE video_id = ${videoId}`,
    });

    return {
      upsert: upsertTimestamp.execute,
      getByVideoId: getTimestampByVideoId,
    };
  }),
}) {}
