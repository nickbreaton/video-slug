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
      directory,

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

      garbageCollect: (validIds: string[]) =>
        Effect.gen(function* () {
          // TODO: implement this
        }),
    };
  }),
}) {}
