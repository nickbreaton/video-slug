import { Command } from "@effect/platform";
import { Effect, Stream, Console, Schema } from "effect";
import { NodeContext } from "@effect/platform-node";
import { YtDlpOutput } from "./schema";

export async function download() {
  "use server";

  const program = Effect.gen(function* () {
    const command = Command.make(
      "yt-dlp",
      "https://youtu.be/LYrWA9_qas4",
      "--newline",
      "--progress-template",
      'download:{ "status": "downloading", "downloaded_bytes": %(progress.downloaded_bytes)s, "total_bytes": %(progress.total_bytes|null)s, "eta": %(progress.eta|null)s, "speed": %(progress.speed|null)s }',
      "-P",
      "tmp",
    );
    const result = yield* Command.stream(command).pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.mapEffect(Schema.decodeUnknown(YtDlpOutput)),
      Stream.runForEach((x) => Console.log(typeof x, x)),
    );
    return result;
  });

  const res = await Effect.runPromise(
    program.pipe(Effect.provide(NodeContext.layer)),
  );

  console.log(res);
}

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <button onClick={download}>Download</button>
    </div>
  );
}
