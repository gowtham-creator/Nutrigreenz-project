/**
 * Turn an {@link InputTooLongError} thrown anywhere inside a route handler into
 * a 400 that names the offending field.
 *
 * ── Why a wrapper rather than a try/catch in each handler ─────────────────
 *
 * Length checking happens deep in the input builders, several calls below the
 * handler, and it can fire from any one of a dozen fields. Catching it at each
 * call site would mean a try/catch around every `strictText(...)`, which is
 * both unreadable and exactly the kind of repetition that gets missed on the
 * next route someone adds. Catching it once at the boundary means a new field
 * is protected the moment it uses `strictText`, with nothing else to remember.
 *
 * Anything that is not an InputTooLongError is rethrown untouched, so this
 * cannot swallow a real fault and turn a 500 into a misleading 400.
 */
import { InputTooLongError } from "@/lib/sanitize-text";

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** Wrap a route handler so over-length input answers 400 instead of 500. */
export function withLengthValidation<A extends unknown[]>(handler: Handler<A>): Handler<A> {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof InputTooLongError) {
        return Response.json(
          { ok: false, field: err.field, error: err.message },
          { status: 400 },
        );
      }
      throw err;
    }
  };
}
