import { Data, Effect, Stream } from "effect";

export type OPFSErrorType =
  | "SecurityError"
  | "UnknownError"
  | "NotAllowedError"
  | "TypeError"
  | "TypeMismatchError"
  | "NotFoundError"
  | "InvalidModificationError"
  | "InvalidStateError"
  | "NoModificationAllowedError";

export class OriginPrivateFileSystemError extends Data.TaggedError("OriginPrivateFileSystemError")<{
  readonly type: OPFSErrorType;
  readonly cause: unknown;
}> {}

const getErrorType = (cause: unknown): OPFSErrorType => {
  if (cause instanceof DOMException && isOPFSErrorType(cause.name)) {
    return cause.name;
  }
  if (cause instanceof TypeError) {
    return "TypeError";
  }
  return "UnknownError";
};

const isOPFSErrorType = (name: string): name is OPFSErrorType => {
  return [
    "SecurityError",
    "UnknownError",
    "NotAllowedError",
    "TypeError",
    "TypeMismatchError",
    "NotFoundError",
    "InvalidModificationError",
    "InvalidStateError",
    "NoModificationAllowedError",
  ].includes(name);
};

export class OriginPrivateFileSystem extends Effect.Service<OriginPrivateFileSystem>()("OriginPrivateFileSystem", {
  effect: Effect.gen(function* () {
    const root = Effect.tryPromise({
      try: () => navigator.storage.getDirectory(),
      catch: (cause) => new OriginPrivateFileSystemError({ type: getErrorType(cause), cause }),
    });

    const getDirectoryHandle = (
      directory: FileSystemDirectoryHandle,
      name: string,
      options?: FileSystemGetDirectoryOptions,
    ) =>
      Effect.tryPromise({
        try: () => directory.getDirectoryHandle(name, options),
        catch: (cause) => new OriginPrivateFileSystemError({ type: getErrorType(cause), cause }),
      });

    const getFileHandle = (directory: FileSystemDirectoryHandle, name: string, options?: FileSystemGetFileOptions) =>
      Effect.tryPromise({
        try: () => directory.getFileHandle(name, options),
        catch: (cause) => new OriginPrivateFileSystemError({ type: getErrorType(cause), cause }),
      });

    const entries = (directory: FileSystemDirectoryHandle) =>
      Stream.fromAsyncIterable(
        // @ts-expect-error -- TypeScript doesn't include since its unaware of OPFS vs standard FileSystem API
        directory.entries() as AsyncIterableIterator<[string, FileSystemHandle]>,
        (cause) => new OriginPrivateFileSystemError({ type: getErrorType(cause), cause }),
      );

    const removeEntry = (directory: FileSystemDirectoryHandle, name: string, options?: FileSystemRemoveOptions) =>
      Effect.tryPromise({
        try: () => directory.removeEntry(name, options),
        catch: (cause) => new OriginPrivateFileSystemError({ type: getErrorType(cause), cause }),
      });

    const getFile = (fileHandle: FileSystemFileHandle) =>
      Effect.tryPromise({
        try: () => fileHandle.getFile(),
        catch: (cause) => new OriginPrivateFileSystemError({ type: getErrorType(cause), cause }),
      });

    return {
      root,
      getDirectoryHandle,
      getFileHandle,
      entries,
      removeEntry,
      getFile,
    };
  }),
}) {}
