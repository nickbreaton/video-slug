import { useAtomValue, useAtomSet, useAtomSuspense, Result } from "@effect-atom/atom-react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Delete01Icon,
  MultiplicationSignIcon,
  DownloadSquare01Icon,
  Loading03Icon,
  AlertCircleIcon,
} from "hugeicons-react";
import { EnhancedVideoInfo } from "@/schema/videos";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Suspense, type ReactNode } from "react";
import {
  cachedVideosAtom,
  deleteFromLibraryAtom,
  deleteLocalVideoAtom,
  downloadAtom,
  getDownloadProgressByIdAtom,
  getLocalDownloadProgressAtom,
  getVideoByIdAtom,
  localVideoUrl,
  videoDownloadAtom,
} from "./atoms";

// Helper functions
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatUploadDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr.length !== 8) return "";
  const year = dateStr.slice(0, 4);
  const month = parseInt(dateStr.slice(4, 6), 10) - 1;
  const day = parseInt(dateStr.slice(6, 8), 10);
  const date = new Date(parseInt(year, 10), month, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Layout component with sticky header
function Layout({
  children,
  title,
  leftAction,
  rightActions,
}: {
  children: ReactNode;
  title?: ReactNode;
  leftAction?: ReactNode;
  rightActions?: ReactNode;
}) {
  return (
    <div
      className={`
        min-h-screen bg-neutral-1
        sm:my-8
      `}
    >
      <div className="mx-auto max-w-4xl">
        {/* Sticky header - no top border on mobile (blends into safe area), bordered on desktop */}
        <header
          className={`
            sticky top-0 z-50 border-b border-neutral-6 bg-neutral-1/95 backdrop-blur-sm
            sm:border-x sm:border-t
          `}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div
            className={`
              flex items-center justify-between px-4 py-3
              sm:px-6 sm:py-4
            `}
          >
            <div className="flex items-center gap-3">
              {leftAction}
              {title && (
                <h1
                  className={`
                    text-base font-medium text-neutral-12
                    sm:text-lg
                  `}
                >
                  {title}
                </h1>
              )}
            </div>
            {rightActions && (
              <div
                className={`
                  flex items-center gap-2
                  sm:gap-3
                `}
              >
                {rightActions}
              </div>
            )}
          </div>
        </header>

        {/* Main content area */}
        <main
          className={`
            border-neutral-6
            sm:border-x sm:border-b
          `}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// Separator component - inset on mobile, full-width on desktop
function Separator() {
  return (
    <div
      className={`
        mx-4 border-b border-neutral-6
        sm:mx-0
      `}
    />
  );
}

function DownloadLineItem({ video, isLast }: { video: EnhancedVideoInfo; isLast: boolean }) {
  const serverDownloadProgress = useAtomValue(
    getDownloadProgressByIdAtom(video.status === "downloading" ? video.info.id : null),
  );
  const localDownloadProgressResult = useAtomValue(getLocalDownloadProgressAtom(video));

  const deleteLocalVideo = useAtomSet(deleteLocalVideoAtom);
  const downloadToLocal = useAtomSet(videoDownloadAtom(video.info.id), {
    mode: "promise",
  });

  // Compute local download state
  const localProgress = Result.match(localDownloadProgressResult, {
    onInitial: () => 0,
    onSuccess: ({ value }) => value,
    onFailure: () => 0,
  });
  const isOfflineReady = localProgress === 100;
  const isLocalDownloading = localProgress > 0 && localProgress < 100;

  // Build metadata string
  const metaParts: string[] = [];
  if (video.info.uploader) metaParts.push(video.info.uploader);
  if (video.info.duration) metaParts.push(formatDuration(video.info.duration));

  return (
    <>
      <li className="list-none">
        <div
          className={`
            flex gap-3 px-4 py-3
            sm:gap-4 sm:px-6 sm:py-4
          `}
        >
          {/* Thumbnail */}
          {video.info.thumbnail && (
            <Link to={`/video/${video.info.id}`} className="shrink-0">
              <img
                src={`/api/thumbnail/${video.info.id}`}
                alt=""
                className={`
                  h-16 w-16 rounded object-cover
                  sm:h-20 sm:w-20
                `}
              />
            </Link>
          )}

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            {/* Title */}
            <Link
              to={`/video/${video.info.id}`}
              className={`
                line-clamp-2 text-sm font-medium text-neutral-12
                hover:underline
              `}
            >
              {video.info.title}
            </Link>

            {/* Metadata row */}
            {metaParts.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-10">
                {video.info.uploader && <span>{video.info.uploader}</span>}
                {video.info.uploader && video.info.duration && <span className="text-neutral-8">{"\u00B7"}</span>}
                {video.info.duration && (
                  <span className="font-mono text-neutral-9">{formatDuration(video.info.duration)}</span>
                )}
              </div>
            )}

            {/* Status row */}
            <div className="flex items-center gap-2 text-xs">
              {video.status === "downloading" && (
                <span className="flex items-center gap-1 text-neutral-10">
                  <Loading03Icon size={12} className="animate-spin" />
                  <span>Adding to library</span>
                  {serverDownloadProgress._tag === "Success" && (
                    <span className="font-mono">
                      {Math.round(
                        (serverDownloadProgress.value.downloaded_bytes / serverDownloadProgress.value.total_bytes) *
                          100,
                      )}
                      %
                    </span>
                  )}
                </span>
              )}
              {video.status === "error" && (
                <span className="flex items-center gap-1 text-neutral-10">
                  <AlertCircleIcon size={12} />
                  <span>Error</span>
                </span>
              )}
              {video.status === "complete" && isOfflineReady && (
                <span className="flex items-center gap-1 text-neutral-10">
                  <CheckmarkCircle02Icon size={12} />
                  <span>Offline</span>
                </span>
              )}
              {video.status === "complete" && isLocalDownloading && (
                <span className="flex items-center gap-1 text-neutral-10">
                  <Loading03Icon size={12} className="animate-spin" />
                  <span>Saving to device</span>
                  <span className="font-mono">{localProgress}%</span>
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {video.status === "complete" && (
              <>
                {isOfflineReady ? (
                  <button
                    onClick={() => deleteLocalVideo(video.info.id)}
                    className={`
                      flex items-center justify-center p-2 text-neutral-10 transition-colors
                      hover:bg-neutral-3 hover:text-neutral-11
                    `}
                    title="Remove from device"
                  >
                    <Delete01Icon size={16} strokeWidth={2} />
                  </button>
                ) : !isLocalDownloading ? (
                  <button
                    onClick={() => downloadToLocal()}
                    className={`
                      flex items-center justify-center p-2 text-neutral-10 transition-colors
                      hover:bg-neutral-3 hover:text-neutral-11
                    `}
                    title="Save to device"
                  >
                    <DownloadSquare01Icon size={16} strokeWidth={2} />
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </li>
      {!isLast && <Separator />}
    </>
  );
}

function HomePage() {
  const videosResult = useAtomSuspense(cachedVideosAtom);
  const download = useAtomSet(downloadAtom);

  const handleAddVideo = () => {
    const video = prompt("Enter video URL");
    if (!video) return;
    download(video);
  };

  const videos = videosResult._tag === "Success" ? videosResult.value : [];

  return (
    <Layout
      title="VideoSlug"
      rightActions={
        <button
          onClick={handleAddVideo}
          className={`
            flex items-center justify-center border border-neutral-6 bg-neutral-2 p-2
            text-neutral-11 transition-colors
            hover:border-neutral-7 hover:bg-neutral-3
            active:bg-neutral-4
          `}
        >
          <span className="sr-only">Add video</span>
          <Add01Icon strokeWidth={2} size={16} />
        </button>
      }
    >
      {videos.length === 0 ? (
        <div className="px-6 py-16 text-center text-neutral-10">
          <p className="mb-1 text-neutral-11">No videos yet</p>
          <p className="text-sm">Add a video to get started</p>
        </div>
      ) : (
        <ul>
          {videos.map((video, index) => (
            <DownloadLineItem key={video.info.id} video={video} isLast={index === videos.length - 1} />
          ))}
        </ul>
      )}
    </Layout>
  );
}

function VideoPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();

  const videoResult = useAtomSuspense(getVideoByIdAtom(params.id!));
  const localVideoUrlResult = useAtomSuspense(localVideoUrl(params.id!));

  const localDownloadProgressResult = useAtomValue(
    getLocalDownloadProgressAtom(
      videoResult._tag === "Success"
        ? videoResult.value
        : { id: params.id!, info: { id: params.id!, title: "", filename: "" }, status: "complete" as const },
    ),
  );

  const deleteLocalVideo = useAtomSet(deleteLocalVideoAtom);
  const downloadToLocal = useAtomSet(videoDownloadAtom(params.id!), { mode: "promise" });
  const deleteFromLibrary = useAtomSet(deleteFromLibraryAtom(params.id!), { mode: "promise" });

  const videoSrc = Result.getOrElse(localVideoUrlResult, () => null) ?? `/api/video/${params.id}`;
  const video = videoResult._tag === "Success" ? videoResult.value : null;

  // Compute local download state
  const localProgress = Result.match(localDownloadProgressResult, {
    onInitial: () => 0,
    onSuccess: ({ value }) => value,
    onFailure: () => 0,
  });
  const isOfflineReady = localProgress === 100;
  const isLocalDownloading = localProgress > 0 && localProgress < 100;

  return (
    <Layout
      leftAction={
        <Link
          to="/"
          className={`
            flex items-center justify-center p-1 text-neutral-10 transition-colors
            hover:text-neutral-11
          `}
        >
          <ArrowLeft01Icon size={18} strokeWidth={2} />
        </Link>
      }
      title="VideoSlug"
    >
      {/* Video Player */}
      <div className="aspect-video w-full bg-neutral-2">
        <video src={videoSrc} controls className="h-full w-full" playsInline />
      </div>

      {/* Video Info */}
      {video && (
        <div
          className={`
            px-4 py-4
            sm:px-6 sm:py-6
          `}
        >
          {/* Title */}
          <h1
            className={`
              text-lg font-medium text-neutral-12
              sm:text-xl
            `}
          >
            {video.info.title}
          </h1>

          {/* Metadata row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-10">
            {video.info.uploader && <span>{video.info.uploader}</span>}
            {video.info.uploader && video.info.duration && <span className="text-neutral-8">{"\u00B7"}</span>}
            {video.info.duration && (
              <span className="font-mono text-neutral-9">{formatDuration(video.info.duration)}</span>
            )}
            {(video.info.uploader || video.info.duration) && video.info.upload_date && (
              <span className="text-neutral-8">{"\u00B7"}</span>
            )}
            {video.info.upload_date && <span>{formatUploadDate(video.info.upload_date)}</span>}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {video.status === "complete" && (
              <>
                {isOfflineReady ? (
                  <button
                    onClick={() => deleteLocalVideo(params.id!)}
                    className={`
                      flex items-center gap-2 border border-neutral-6 bg-neutral-2 px-3 py-1.5
                      text-sm text-neutral-11 transition-colors
                      hover:border-neutral-7 hover:bg-neutral-3
                    `}
                  >
                    <CheckmarkCircle02Icon size={14} />
                    <span>Saved offline</span>
                  </button>
                ) : isLocalDownloading ? (
                  <button
                    disabled
                    className={`
                      flex items-center gap-2 border border-neutral-6 bg-neutral-2 px-3 py-1.5
                      text-sm text-neutral-10
                    `}
                  >
                    <Loading03Icon size={14} className="animate-spin" />
                    <span>Saving to device</span>
                    <span className="font-mono">{localProgress}%</span>
                  </button>
                ) : (
                  <button
                    onClick={() => downloadToLocal()}
                    className={`
                      flex items-center gap-2 border border-neutral-6 bg-neutral-2 px-3 py-1.5
                      text-sm text-neutral-11 transition-colors
                      hover:border-neutral-7 hover:bg-neutral-3
                    `}
                  >
                    <DownloadSquare01Icon size={14} />
                    <span>Save to device</span>
                  </button>
                )}
                <button
                  onClick={async () => {
                    await deleteFromLibrary();
                    navigate("/");
                  }}
                  className={`
                    flex items-center gap-2 border border-neutral-6 bg-neutral-2 px-3 py-1.5 text-sm
                    text-neutral-11 transition-colors
                    hover:border-neutral-7 hover:bg-neutral-3
                  `}
                >
                  <MultiplicationSignIcon size={14} />
                  <span>Delete from library</span>
                </button>
              </>
            )}
          </div>

          {/* Description */}
          {video.info.description && (
            <div className="mt-6 border-t border-neutral-6 pt-4">
              <p className="text-sm whitespace-pre-wrap text-neutral-11">{video.info.description}</p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-1 text-neutral-11">Loading...</div>
      }
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/video/:id" element={<VideoPage />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}
