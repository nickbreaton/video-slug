import { Effect, Layer } from "effect";
import { VideoDirectoryService } from "../services/VideoDirectoryService";
import { Path } from "@effect/platform";
import { SqliteClient } from "@effect/sql-sqlite-bun";

export const SqlLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { baseDir } = yield* VideoDirectoryService;
    const path = yield* Path.Path;
    return SqliteClient.layer({ filename: path.resolve(baseDir, "videos.db") });
  }),
).pipe(Layer.provide(VideoDirectoryService.Default));
