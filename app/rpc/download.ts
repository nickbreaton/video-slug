import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { YtDlpOutput } from "../schema";

export class DownloadRpcs extends RpcGroup.make(
  Rpc.make("Download", {
    success: YtDlpOutput,
    stream: true,
    payload: {
      url: Schema.URL,
    },
  }),
) {}
