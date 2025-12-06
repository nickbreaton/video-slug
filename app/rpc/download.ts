import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { VideoInfo } from "../schema";

export class DownloadInitiationError extends Schema.TaggedError<DownloadInitiationError>(
  "DownloadInitiationError",
)("DownloadInitiationError", {
  message: Schema.String,
}) {}

export class DownloadRpcs extends RpcGroup.make(
  Rpc.make("Download", {
    success: VideoInfo,
    error: DownloadInitiationError,
    payload: {
      url: Schema.URL,
    },
  }),
) {}
