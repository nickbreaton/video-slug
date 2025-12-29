import { YtDlpOutput } from "@/schema/videos";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, Option, Stream } from "effect";

export class DownloadStreamManager extends Effect.Service<DownloadStreamManager>()(
  "DownloadStreamManager",
  {
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
  },
) {}
