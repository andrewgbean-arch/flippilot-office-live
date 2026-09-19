import { describe, it, expect } from "vitest";
import {
  MAX_MESSAGE_PHOTOS,
  anyUploading,
  canSendMessage,
  newPendingPhoto,
  patchPendingPhoto,
  readyPhotoIds,
  type PendingMessagePhoto,
} from "./messagePhotoAttachments";

function photo(status: PendingMessagePhoto["status"], extra: Partial<PendingMessagePhoto> = {}) {
  return { ...newPendingPhoto(), status, ...extra };
}

describe("newPendingPhoto", () => {
  it("starts uploading, with a local id no other photo shares", () => {
    const a = newPendingPhoto();
    const b = newPendingPhoto();
    expect(a.status).toBe("uploading");
    expect(a.previewUrl).toBe("");
    expect(a.localId).not.toBe(b.localId);
  });

  it("allows six photos on a message", () => {
    expect(MAX_MESSAGE_PHOTOS).toBe(6);
  });
});

describe("readyPhotoIds / anyUploading", () => {
  it("only counts photos that finished uploading, in the order added", () => {
    const list = [
      photo("done", { photoId: "one" }),
      photo("uploading"),
      photo("error", { error: "nope" }),
      photo("done", { photoId: "two" }),
    ];
    expect(readyPhotoIds(list)).toEqual(["one", "two"]);
    expect(anyUploading(list)).toBe(true);
  });

  it("is empty and idle for no photos, or only failed ones", () => {
    expect(readyPhotoIds([])).toEqual([]);
    expect(anyUploading([])).toBe(false);
    expect(anyUploading([photo("error", { error: "x" })])).toBe(false);
  });
});

describe("canSendMessage", () => {
  const done = () => [photo("done", { photoId: "p1" })];

  it("needs words or a finished photo", () => {
    expect(canSendMessage({ text: "", photos: [], sending: false })).toBe(false);
    expect(canSendMessage({ text: "   \n ", photos: [], sending: false })).toBe(false);
    expect(canSendMessage({ text: "hello", photos: [], sending: false })).toBe(true);
    expect(canSendMessage({ text: "", photos: done(), sending: false })).toBe(true);
  });

  it("does not count a failed photo as something to send", () => {
    const failed = [photo("error", { error: "too big" })];
    expect(canSendMessage({ text: "", photos: failed, sending: false })).toBe(false);
    // ...but words still go, without it
    expect(canSendMessage({ text: "hi", photos: failed, sending: false })).toBe(true);
  });

  it("waits while any photo is still uploading, even with words typed", () => {
    const busy = [...done(), photo("uploading")];
    expect(canSendMessage({ text: "hello", photos: busy, sending: false })).toBe(false);
  });

  it("needs a recipient when the message has one, and not when it doesn't", () => {
    expect(canSendMessage({ text: "hi", photos: [], hasRecipient: false, sending: false })).toBe(false);
    expect(canSendMessage({ text: "hi", photos: [], hasRecipient: true, sending: false })).toBe(true);
    // the team board has no recipient at all
    expect(canSendMessage({ text: "hi", photos: [], sending: false })).toBe(true);
  });

  it("refuses while a send is already under way", () => {
    expect(canSendMessage({ text: "hi", photos: done(), hasRecipient: true, sending: true })).toBe(false);
  });
});

describe("patchPendingPhoto", () => {
  it("changes only the photo asked for", () => {
    const a = photo("uploading");
    const b = photo("uploading");
    const next = patchPendingPhoto([a, b], b.localId, { status: "done", photoId: "B" });
    expect(next[0]).toBe(a);
    expect(next[1]).toMatchObject({ localId: b.localId, status: "done", photoId: "B" });
  });

  it("keeps every result when uploads finish in a different order than they started", () => {
    const a = photo("uploading");
    const b = photo("uploading");
    const c = photo("uploading");
    // Each finished upload is applied to the list as it is by then, the way a
    // state setter given `prev => ...` does, not to the list it saw at the start.
    let list = [a, b, c];
    list = patchPendingPhoto(list, c.localId, { status: "done", photoId: "C" });
    list = patchPendingPhoto(list, a.localId, { status: "error", error: "That photo is too large" });
    list = patchPendingPhoto(list, b.localId, { previewUrl: "data:image/jpeg;base64,AAAA" });
    list = patchPendingPhoto(list, b.localId, { status: "done", photoId: "B" });

    expect(list.map(p => p.status)).toEqual(["error", "done", "done"]);
    expect(list[0]!.error).toBe("That photo is too large");
    expect(list[1]!.previewUrl).toBe("data:image/jpeg;base64,AAAA");
    expect(readyPhotoIds(list)).toEqual(["B", "C"]);
    expect(anyUploading(list)).toBe(false);
  });

  it("leaves the list untouched (same array) when that photo was removed meanwhile", () => {
    const a = photo("uploading");
    const list = [a];
    expect(patchPendingPhoto(list, "no-such-photo", { status: "done", photoId: "x" })).toBe(list);
  });
});
