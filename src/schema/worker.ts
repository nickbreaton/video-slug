import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";

export class WorkerVideoFetchError extends Schema.TaggedError<WorkerVideoFetchError>("WorkerVideoFetchError")(
  "WorkerVideoFetchError",
  {
    reason: Schema.String,
    id: Schema.String,
  },
) {}

export const WorkerRpcs = RpcGroup.make(
  Rpc.make("FetchVideo", {
    payload: {
      id: Schema.String,
    },
    success: Schema.Number,
    error: WorkerVideoFetchError,
    stream: true,
  }),
);
