import { Array, Effect } from "effect";
import { VideoDirectoryService } from "./VideoDirectoryService";
import { VideoRepo } from "./VideoRepo";
import { FileSystem, Path } from "@effect/platform";

export class DownloadGarbageCollecter extends Effect.Service<DownloadGarbageCollecter>()("DownloadGarbageCollecter", {
  dependencies: [VideoDirectoryService.Default, VideoRepo.Default],
  effect: Effect.gen(function* () {
    const { videosDir } = yield* VideoDirectoryService;
    const videoRepo = yield* VideoRepo;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const garbageCollect = Effect.gen(function* () {
      const videos = yield* videoRepo.getAll();
      const filesReferencedFromDatabase = videos.map((video) => video.info.filename);
      const filesInDirectory = yield* fs.readDirectory(videosDir);

      const filesMissingFromDatabase = Array.difference(filesInDirectory, filesReferencedFromDatabase);

      if (filesMissingFromDatabase.length === 0) {
        return;
      }

      yield* Effect.log("Removing orphaned video files").pipe(Effect.annotateLogs({ files: filesMissingFromDatabase }));

      for (const file of filesMissingFromDatabase) {
        const filePath = path.join(videosDir, file);
        yield* fs.remove(filePath);
      }
    });

    yield* Effect.forkDaemon(garbageCollect);

    return {};
  }),
}) {}
