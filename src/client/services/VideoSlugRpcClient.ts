import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Layer } from "effect";
import { AtomRpc } from "@effect-atom/atom-react";
import { VideoSlugRpcs } from "@/schema/rpc";

export class VideoSlugRpcClient extends AtomRpc.Tag<VideoSlugRpcClient>()("VideoSlugRpcClient", {
  group: VideoSlugRpcs,
  protocol: RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(RpcSerialization.layerNdjson),
  ),
}) {}
