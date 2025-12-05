import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { VideoInfo } from "../schema";

export class DownloadRpcs extends RpcGroup.make(
  Rpc.make("Download", {
    success: VideoInfo,
    payload: {
      url: Schema.URL,
    },
  }),
) {}
