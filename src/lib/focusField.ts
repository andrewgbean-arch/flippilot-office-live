// After a Save that was refused, take the person to the field that needs fixing.
//
// A form here is a modal that scrolls (max-h-[90vh]), and its Save button is at the
// bottom, so on a phone the message under a price box can be several screens above
// the button that was just pressed, and pressing Save looks as if nothing happened.
// Scrolling the first invalid field into view and focusing it puts the fix in front
// of them. Best effort and DOM-only: with no document (a test, a server) it does
// nothing, and a field that is not on the page is skipped.
export function focusField(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    el.focus?.({ preventScroll: true });
  } catch {
    // a browser that rejects the options: the message is still on screen
  }
}
