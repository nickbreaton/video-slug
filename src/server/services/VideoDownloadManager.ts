import { DownloadInitiationError } from "@/schema/rpc/download";
import { VideoInfo } from "@/schema/videos";
import { Console, Effect, Exit, Option, pipe, Scope, Stream } from "effect";
import { VideoDownloadCommand } from "@/server/services/VideoDownloadCommand";
import { DownloadStreamManager } from "@/server/services/DownloadStreamManager";
import { VideoRepo } from "@/server/services/VideoRepo";

export class VideoDownloadManager extends Effect.Service<VideoDownloadManager>()("VideoDownloadManager", {
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

      yield* pipe(
        videoRepo.insert(videoInfo.value),
        Effect.mapError(() => new DownloadInitiationError({ message: "Error saving video info" })),
      );

      // Fork stream into background
      yield* download.pipe(
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
