// The phone, email and note boxes of the public booking form, kept apart from
// the page so their limits can be tested without a browser.
//
// The limits are the ones the booking route enforces (see publicBooking.ts).
// Stopping the customer at the box, and telling them how much room is left, is
// kinder than the server turning a long phone number away, or cutting a long
// note short with nobody the wiser.
export const PHONE_MAX_CHARS = 40;
export const NOTES_MAX_CHARS = 500;

interface BookingContactFieldsProps {
  phone: string;
  email: string;
  notes: string;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

const FIELD_CLASS = "w-full p-2 rounded bg-black/40 border border-white/10 text-white/80 mt-1";

export default function BookingContactFields({
  phone,
  email,
  notes,
  onPhoneChange,
  onEmailChange,
  onNotesChange,
}: BookingContactFieldsProps) {
  const notesLeft = Math.max(0, NOTES_MAX_CHARS - notes.length);
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-white/60 text-sm">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={e => onPhoneChange(e.target.value)}
            maxLength={PHONE_MAX_CHARS}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className="text-white/60 text-sm">Email</label>
          <input type="email" value={email} onChange={e => onEmailChange(e.target.value)} className={FIELD_CLASS} />
        </div>
      </div>
      <p className="text-white/40 text-xs -mt-2">At least one of phone or email is needed so we can confirm.</p>

      <div>
        <label className="text-white/60 text-sm">Anything else? (optional)</label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          maxLength={NOTES_MAX_CHARS}
          rows={2}
          className={FIELD_CLASS}
        />
        <p className="text-white/40 text-xs mt-1">
          {notesLeft} character{notesLeft === 1 ? "" : "s"} left
        </p>
      </div>
    </>
  );
}
