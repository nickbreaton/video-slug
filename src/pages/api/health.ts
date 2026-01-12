import type { APIRoute } from "astro";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpServerResponse } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { DateTime } from "effect";

const runtime = ManagedRuntime.make(BunContext.layer);

export const GET: APIRoute = async () => {
  const program = Effect.gen(function* () {
    const now = yield* DateTime.now;
    const formatted = DateTime.formatIso(now);
    return HttpServerResponse.text(`Ok\n\n${formatted}`).pipe(
      HttpServerResponse.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private"),
      HttpServerResponse.setHeader("Pragma", "no-cache"),
      HttpServerResponse.setHeader("Expires", "0"),
      HttpServerResponse.toWeb,
    );
  });

  return runtime.runPromise(program);
};

export const prerender = false;
