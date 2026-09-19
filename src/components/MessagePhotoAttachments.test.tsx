import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MessagePhotoAttachments from "./MessagePhotoAttachments";
import type { PendingMessagePhoto } from "@/lib/messagePhotoAttachments";

// There's no browser here, so these render the picker to HTML and look at what
// a person would be shown for each state of a photo. (The upload flow itself
// needs a real browser: file input, canvas, network.)

const noop = () => {};
const PREVIEW = "data:image/jpeg;base64,AAAA";

function item(n: number, status: PendingMessagePhoto["status"], extra: Partial<PendingMessagePhoto> = {}) {
  return { localId: `p${n}`, previewUrl: PREVIEW, status, ...extra } as PendingMessagePhoto;
}

function addButton(html: string) {
  return /<button[^>]*>Add photos<\/button>/.exec(html)?.[0] ?? "";
}

describe("MessagePhotoAttachments", () => {
  it("offers an Add photos button and a hidden file input for several images at once", () => {
    const html = renderToStaticMarkup(<MessagePhotoAttachments value={[]} onChange={noop} />);
    expect(addButton(html)).not.toBe("");
    expect(addButton(html)).not.toContain("disabled");
    expect(html).toMatch(/<input[^>]*type="file"/);
    expect(html).toMatch(/<input[^>]*accept="image\/\*"/);
    expect(html).toMatch(/<input[^>]*multiple/);
    expect(html).toMatch(/<input[^>]*hidden/);
    expect(html).toContain("Up to 6 photos");
    expect(html).not.toContain("mp-tiles");
  });

  it("shows a photo that is uploading with a spinner, and one that is done without", () => {
    const html = renderToStaticMarkup(
      <MessagePhotoAttachments value={[item(1, "uploading"), item(2, "done", { photoId: "id-2" })]} onChange={noop} />
    );
    expect(html.match(/mp-spinner/g)).toHaveLength(1);
    expect(html.match(new RegExp(PREVIEW, "g"))).toHaveLength(2);
    expect(html).toContain("Remove photo 1");
    expect(html).toContain("Remove photo 2");
    expect(html).toContain("2 of 6 photos");
  });

  it("shows why a photo failed, right on it, with a Remove button", () => {
    const html = renderToStaticMarkup(
      <MessagePhotoAttachments
        value={[item(1, "error", { error: "That photo is too large (the limit is 1.5 MB)" })]}
        onChange={noop}
      />
    );
    expect(html).toContain("That photo is too large (the limit is 1.5 MB)");
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    // (the apostrophe comes out HTML-escaped in the markup)
    expect(html).toMatch(/won(?:'|&#x27;)t be sent/);
    expect(html).not.toContain("mp-spinner");
  });

  it("copes with a photo whose preview isn't ready yet", () => {
    const html = renderToStaticMarkup(
      <MessagePhotoAttachments value={[item(1, "uploading", { previewUrl: "" })]} onChange={noop} />
    );
    expect(html).toContain("mp-spinner");
    expect(html).not.toContain("<img");
  });

  it("stops offering more at the limit of six", () => {
    const six = [1, 2, 3, 4, 5, 6].map(n => item(n, "done", { photoId: `id-${n}` }));
    const html = renderToStaticMarkup(<MessagePhotoAttachments value={six} onChange={noop} />);
    expect(addButton(html)).toContain("disabled");
    expect(html).toContain("6 of 6 photos");
  });

  it("locks adding and removing while the message is being sent", () => {
    const html = renderToStaticMarkup(
      <MessagePhotoAttachments value={[item(1, "done", { photoId: "id-1" })]} onChange={noop} disabled />
    );
    expect(addButton(html)).toContain("disabled");
    expect(/<button[^>]*aria-label="Remove photo 1"[^>]*>/.exec(html)?.[0]).toContain("disabled");
  });
});
