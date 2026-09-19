import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MessagePhotoStrip from "./MessagePhotoStrip";

const PHOTOS = [
  { id: "a", url: "https://api.example.com/photos/a.jpg?exp=1&sig=abc" },
  { id: "b", url: "https://api.example.com/photos/b.jpg?exp=1&sig=def" },
];

describe("MessagePhotoStrip", () => {
  it("renders nothing at all when a message has no photos", () => {
    expect(renderToStaticMarkup(<MessagePhotoStrip />)).toBe("");
    expect(renderToStaticMarkup(<MessagePhotoStrip photos={undefined} />)).toBe("");
    expect(renderToStaticMarkup(<MessagePhotoStrip photos={[]} />)).toBe("");
  });

  it("wraps every photo in a link that opens it full size in a new tab, safely", () => {
    const html = renderToStaticMarkup(<MessagePhotoStrip photos={PHOTOS} />);
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html).toContain('href="https://api.example.com/photos/a.jpg?exp=1&amp;sig=abc"');
    expect(html).toContain('src="https://api.example.com/photos/b.jpg?exp=1&amp;sig=def"');
  });

  it("only ever shows web addresses", () => {
    const html = renderToStaticMarkup(
      <MessagePhotoStrip
        photos={[
          { id: "x", url: "javascript:alert(1)" },
          { id: "y", url: "" },
          { id: "z", url: "https://api.example.com/photos/z.jpg" },
        ]}
      />
    );
    expect(html).not.toContain("javascript:");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("photos/z.jpg");
  });
});
