import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Layer } from "effect";
import { AtomRpc } from "@effect-atom/atom-react";
import { DownloadRpcs } from "@/schema/rpc/download";

export class DownloadClient extends AtomRpc.Tag<DownloadClient>()("DownloadClient", {
  group: DownloadRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson),
  ),
}) {}
