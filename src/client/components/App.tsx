import { FetchHttpClient, HttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Data, Effect, Layer, Option, ParseResult, Schema, Stream } from "effect";
import { Atom, useAtomValue, useAtomSet, AtomRpc, Result } from "@effect-atom/atom-react";
import { DownloadRpcs } from "@/schema/rpc/download";
import { Add01Icon, VideoReplayIcon } from "hugeicons-react";
import { Reactivity } from "@effect/experimental";
import type { VideoInfo } from "@/schema/videos";
import type { VideoDownloadStatus } from "@/schema/videos";
import { EnhancedVideoInfo } from "@/schema/videos";

// IndexedDB Error Types
class IndexedDBOpenError extends Data.TaggedError("IndexedDBOpenError")<{
  cause: unknown;
}> {}

class IndexedDBReadError extends Data.TaggedError("IndexedDBReadError")<{
  cause: unknown;
}> {}

class IndexedDBWriteError extends Data.TaggedError("IndexedDBWriteError")<{
  cause: unknown;
}> {}

class IndexedDBParseError extends Data.TaggedError("IndexedDBParseError")<{
  cause: ParseResult.ParseError;
}> {}

// Schema for stored records
const StoredVideo = Schema.Struct({
  id: Schema.String,
  index: Schema.Number,
  data: EnhancedVideoInfo,
  blob: Schema.optionalWith(Schema.Uint8ArrayFromSelf, { as: "Option" }),
});

const StoredVideos = Schema.Array(StoredVideo);

// Helper to open IndexedDB
const openDatabase = (): Effect.Effect<IDBDatabase, IndexedDBOpenError> =>
  Effect.async((resume) => {
    const request = indexedDB.open("dlp-ui", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resume(Effect.succeed(request.result));
    request.onerror = () => resume(Effect.fail(new IndexedDBOpenError({ cause: request.error })));
  });

class LocalVideoService extends Effect.Service<LocalVideoService>()("LocalVideoService", {
  effect: Effect.gen(function* () {
    const db = yield* openDatabase();

    return {
      set: (videos: EnhancedVideoInfo[]): Effect.Effect<void, IndexedDBWriteError | IndexedDBReadError> =>
        Effect.gen(function* () {
          // First, read existing records to preserve blobs
          const existingBlobs = yield* Effect.async<Map<string, Uint8Array>, IndexedDBReadError>((resume) => {
            const transaction = db.transaction("videos", "readonly");
            const store = transaction.objectStore("videos");
            const request = store.getAll();

            request.onsuccess = () => {
              const blobMap = new Map<string, Uint8Array>();
              for (const record of request.result) {
                if (record.blob) blobMap.set(record.id, record.blob);
              }
              resume(Effect.succeed(blobMap));
            };
            request.onerror = () => resume(Effect.fail(new IndexedDBReadError({ cause: request.error })));
          });

          // Now write with preserved blobs
          yield* Effect.async<void, IndexedDBWriteError>((resume) => {
            const transaction = db.transaction("videos", "readwrite");
            const store = transaction.objectStore("videos");

            store.clear();
            videos.forEach((video, index) => {
              const existingBlob = existingBlobs.get(video.info.id);
              store.put({
                id: video.info.id,
                index,
                data: video,
                blob: existingBlob,
              });
            });

            transaction.oncomplete = () => resume(Effect.void);
            transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
          });
        }),

      setBlob: (id: string, blob: Uint8Array): Effect.Effect<void, IndexedDBWriteError | IndexedDBReadError> =>
        Effect.async((resume) => {
          const transaction = db.transaction("videos", "readwrite");
          const store = transaction.objectStore("videos");
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (existing) {
              existing.blob = blob;
              store.put(existing);
            }
          };

          transaction.oncomplete = () => resume(Effect.void);
          transaction.onerror = () => resume(Effect.fail(new IndexedDBWriteError({ cause: transaction.error })));
        }),

      get: (): Effect.Effect<Option.Option<EnhancedVideoInfo[]>, IndexedDBReadError | IndexedDBParseError> =>
        Effect.async<unknown[], IndexedDBReadError>((resume) => {
          const transaction = db.transaction("videos", "readonly");
          const store = transaction.objectStore("videos");
          const request = store.getAll();

          request.onsuccess = () => resume(Effect.succeed(request.result));
          request.onerror = () => resume(Effect.fail(new IndexedDBReadError({ cause: request.error })));
        }).pipe(
          Effect.flatMap((records) =>
            Schema.decodeUnknown(StoredVideos)(records).pipe(
              Effect.mapError((cause) => new IndexedDBParseError({ cause })),
            ),
          ),
          Effect.map((records) => {
            const sorted = records.toSorted((a, b) => a.index - b.index);
            const videos = sorted.map((r) => r.data);
            return videos.length === 0 ? Option.none() : Option.some(videos);
          }),
        ),
    };
  }),
}) {}

class DownloadClient extends AtomRpc.Tag<DownloadClient>()("DownloadClient", {
  group: DownloadRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson),
  ),
}) {}

class LocalVideoDownloadService extends Effect.Service<LocalVideoDownloadService>()("LocalVideoDownloadService", {
  dependencies: [LocalVideoService.Default],
  effect: Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const localVideoService = yield* LocalVideoService;

    const download = Effect.fn(function* (id: string) {
      // TODO: Consider storage quota checks before storing large video blobs
      const response = yield* httpClient.get(`/api/videos/${id}`);
      const buffer = yield* response.arrayBuffer;
      const blob = new Uint8Array(buffer);

      yield* localVideoService.setBlob(id, blob);
    });

    return { download };
  }),
}) {}

const videosAtom = DownloadClient.query("GetVideos", void 0, { reactivityKeys: ["videos"] });
const runtime = Atom.runtime(
  DownloadClient.layer.pipe(
    Layer.merge(Layer.orDie(LocalVideoService.Default)),
    Layer.merge(LocalVideoDownloadService.Default),
    Layer.provide(FetchHttpClient.layer),
  ),
);

const cachedVideosAtom = runtime.atom((get) => {
  return Effect.gen(function* () {
    const localVideoService = yield* LocalVideoService;
    const cache = yield* localVideoService.get();

    const cacheStream = Option.isSome(cache) ? Stream.make(cache.value) : Stream.empty;

    const serverStream = get.streamResult(videosAtom).pipe(
      Stream.tap((value) => {
        return localVideoService.set(value as EnhancedVideoInfo[]);
      }),
      Stream.catchAll(() => {
        console.log("TODO: Throw a toast or something to inform user of error but still keep online working well");
        return Stream.empty;
      }),
    );

    return Stream.concat(cacheStream, serverStream);
  }).pipe(Stream.unwrap);
});

const downloadAtom = DownloadClient.runtime.fn(
  Effect.fnUntraced(function* (url: string) {
    const client = yield* DownloadClient;

    const videoInfo = yield* client("Download", {
      url: new URL(url),
    });

    yield* Reactivity.invalidate(["videos"]);

    return videoInfo;
  }),
);

const getDownloadProgressByIdAtom = Atom.family((id: string | null) => {
  return DownloadClient.runtime.atom(
    id == null
      ? Stream.empty
      : Effect.gen(function* () {
          const client = yield* DownloadClient;
          return client("GetDownloadProgress", { id });
        }).pipe(Stream.unwrap, Stream.onEnd(Reactivity.invalidate(["videos"]))),
  );
});

const videoDownloadAtom = runtime.fn(Effect.serviceFunctions(LocalVideoDownloadService).download);

function DownloadLineItem({ video, status }: { video: VideoInfo; status: VideoDownloadStatus }) {
  const result = useAtomValue(getDownloadProgressByIdAtom(status === "downloading" ? video.id : null));
  const download = useAtomSet(videoDownloadAtom);

  return (
    <li>
      {video.title} <span className="text-neutral-10">({status})</span>
      {status === "complete" && <button onClick={async () => download(video.id)}>Download</button>}
      <div>
        {result._tag === "Success" && (
          <span>
            {result.value.downloaded_bytes} / {result.value.total_bytes}
          </span>
        )}
      </div>
    </li>
  );
}

export default function HomePage() {
  // Use the videos atom - this will automatically fetch on mount
  const videosResult = useAtomValue(cachedVideosAtom);

  // Get the download function
  const download = useAtomSet(downloadAtom);

  const handleClick = () => {
    const video = prompt("Enter video URL", "https://www.youtube.com/watch?v=3PFLeteDuyQ");

    if (!video) return;

    // Trigger the download
    download(video);
  };

  return (
    <div>
      <header className="flex justify-end p-4">
        <button
          onClick={handleClick}
          className={`
            rounded-full border border-solid border-neutral-6 bg-neutral-3 p-3 text-neutral-12
            shadow-xs shadow-neutral-4
            hover:border-neutral-7 hover:bg-neutral-4
          `}
        >
          <span className="sr-only">Add</span>
          <Add01Icon strokeWidth={2.5} size={16} />
        </button>
      </header>
      <ul>
        {videosResult._tag === "Success" &&
          videosResult.value.map((video) => (
            <DownloadLineItem key={video.info.id} video={video.info} status={video.status} />
          ))}
      </ul>
    </div>
  );
}
