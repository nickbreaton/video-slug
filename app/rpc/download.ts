import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { DownloadProgress, VideoInfo } from "../schema";

export class DownloadInitiationError extends Schema.TaggedError<DownloadInitiationError>("DownloadInitiationError")(
  "DownloadInitiationError",
  {
    message: Schema.String,
  },
) {}

export class DownloadRpcs extends RpcGroup.make(
  Rpc.make("Download", {
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
    success: Schema.Array(VideoInfo),
    error: Schema.Void,
  }),
) {}
