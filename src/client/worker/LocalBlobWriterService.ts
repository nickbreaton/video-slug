import { Effect, Option } from "effect";
import { LocalBlobService } from "../services/LocalBlobService";

export class LocalBlobWriterService extends Effect.Service<LocalBlobWriterService>()("LocalBlobWriterService", {
  dependencies: [LocalBlobService.Default],
  effect: Effect.gen(function* () {
    const { directory } = yield* LocalBlobService;

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
    };
  }),
}) {}
