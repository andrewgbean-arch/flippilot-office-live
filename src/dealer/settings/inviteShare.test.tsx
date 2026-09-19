import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  buildInviteShare,
  canShareNatively,
  emailHref,
  inviteShareMode,
  shareInvite,
  smsHref,
  whatsAppHref,
  type NativeShareData,
  type ShareCapableNavigator,
} from "./inviteShare";
import InviteShareOptions from "./InviteShareOptions";

// Sending an invite link from the owner's own phone or computer: the share
// sheet where the browser has one, plain text-message / WhatsApp / email links
// where it does not. No server and no text-message service is involved.

const LINK = "https://app.example.co.uk/join?token=eyJhbGciOi.abc-def_ghi";
const DETAILS = { inviteeName: "Sarah", dealershipName: "Smith Motors", link: LINK };

describe("the text-message link", () => {
  it("uses the spelling that works on both iPhone and Android", () => {
    expect(smsHref("Hello").startsWith("sms:?&body=")).toBe(true);
    expect(smsHref("Hello")).toBe("sms:?&body=Hello");
  });

  it("percent-encodes everything, so the link's own ? = & and # cannot cut the message short", () => {
    const body = `Hi Sarah, it's 100% free & easy = ok? See ${LINK}#top`;
    const href = smsHref(body);
    const afterBody = href.slice("sms:?&body=".length);
    expect(afterBody).toBe(encodeURIComponent(body));
    expect(afterBody).not.toMatch(/[\s&=?#]/);
    // read back the way the messaging app does: one part, exactly the text
    const parts = [...new URLSearchParams(new URL(href).search).entries()];
    expect(parts).toEqual([["body", body]]);
  });
});

describe("the WhatsApp link", () => {
  it("opens wa.me with the text as its only part, encoded", () => {
    const text = `Hi & welcome = ok? ${LINK}`;
    const href = whatsAppHref(text);
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    const url = new URL(href);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("wa.me");
    expect([...url.searchParams.entries()]).toEqual([["text", text]]);
    expect(href.slice("https://wa.me/?text=".length)).toBe(encodeURIComponent(text));
  });
});

describe("the email link", () => {
  it("has no recipient, and the subject and body come out exactly as written", () => {
    const subject = "Invitation to join Smith Motors on FlipPilot";
    const body = `Hi Sarah & co, see ${LINK}`;
    const href = emailHref(subject, body);
    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(decodeURIComponent(url.pathname)).toBe("");
    expect([...new URLSearchParams(url.search).entries()]).toEqual([
      ["subject", subject],
      ["body", body],
    ]);
  });
});

describe("what one invite gives the owner to send", () => {
  const share = buildInviteShare(DETAILS);

  it("gives the share sheet a title, the message without the link, and the link on its own", () => {
    expect(share.native.title).toBe("Invitation to join Smith Motors on FlipPilot");
    expect(share.native.url).toBe(LINK);
    expect(share.native.text).toContain("Hi Sarah, you've been invited to join Smith Motors on FlipPilot.");
    // the share sheet adds the link itself: it must not be in the text as well
    expect(share.native.text).not.toContain(LINK);
  });

  it("sends the whole message, link included, by text message, WhatsApp and email", () => {
    expect(share.message).toBe(`${share.native.text} ${LINK}`);
    expect(new URLSearchParams(new URL(share.smsHref).search).get("body")).toBe(share.message);
    expect(new URL(share.whatsAppHref).searchParams.get("text")).toBe(share.message);
    const mail = new URLSearchParams(new URL(share.emailHref).search);
    expect(mail.get("body")).toBe(share.message);
    expect(mail.get("subject")).toBe(share.native.title);
  });

  it("cannot be turned into extra parts of a link by a name typed with & = ? or #", () => {
    const hostile = buildInviteShare({
      inviteeName: "Sam&body=evil#x?y=z",
      dealershipName: "A&B=Motors?",
      link: LINK,
    });
    expect([...new URLSearchParams(new URL(hostile.smsHref).search).keys()]).toEqual(["body"]);
    expect([...new URL(hostile.whatsAppHref).searchParams.keys()]).toEqual(["text"]);
    expect([...new URLSearchParams(new URL(hostile.emailHref).search).keys()]).toEqual(["subject", "body"]);
    expect(new URLSearchParams(new URL(hostile.smsHref).search).get("body")).toBe(hostile.message);
  });
});

describe("whether the browser can open a share sheet", () => {
  const data: NativeShareData = buildInviteShare(DETAILS).native;
  const shares = async () => undefined;

  it("is no when there is no navigator or it has no share function", () => {
    expect(canShareNatively(undefined, data)).toBe(false);
    expect(canShareNatively(null, data)).toBe(false);
    expect(canShareNatively({}, data)).toBe(false);
  });

  it("is yes when there is a share function and nothing says otherwise", () => {
    expect(canShareNatively({ share: shares }, data)).toBe(true);
  });

  it("asks canShare when the browser has one, and believes its answer", () => {
    expect(canShareNatively({ share: shares, canShare: () => true }, data)).toBe(true);
    expect(canShareNatively({ share: shares, canShare: () => false }, data)).toBe(false);
    expect(
      canShareNatively(
        {
          share: shares,
          canShare: () => {
            throw new TypeError("bad data");
          },
        },
        data
      )
    ).toBe(false);
  });
});

describe("Send invite", () => {
  const data = buildInviteShare(DETAILS).native;

  it("opens the share sheet with the title, text and url, and reports it shared", async () => {
    const calls: NativeShareData[] = [];
    const nav: ShareCapableNavigator = {
      share: async (given) => {
        calls.push(given);
      },
    };
    expect(await shareInvite(nav, data)).toBe("shared");
    expect(calls).toEqual([data]);
    expect(Object.keys(calls[0] ?? {}).sort()).toEqual(["text", "title", "url"]);
  });

  it("calls share on the navigator itself (a share function taken off it would throw 'illegal invocation')", async () => {
    const nav = {
      calls: 0,
      async share(this: { calls: number }, _data: NativeShareData) {
        this.calls += 1;
      },
    };
    expect(await shareInvite(nav, data)).toBe("shared");
    expect(nav.calls).toBe(1);
  });

  it("treats the owner closing the share sheet as a cancel, not an error", async () => {
    const closed: ShareCapableNavigator = {
      share: () => Promise.reject(new DOMException("Share canceled", "AbortError")),
    };
    expect(await shareInvite(closed, data)).toBe("cancelled");
    const closedPlainError: ShareCapableNavigator = {
      share: () => Promise.reject(Object.assign(new Error("Share canceled"), { name: "AbortError" })),
    };
    expect(await shareInvite(closedPlainError, data)).toBe("cancelled");
  });

  it("reports a real failure as one", async () => {
    const blocked: ShareCapableNavigator = {
      share: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
    };
    expect(await shareInvite(blocked, data)).toBe("failed");
    const broken: ShareCapableNavigator = {
      share: () => {
        throw new TypeError("Invalid share data");
      },
    };
    expect(await shareInvite(broken, data)).toBe("failed");
    expect(await shareInvite({}, data)).toBe("failed");
    const rejectsWithNothing: ShareCapableNavigator = { share: () => Promise.reject(undefined) };
    expect(await shareInvite(rejectsWithNothing, data)).toBe("failed");
  });
});

describe("which buttons the invite dialog shows", () => {
  it("shows the one Send invite button where the browser can share", () => {
    expect(inviteShareMode({ canShareNatively: true, nativeShareFailed: false })).toBe("native");
  });

  it("shows the plain buttons where the browser cannot share", () => {
    expect(inviteShareMode({ canShareNatively: false, nativeShareFailed: false })).toBe("links");
    expect(inviteShareMode({ canShareNatively: false, nativeShareFailed: true })).toBe("links");
  });

  it("falls back to the plain buttons after the share sheet really failed", () => {
    expect(inviteShareMode({ canShareNatively: true, nativeShareFailed: true })).toBe("links");
  });
});

// React writes an attribute's & and ' as entities; a browser reads them back.
const decodeAttribute = (value: string) =>
  value.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

function anchors(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>([^<]*)<\/a>/g)].map((match) => {
    const attributes = match[1] ?? "";
    return {
      label: (match[2] ?? "").trim(),
      href: decodeAttribute(/href="([^"]*)"/.exec(attributes)?.[1] ?? ""),
      target: /target="([^"]*)"/.exec(attributes)?.[1],
      rel: /rel="([^"]*)"/.exec(attributes)?.[1],
    };
  });
}

describe("the share buttons in the invite dialog", () => {
  const share = buildInviteShare(DETAILS);
  const render = (props: Partial<Parameters<typeof InviteShareOptions>[0]> = {}) =>
    renderToStaticMarkup(
      <InviteShareOptions
        share={share}
        mode="native"
        sharing={false}
        shareFailed={false}
        onNativeShare={() => undefined}
        {...props}
      />
    );

  it("where the browser can share: one Send invite button and none of the plain ones", () => {
    const html = render({ mode: "native" });
    expect(html).toContain("Send invite");
    expect(html).toContain("<button");
    expect(anchors(html)).toEqual([]);
    expect(html).not.toContain("Text message");
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("Email");
  });

  it("where it cannot: Text message, WhatsApp and Email, each opening the right link", () => {
    const html = render({ mode: "links" });
    expect(html).not.toContain("Send invite");
    expect(html).not.toContain("<button");
    const found = anchors(html);
    expect(found.map((a) => a.label)).toEqual(["Text message", "WhatsApp", "Email"]);
    expect(found.map((a) => a.href)).toEqual([share.smsHref, share.whatsAppHref, share.emailHref]);
    expect(found[0]?.href.startsWith("sms:?&body=")).toBe(true);
    expect(found[1]?.href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(found[2]?.href.startsWith("mailto:?subject=")).toBe(true);
  });

  it("opens WhatsApp in a new tab that cannot reach back into the page", () => {
    const whatsApp = anchors(render({ mode: "links" })).find((a) => a.label === "WhatsApp");
    expect(whatsApp?.target).toBe("_blank");
    expect(whatsApp?.rel).toBe("noopener noreferrer");
  });

  it("holds the Send invite button still while the share sheet is open", () => {
    expect(render({ sharing: true })).toMatch(/<button[^>]*\sdisabled=""/);
    expect(render({ sharing: false })).not.toMatch(/\sdisabled=""/);
  });

  it("says nothing about a failure unless the share sheet really failed", () => {
    expect(render({ shareFailed: false })).not.toContain("Couldn't open sharing");
    expect(render({ mode: "links", shareFailed: true })).toContain("Couldn&#x27;t open sharing");
  });
});

// The dialog has to really use the pieces above.
describe("Settings.tsx", () => {
  const source = readFileSync(new URL("./Settings.tsx", import.meta.url), "utf8");

  it("shows the share buttons in the link-ready step and builds them from the invite", () => {
    expect(source).toContain('from "./inviteShare"');
    expect(source).toContain("<InviteShareOptions");
    expect(source).toContain("buildInviteShare(");
    expect(source).toContain("inviteShareMode(");
    expect(source).toContain("canShareNatively(");
    expect(source).toContain("await shareInvite(navigator, share.native)");
  });

  it("stays quiet when the owner closes the share sheet, and only reports a real failure", () => {
    expect(source).toContain('if (outcome === "failed") setNativeShareFailed(true);');
    expect(source).not.toContain('outcome !== "shared"');
  });

  it("keeps the Copy link button, the 'anyone who has this link' warning and the cancel note", () => {
    expect(source).toContain('{copied ? "Copied!" : "Copy link"}');
    expect(source).toContain("inviteLinkWarning(");
    expect(source).toContain("{INVITE_LINK_CANCEL_NOTE}");
  });

  it("does not change how an invite is created", () => {
    expect(source).toContain("`${BASE_URL}/dealership/invite`");
    expect(source).toContain("JSON.stringify({ inviteeName: inviteeName.trim(), staffRole })");
    expect(source).toContain("setLink(`${window.location.origin}/join?token=${data.token}`);");
  });
});
