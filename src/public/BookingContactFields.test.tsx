import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookingContactFields, { PHONE_MAX_CHARS, NOTES_MAX_CHARS } from "./BookingContactFields";

// The open booking form used to let a customer type a phone number or a note of
// any length: a long number was turned away by the server afterwards, and a long
// note was cut to 500 characters with nobody told. The boxes now stop at the
// limits the booking route enforces, and the note box says how much room is left.

const noop = () => undefined;
const render = (notes = "", phone = "") =>
  renderToStaticMarkup(
    <BookingContactFields phone={phone} email="" notes={notes} onPhoneChange={noop} onEmailChange={noop} onNotesChange={noop} />
  );

// React writes the attribute as maxLength or maxlength depending on the renderer.
const attribute = (html: string, tag: "input" | "textarea", name: string) =>
  new RegExp(`<${tag}[^>]*\\s${name}="(\\d+)"`, "i").exec(html)?.[1];

describe("the phone and note boxes of the booking form", () => {
  it("match the limits the server enforces: 40 characters for a phone number, 500 for a note", () => {
    expect(PHONE_MAX_CHARS).toBe(40);
    expect(NOTES_MAX_CHARS).toBe(500);
  });

  it("stop the customer typing more than that", () => {
    const html = render();
    expect(attribute(html, "input", "maxlength")).toBe("40");
    expect(attribute(html, "textarea", "maxlength")).toBe("500");
  });

  it("show how many characters are left in the note", () => {
    expect(render("")).toContain("500 characters left");
    expect(render("hello")).toContain("495 characters left");
    expect(render("x".repeat(499))).toContain("1 character left");
    expect(render("x".repeat(500))).toContain("0 characters left");
  });

  it("still ask for a phone number or an email, and keep the email box unrestricted by the phone limit", () => {
    const html = render();
    expect(html).toContain("At least one of phone or email is needed");
    expect(html).toContain('type="email"');
    // only the phone box and the note box carry a limit
    expect((html.match(/maxlength=/gi) ?? []).length).toBe(2);
  });
});
