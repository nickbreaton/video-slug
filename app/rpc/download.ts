import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  name: Schema.String,
}) {}

export class UserRpcs extends RpcGroup.make(
  Rpc.make("UserById", {
    success: User,
    error: Schema.String,
    payload: {
      id: Schema.String,
    },
  }),
) {}
