import { Schema } from "effect";

export class DownloadProgress extends Schema.Class<DownloadProgress>(
  "DownloadProgress",
)({
  status: Schema.Literal("downloading"),
  // Core progress metrics
  downloaded_bytes: Schema.Number,
  total_bytes: Schema.NullOr(Schema.Number),
  eta: Schema.NullOr(Schema.Number),
  speed: Schema.NullOr(Schema.Number),
  percentage: Schema.NullOr(Schema.Number),
  elapsed: Schema.NullOr(Schema.Number),
  // Video info - metadata
  id: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  ext: Schema.NullOr(Schema.String),
  filename: Schema.NullOr(Schema.String),
  duration: Schema.NullOr(Schema.Number),
  uploader: Schema.NullOr(Schema.String),
  upload_date: Schema.NullOr(Schema.String),
  channel: Schema.NullOr(Schema.String),
  view_count: Schema.NullOr(Schema.Number),
  thumbnail: Schema.NullOr(Schema.String),
  webpage_url: Schema.NullOr(Schema.String),
}) {}

export const YtDlpOutput = Schema.Union(
  Schema.parseJson(DownloadProgress),
  Schema.String,
);
