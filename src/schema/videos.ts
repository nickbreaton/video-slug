import { Schema } from "effect";

export class VideoInfo extends Schema.Class<VideoInfo>("VideoInfo")({
  id: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  uploader: Schema.optional(Schema.NullOr(Schema.String)),
  duration: Schema.optional(Schema.NullOr(Schema.Number)),
  webpage_url: Schema.optional(Schema.NullOr(Schema.String)),
  thumbnail: Schema.optional(Schema.NullOr(Schema.String)),
  upload_date: Schema.optional(Schema.NullOr(Schema.String)),
  filename: Schema.String,
}) {}

export class DownloadProgress extends Schema.Class<DownloadProgress>("DownloadProgress")({
  id: Schema.String,
  downloaded_bytes: Schema.Number,
  total_bytes: Schema.Number,
  eta: Schema.NullOr(Schema.Number),
  speed: Schema.NullOr(Schema.Number),
  elapsed: Schema.NullOr(Schema.Number),
}) {}

export class DownloadMessage extends Schema.Class<DownloadMessage>("DownloadMessage")({
  message: Schema.String,
}) {}

const DownloadMessageFromString = Schema.transform(Schema.String, DownloadMessage, {
  encode: (metadata) => metadata.message,
  decode: (message) => DownloadMessage.make({ message }),
});

export const YtDlpOutput = Schema.Union(
  Schema.parseJson(VideoInfo),
  Schema.parseJson(DownloadProgress),
  DownloadMessageFromString,
);

export class VideoNotFoundError extends Schema.TaggedError<VideoNotFoundError>("VideoNotFoundError")(
  "VideoNotFoundError",
  {},
) {}

export const VideoDownloadStatus = Schema.Literal("downloading", "error", "complete");
export type VideoDownloadStatus = typeof VideoDownloadStatus.Type;

export const EnhancedVideoInfo = Schema.Struct({
  info: VideoInfo,
  status: VideoDownloadStatus,
});
export type EnhancedVideoInfo = typeof EnhancedVideoInfo.Type;
