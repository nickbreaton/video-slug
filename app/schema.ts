import { Schema } from "effect";

export class DownloadProgress extends Schema.Class<DownloadProgress>(
  "DownloadProgress",
)({
  status: Schema.Literal("downloading"),
  downloaded_bytes: Schema.Number,
  total_bytes: Schema.NullOr(Schema.Number),
  eta: Schema.NullOr(Schema.Number),
  speed: Schema.NullOr(Schema.Number),
}) {}

export const YtDlpOutput = Schema.Union(
  Schema.parseJson(DownloadProgress),
  Schema.String,
);
