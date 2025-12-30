import { Effect, Option } from "effect";

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
      set: (id: string, blob: Blob) =>
        Effect.gen(function* () {
          const writable = yield* Effect.tryPromise({
            try: () =>
              directory
                .getFileHandle(id, { create: true })
                .then((file) => file.createWritable({ keepExistingData: false })), // TODO: change to true and do chunk by chunk
            catch: () => "TODO_OPFSWriteError" as const,
          });

          yield* Effect.tryPromise({
            try: () => writable.write(blob),
            catch: () => "TODO_OPFSWriteError" as const,
          });

          yield* Effect.tryPromise({
            try: () => writable.close(),
            catch: () => "TODO_OPFSWriteError" as const,
          });
        }),

      get: (id: string) =>
        Effect.gen(function* () {
          const fileHandle = yield* Effect.tryPromise(() => directory.getFileHandle(id)).pipe(
            Effect.map((value) => Option.some(value)),
            Effect.catchAll(() => Option.none()),
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

      garbageCollect: (validIds: string[]) => Effect.gen(function* () {}),
    };
  }),
}) {}
