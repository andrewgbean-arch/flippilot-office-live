// Sending an invite link from the owner's own phone or computer.
//
// Nothing here talks to FlipPilot's server or to any text-message service. The
// owner's phone (or browser) does the sending:
//
//  - Where the browser has the Web Share API (most phones) the "Send invite"
//    button opens the phone's own share sheet, and the owner picks Messages,
//    WhatsApp, Mail or anything else installed.
//  - Where it does not, plain links open the phone's own text-message app,
//    WhatsApp, or the mail program, with the message already written.
//
// Every value that goes into a link is percent-encoded with encodeURIComponent.
// The invite link itself holds a "?" and an "=" (join?token=...), and the
// person's name and the dealership's name are typed by hand, so none of them
// may be allowed to end the message early or start a new part of the address.

import { mailtoHref } from "@/lib/mailto";
import {
  inviteShareLead,
  inviteShareMessage,
  inviteShareTitle,
  type InviteShareDetails,
} from "./teamCopy";

// ---- The links -------------------------------------------------------------

// "sms:?&body=" is the one spelling that opens a prefilled message on both
// iPhone and Android: iPhone wants "&body=", Android wants "?body=", and each
// ignores the part it does not understand.
export function smsHref(body: string): string {
  return `sms:?&body=${encodeURIComponent(body)}`;
}

// wa.me opens WhatsApp (the app on a phone, WhatsApp Web on a computer) with
// the text ready and lets the owner choose who gets it.
export function whatsAppHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// No recipient: the owner types who it is going to. Built with the app's one
// mailto: function, never by hand.
export function emailHref(subject: string, body: string): string {
  return mailtoHref("", { subject, body });
}

// ---- Everything one invite needs -------------------------------------------

// What the phone's share sheet is given. The link goes in `url` and is NOT in
// `text`: the share sheet puts the two together itself.
export interface NativeShareData {
  title: string;
  text: string;
  url: string;
}

export interface InviteShare {
  native: NativeShareData;
  // The whole message with the link at the end, for sending as plain text.
  message: string;
  smsHref: string;
  whatsAppHref: string;
  emailHref: string;
}

export function buildInviteShare(details: InviteShareDetails): InviteShare {
  const title = inviteShareTitle(details.dealershipName);
  const message = inviteShareMessage(details);
  return {
    native: { title, text: inviteShareLead(details), url: details.link },
    message,
    smsHref: smsHref(message),
    whatsAppHref: whatsAppHref(message),
    emailHref: emailHref(title, message),
  };
}

// ---- The phone's share sheet -----------------------------------------------

// The part of `navigator` used here, so it can be swapped for a stand-in.
export interface ShareCapableNavigator {
  share?: (data: NativeShareData) => Promise<void>;
  canShare?: (data: NativeShareData) => boolean;
}

export function canShareNatively(
  nav: ShareCapableNavigator | null | undefined,
  data: NativeShareData
): boolean {
  if (!nav || typeof nav.share !== "function") return false;
  if (typeof nav.canShare === "function") {
    try {
      return Boolean(nav.canShare(data));
    } catch {
      return false;
    }
  }
  return true;
}

// "cancelled" is the owner closing the share sheet without sending: that is
// their choice, not a fault, and nothing should be said about it.
export type ShareOutcome = "shared" | "cancelled" | "failed";

function isCancellation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

// Must be called straight from the button's click: a browser only opens the
// share sheet for a real tap, so nothing here waits before calling share().
export async function shareInvite(nav: ShareCapableNavigator, data: NativeShareData): Promise<ShareOutcome> {
  try {
    if (typeof nav.share !== "function") return "failed";
    await nav.share(data);
    return "shared";
  } catch (error) {
    return isCancellation(error) ? "cancelled" : "failed";
  }
}

// "native" = one Send invite button; "links" = Text message / WhatsApp / Email.
// If the share sheet was tried and really failed (not merely closed), fall back
// to the links so the owner is never left with a button that does nothing.
export type InviteShareMode = "native" | "links";

export function inviteShareMode(state: { canShareNatively: boolean; nativeShareFailed: boolean }): InviteShareMode {
  return state.canShareNatively && !state.nativeShareFailed ? "native" : "links";
}
