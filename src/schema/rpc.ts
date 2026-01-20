import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { DownloadProgress, EnhancedVideoInfo, PlaybackTimeEntry, VideoInfo } from "./videos.js";

export class DownloadInitiationError extends Schema.TaggedError<DownloadInitiationError>("DownloadInitiationError")(
  "DownloadInitiationError",
  {
    message: Schema.String,
  },
) {}

export class VideoDeletionError extends Schema.TaggedError<VideoDeletionError>("VideoDeletionError")(
  "VideoDeletionError",
  {},
) {}

export class VideoSlugRpcs extends RpcGroup.make(
  Rpc.make("SaveVideo", {
    success: VideoInfo,
    error: DownloadInitiationError,
    payload: {
      url: Schema.URL,
    },
  }),
  Rpc.make("GetDownloadProgress", {
    success: DownloadProgress,
    error: Schema.Void,
    stream: true,
    payload: {
      id: Schema.String,
    },
  }),
  Rpc.make("GetVideos", {
    success: Schema.Array(EnhancedVideoInfo),
    error: Schema.Void,
    payload: Schema.Void,
  }),
  Rpc.make("DeleteVideo", {
    success: Schema.Void,
    error: VideoDeletionError,
    payload: {
      id: Schema.String,
    },
  }),
  Rpc.make("UpdateTimestamp", {
    success: Schema.Void,
    error: Schema.Void,
    payload: {
      id: Schema.String,
      value: PlaybackTimeEntry,
    },
  }),
) {}
