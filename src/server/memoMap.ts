import { Effect, Layer } from "effect";

export const memoMap = Effect.runSync(Layer.makeMemoMap);
