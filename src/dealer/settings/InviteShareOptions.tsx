import type { InviteShare, InviteShareMode } from "./inviteShare";

// How the owner sends the invite link they have just made, shown in the invite
// dialog between the warning and the link box.
//
//  - "native": one Send invite button, which opens the phone's own share sheet.
//  - "links":  plain buttons that open the phone's text-message app, WhatsApp or
//              the mail program with the message already written.
//
// The Copy link button stays in the dialog's link box either way.

const PRIMARY =
  "w-full px-4 py-2.5 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-60 text-center";
const SECONDARY =
  "px-2 py-2.5 rounded font-semibold bg-white/10 text-white/80 hover:bg-white/20 text-center text-sm";

export default function InviteShareOptions({
  share,
  mode,
  sharing,
  shareFailed,
  onNativeShare,
}: {
  share: InviteShare;
  mode: InviteShareMode;
  // The share sheet is open: the button waits, so a second tap cannot start a second one.
  sharing: boolean;
  // The share sheet could not be opened (not: the owner closed it).
  shareFailed: boolean;
  onNativeShare: () => void;
}) {
  return (
    <div className="mb-3">
      {shareFailed && (
        <p role="alert" className="text-yellow-200/90 text-xs mb-2">
          Couldn't open sharing on this device. Use one of these instead, or copy the link below.
        </p>
      )}
      {mode === "native" ? (
        <button type="button" onClick={onNativeShare} disabled={sharing} className={PRIMARY}>
          Send invite
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <a href={share.smsHref} className={SECONDARY}>
            Text message
          </a>
          <a href={share.whatsAppHref} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
            WhatsApp
          </a>
          <a href={share.emailHref} className={SECONDARY}>
            Email
          </a>
        </div>
      )}
    </div>
  );
}
