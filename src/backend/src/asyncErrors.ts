// Makes Express 4 handle a failing `async` route handler the way Express 5 does.
//
// Express 4 calls a route handler and THROWS AWAY what it returns. So when an
// `async` handler throws (a bad value in stored data, a JSON body that puts an
// object where text was expected, ...) the rejected promise it returned has no one
// listening: Node treats that as an unhandled rejection and, since Node 15, EXITS
// THE WHOLE PROCESS. One process serves every dealership, so one bad request from
// anyone, logged in or not, could take every dealer offline, over and over (each
// restart finds the same bad record and dies again). A handler that throws
// synchronously was always safe (Express catches it and answers 500); the `async`
// keyword is what made it fatal.
//
// This wraps Layer.handle_request once, so EVERY handler and middleware, present
// and future, forwards a rejection to the error handler at the bottom of app.ts.

type Next = (err?: unknown) => void;
interface LayerLike {
  handle: (req: unknown, res: unknown, next: Next) => unknown;
}
const Layer = require("express/lib/router/layer") as {
  prototype: { handle_request: (this: LayerLike, req: unknown, res: unknown, next: Next) => void };
};

const MARK = Symbol.for("flippilot.asyncErrorsInstalled");
const proto = Layer.prototype as unknown as Record<symbol, unknown>;

if (!proto[MARK]) {
  proto[MARK] = true;
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // an error-handling middleware: not for this call
    try {
      const returned = fn(req, res, next);
      if (returned && typeof (returned as PromiseLike<unknown>).then === "function") {
        (returned as Promise<unknown>).then(undefined, next);
      }
    } catch (err) {
      next(err);
    }
  };
}

export {};
