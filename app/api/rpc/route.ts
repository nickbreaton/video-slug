import { User, UserRpcs } from "@/app/rpc/download";
import { NodeHttpServer } from "@effect/platform-node";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer } from "effect";

export const UsersLive = UserRpcs.toLayer(
  Effect.gen(function* () {
    // const db = yield* UserRepository;

    return {
      // UserList: () => Stream.fromIterableEffect(db.findMany),
      UserById: ({ id }) => Effect.succeed(User.make({ id, name: "John Doe" })),
    };
  }),
);

const RpcLive = Layer.mergeAll(
  UsersLive,
  RpcSerialization.layerNdjson,
  NodeHttpServer.layerContext,
);

const { handler } = RpcServer.toWebHandler(UserRpcs, { layer: RpcLive });

export const POST = (request: Request) => handler(request);
