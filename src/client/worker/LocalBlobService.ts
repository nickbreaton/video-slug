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
      createWriteHandle: (id: string) =>
        Effect.gen(function* () {
          const fileHandle = yield* Effect.tryPromise({
            try: () => directory.getFileHandle(id, { create: true }),
            catch: () => "TODO" as const,
          });

          const accessHandle = yield* Effect.tryPromise({
            try: () => fileHandle.createSyncAccessHandle(),
            catch: () => "TODO" as const,
          });

          yield* Effect.addFinalizer(() => {
            return Effect.sync(() => accessHandle.close());
          });

          return {
            write: (offset: number, buffer: ArrayBuffer) =>
              Effect.try({
                try: () => {
                  accessHandle.write(buffer, { at: offset });
                  accessHandle.flush();
                },
                catch: () => "TODO_OPFSWriteError" as const,
              }),

            fileHandle,
          };
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
