import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "./app.js";

// The public status page says which commit is live, so a deploy can be
// confirmed from outside without logging in. Render sets RENDER_GIT_COMMIT on
// every deploy; nothing is shown for a local run where it isn't set.
describe("the public status page", () => {
  const original = process.env.RENDER_GIT_COMMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = original;
  });

  it("says which commit is live, in short form, from the variable Render sets on every deploy", async () => {
    process.env.RENDER_GIT_COMMIT = "0123456789abcdef0123456789abcdef01234567";
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toBe("FlipPilot Office backend running");
    expect(res.body.commit).toBe("0123456");
  });

  it("leaves the commit out when it isn't known, as on a local run", async () => {
    process.env.RENDER_GIT_COMMIT = "";
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("commit");
  });
});
