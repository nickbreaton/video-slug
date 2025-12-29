import { Config, Effect } from "effect";
import { FileSystem, Path } from "@effect/platform";

export class VideoDirectoryService extends Effect.Service<VideoDirectoryService>()(
  "VideoDirectoryService",
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const baseDir = yield* Config.string("DOWNLOADS_DIR").pipe(Config.withDefault("./tmp"));
      const videosDir = path.join(baseDir, "videos");

      yield* fs.makeDirectory(videosDir, { recursive: true });

      return { baseDir, videosDir };
    }),
  },
) {}
