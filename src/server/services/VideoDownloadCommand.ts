import { DownloadMessage, VideoNotFoundError, YtDlpOutput } from "@/schema/videos";
import { Command, CommandExecutor } from "@effect/platform";
import { Effect, Schema, Stream } from "effect";
import { VideoDirectoryService } from "@/server/services/VideoDirectoryService";

export class VideoDownloadCommand extends Effect.Service<VideoDownloadCommand>()(
  "VideoDownloadCommand",
  {
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
  },
) {}
