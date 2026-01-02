import { Effect, Option, Stream } from "effect";

export class LocalBlobService extends Effect.Service<LocalBlobService>()("LocalBlobService", {
  dependencies: [],
  effect: Effect.gen(function* () {
    const root = yield* Effect.tryPromise({
      try: () => navigator.storage.getDirectory(),
      catch: () => "TODO_OPFSInitializationError" as const,
    });

    const directory = yield* Effect.tryPromise({
      try: () => root.getDirectoryHandle("videos", { create: true }),
      catch: () => "TODO_OPFSInitializationError" as const,
    });

    return {
      directory,

      get: (id: string) =>
        Effect.gen(function* () {
          const fileHandle = yield* Effect.tryPromise(() => directory.getFileHandle(id)).pipe(
            Effect.map((value) => Option.some(value)),
            Effect.catchAll(() => Effect.succeed(Option.none())),
          );

          if (!Option.isSome(fileHandle)) {
            return Option.none();
          }

          const file: Blob = yield* Effect.tryPromise({
            try: () => fileHandle.value.getFile(),
            catch: () => "TODO_OPFSReadError" as const,
          });

          return Option.some(file);
        }),

      exists: (id: string) =>
        Effect.promise(() => directory.getFileHandle(id, { create: false })).pipe(
          Effect.as(true),
          Effect.catchAllCause(() => Effect.succeed(false)),
        ),

      garbageCollect: (validIds: string[]) =>
        Effect.gen(function* () {
          const fastValidIds = new Set(validIds);

          // @ts-expect-error - OPFS-specific entries do not have types
          const entries: AsyncIterable<[string, FileSystemFileHandle]> = directory.entries();

          yield* Stream.fromAsyncIterable(entries, () => "TODO_DirectoryListError" as const).pipe(
            Stream.map(([id]) => id),
            Stream.filter((id) => !fastValidIds.has(id)),
            Stream.mapEffect(
              (id) =>
                Effect.tryPromise({
                  try: () => directory.removeEntry(id),
                  catch: () => "TODO_FileRemoveError" as const,
                }),
              { concurrency: "unbounded" },
            ),
            Stream.runDrain,
          );
        }),
    };
  }),
}) {}
