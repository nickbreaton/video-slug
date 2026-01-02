import { Effect } from "effect";
import { LocalBlobService } from "../services/LocalBlobService";
import { OriginPrivateFileSystem, OriginPrivateFileSystemError } from "../services/OriginPrivateFileSystem";

export class LocalBlobWriterService extends Effect.Service<LocalBlobWriterService>()("LocalBlobWriterService", {
  dependencies: [LocalBlobService.Default, OriginPrivateFileSystem.Default],
  effect: Effect.gen(function* () {
    const { directory } = yield* LocalBlobService;
    const opfs = yield* OriginPrivateFileSystem;

    return {
      createWriteHandle: (id: string) =>
        Effect.gen(function* () {
          const fileHandle = yield* opfs.getFileHandle(directory, id, { create: true });

          const accessHandle = yield* Effect.tryPromise({
            try: () => fileHandle.createSyncAccessHandle(),
            catch: (cause) => new OriginPrivateFileSystemError({ type: "NotAllowedError", cause }),
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
                catch: (cause) => new OriginPrivateFileSystemError({ type: "UnknownError", cause }),
              }),

            fileHandle,
          };
        }),
    };
  }),
}) {}
