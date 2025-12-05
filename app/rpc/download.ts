import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class DownloadRpcs extends RpcGroup.make(
  Rpc.make("Download", {
    success: Schema.Void,
    // success: VideoInfo,
    payload: {
      url: Schema.URL,
    },
  }),
) {}
