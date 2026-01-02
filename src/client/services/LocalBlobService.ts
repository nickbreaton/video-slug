import { Effect, Option, Stream } from "effect";
import { OriginPrivateFileSystem, OriginPrivateFileSystemError } from "./OriginPrivateFileSystem";

export class LocalBlobService extends Effect.Service<LocalBlobService>()("LocalBlobService", {
  dependencies: [OriginPrivateFileSystem.Default],
  effect: Effect.gen(function* () {
    const opfs = yield* OriginPrivateFileSystem;

    const directory = yield* opfs.getDirectoryHandle(yield* opfs.root, "videos", { create: true });

    return {
      directory,

      get: (id: string) =>
        Effect.gen(function* () {
          const fileHandle = yield* opfs.getFileHandle(directory, id).pipe(
            Effect.map((value) => Option.some(value)),
            Effect.catchAll(() => Effect.succeed(Option.none())),
          );

          if (!Option.isSome(fileHandle)) {
            return Option.none();
          }

          const file: Blob = yield* opfs.getFile(fileHandle.value);

          return Option.some(file);
        }),

      exists: (id: string) =>
        opfs.getFileHandle(directory, id, { create: false }).pipe(
          Effect.as(true),
          Effect.catchAll(() => Effect.succeed(false)),
        ),

      garbageCollect: (validIds: string[]) =>
        Effect.gen(function* () {
          const fastValidIds = new Set(validIds);

          yield* opfs.entries(directory).pipe(
            Stream.map(([id]) => id),
            Stream.filter((id) => !fastValidIds.has(id)),
            Stream.mapEffect((id) => opfs.removeEntry(directory, id), { concurrency: "unbounded" }),
            Stream.runDrain,
          );
        }),
    };
  }),
}) {}
