import { useState, type ReactNode } from "react";
import { SupernovaGlowCard } from "@/components/supernova/SupernovaGlowCard";
import type { PassportSettings, PassportSetup } from "@/lib/carPassportApi";
import {
  MAX_LINE,
  MAX_LINES,
  MAX_NOTE,
  passportUrl,
  remainingSuggestions,
  sameDraft,
  toDraft,
  withLine,
  withoutLine,
  type Draft,
} from "./passportDraft";
import { QR_QUIET_ZONE, qrModules, qrPath } from "./passportQr";

export interface PassportFacts {
  title: string;
  priceText: string | null;
  reg: string | null;
  sold: boolean;
  hasMotRecord: boolean;
  hasFuelType: boolean;
}

export type SaveResult = { ok: true; config: PassportSettings } | { ok: false; error: string };

function Switch({ checked, onChange, label, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; children?: ReactNode }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-yellow-400"
      />
      <span>
        <span className="block font-semibold text-white">{label}</span>
        {children && <span className="mt-0.5 block text-sm text-white/70">{children}</span>}
      </span>
    </label>
  );
}

function QrCode({ url }: { url: string }) {
  const modules = qrModules(url);
  const size = modules.length + QR_QUIET_ZONE * 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR code that opens this car's page" className="h-full w-full" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path transform={`translate(${QR_QUIET_ZONE} ${QR_QUIET_ZONE})`} d={qrPath(modules)} fill="#000000" />
    </svg>
  );
}

// Only visible when printing: the card to put in the windscreen or on the desk.
function PrintCard({ url, facts, dealerName }: { url: string; facts: PassportFacts; dealerName: string }) {
  return (
    <>
      <style>{`
        .passport-print-card { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .passport-print-card, .passport-print-card * { visibility: visible !important; }
          .passport-print-card { display: flex !important; position: fixed; inset: 0; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: #fff; color: #000; text-align: center; padding: 24px; }
        }
      `}</style>
      <div className="passport-print-card" aria-hidden="true">
        <p style={{ fontSize: 22, fontWeight: 700 }}>{dealerName}</p>
        <p style={{ fontSize: 30, fontWeight: 800 }}>{facts.title}</p>
        {facts.priceText && <p style={{ fontSize: 34, fontWeight: 800 }}>{facts.priceText}</p>}
        {facts.reg && <p style={{ fontSize: 20, fontFamily: "monospace", fontWeight: 700 }}>{facts.reg}</p>}
        <div style={{ width: 320, height: 320 }}>
          <QrCode url={url} />
        </div>
        <p style={{ fontSize: 20 }}>Scan for this car&apos;s MOT history and what&apos;s been done to it.</p>
      </div>
    </>
  );
}

export default function PassportEditor({
  vehicleId,
  dealershipId,
  origin,
  dealerName,
  facts,
  initial,
  canEdit,
  save,
}: {
  vehicleId: string;
  dealershipId: string;
  origin: string;
  dealerName: string;
  facts: PassportFacts;
  initial: PassportSetup;
  canEdit: boolean;
  save: (draft: Draft) => Promise<SaveResult>;
}) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(initial.config));
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial.config));
  const [newLine, setNewLine] = useState("");
  const [lineError, setLineError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const dirty = !sameDraft(draft, saved);
  const change = (next: Draft) => {
    setDraft(next);
    setJustSaved(false);
  };
  const url = passportUrl(origin, dealershipId, vehicleId);
  const live = saved.published;

  function addLine(raw: string) {
    const r = withLine(draft, raw);
    if (!r.ok) {
      setLineError(r.error);
      return;
    }
    setLineError(null);
    setNewLine("");
    change(r.draft);
  }

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    const result = await save(draft);
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const next = toDraft(result.config);
    setSaved(next);
    setDraft(next);
    setJustSaved(true);
  }

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const publishDisabled = !canEdit || (!initial.canPublish && !draft.published);

  return (
    <div className="space-y-6">
      {!canEdit && (
        <p className="rounded-xl border border-white/15 bg-white/5 p-4 text-white/80">
          Only sales staff, managers and the owner can publish a Car Passport. You can see its settings here.
        </p>
      )}

      <SupernovaGlowCard>
        <h2 className="mb-1 text-xl font-bold text-yellow-300">Car Passport</h2>
        <p className="mb-4 text-white/75">
          A page for this car that answers a buyer&apos;s questions before they ask: the photos, the MOT history, what you&apos;ve done to it and how the price sits against the market. Nothing is public until you switch it on.
        </p>

        <Switch checked={draft.published} onChange={v => change({ ...draft, published: v })} label="Live on the web" disabled={publishDisabled}>
          {draft.published ? "Anyone with the link can see this page." : "Not published. Nobody can see this page."}
        </Switch>
        {!initial.canPublish && initial.cannotPublishBecause && <p className="mt-2 text-sm text-amber-300">{initial.cannotPublishBecause}</p>}
        {facts.sold && (
          <p className="mt-2 text-sm text-amber-300">This car is marked as sold, so its page shows a plain &quot;sold&quot; notice and nothing else.</p>
        )}
      </SupernovaGlowCard>

      <SupernovaGlowCard>
        <h3 className="mb-3 text-lg font-bold text-yellow-300">What buyers see</h3>
        <p className="mb-4 text-sm text-white/70">
          Always shown: the photos, make, model, year, mileage, colour and your asking price. What you paid, your costs and your notes are never shown.
        </p>
        <div className="space-y-4">
          <Switch checked={draft.showReg} onChange={v => change({ ...draft, showReg: v })} label="Registration" disabled={!canEdit}>
            Lets buyers check the car&apos;s history for themselves.
          </Switch>
          <Switch checked={draft.showMot} onChange={v => change({ ...draft, showMot: v })} label="MOT history" disabled={!canEdit}>
            {facts.hasMotRecord
              ? "Shows the MOT record on file. If the car has had a newer MOT since you last looked it up, refresh it on the MOT tab first."
              : "There's no MOT record on file for this car, so this section won't appear until you run the MOT look-up."}
          </Switch>
          <Switch checked={draft.showUlez} onChange={v => change({ ...draft, showUlez: v })} label="Emissions (ULEZ)" disabled={!canEdit}>
            {facts.hasFuelType
              ? "Says whether the car meets ULEZ, from its fuel type and Euro standard."
              : "There's no fuel type on file (it comes from the DVLA look-up), so this won't appear yet."}
          </Switch>
          <Switch checked={draft.showMarket} onChange={v => change({ ...draft, showMarket: v })} label="Price against the market" disabled={!canEdit}>
            Compares your asking price with the average asking price for this make and model. It shows whatever is true, good or bad, and only when there are enough recent listings to say something honest.
          </Switch>
        </div>
      </SupernovaGlowCard>

      <SupernovaGlowCard>
        <h3 className="mb-1 text-lg font-bold text-yellow-300">What you&apos;ve done to it</h3>
        <p className="mb-3 text-sm text-white/70">Short lines, in your own words. No prices. Up to {MAX_LINES}.</p>

        {draft.workDone.length > 0 && (
          <ul className="mb-3 space-y-2">
            {draft.workDone.map((line, i) => (
              <li key={line} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white/90">
                <span>{line}</span>
                {canEdit && (
                  <button type="button" onClick={() => change(withoutLine(draft, i))} aria-label={`Remove: ${line}`} className="text-sm text-red-300 hover:text-red-200">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <>
            <div className="flex gap-2">
              <input
                value={newLine}
                maxLength={MAX_LINE}
                onChange={e => {
                  setNewLine(e.target.value);
                  setLineError(null);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLine(newLine);
                  }
                }}
                placeholder="New front brake pads and discs"
                aria-label="A line about work done to this car"
                className="flex-1 rounded bg-black/40 p-2 text-white/90 border border-white/10"
              />
              <button type="button" onClick={() => addLine(newLine)} className="rounded bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300">
                Add
              </button>
            </div>
            {lineError && <p className="mt-2 text-sm text-red-300">{lineError}</p>}

            {remainingSuggestions(initial.suggestions, draft).length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm text-white/70">From what&apos;s already recorded for this car (edit the wording after adding):</p>
                <div className="flex flex-wrap gap-2">
                  {remainingSuggestions(initial.suggestions, draft).map(s => (
                    <button key={s} type="button" onClick={() => addLine(s)} className="rounded-full border border-yellow-400/50 px-3 py-1 text-sm text-yellow-200 hover:bg-white/10">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </SupernovaGlowCard>

      <SupernovaGlowCard>
        <h3 className="mb-1 text-lg font-bold text-yellow-300">A note from you</h3>
        <p className="mb-3 text-sm text-white/70">Optional. Shown near the top of the page, with your name under it.</p>
        <textarea
          value={draft.note}
          maxLength={MAX_NOTE}
          disabled={!canEdit}
          onChange={e => change({ ...draft, note: e.target.value })}
          rows={3}
          placeholder="One careful owner, full service history in the glovebox."
          aria-label="A note for buyers"
          className="w-full rounded bg-black/40 p-2 text-white/90 border border-white/10"
        />
        <p className="mt-1 text-right text-xs text-white/60">
          {draft.note.length} / {MAX_NOTE}
        </p>
      </SupernovaGlowCard>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black hover:bg-yellow-300 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <span className="text-sm text-white/70" aria-live="polite">
            {saving ? "" : dirty ? "You have unsaved changes." : justSaved ? "Saved." : ""}
          </span>
          {saveError && <span className="text-sm text-red-300">{saveError}</span>}
        </div>
      )}

      {live && (
        <SupernovaGlowCard>
          <h3 className="mb-1 text-lg font-bold text-yellow-300">Share it</h3>
          {draft.published !== saved.published && <p className="mb-2 text-sm text-amber-300">Save to change whether this page is live.</p>}
          <p className="mb-3 text-sm text-white/70">Put the QR code on the windscreen or send the link to someone who has asked about the car.</p>
          <div className="flex gap-2">
            <input readOnly value={url} aria-label="The address of this car's page" className="flex-1 rounded bg-black/40 p-2 text-sm text-white/90 border border-white/10" />
            <button type="button" onClick={copy} className="rounded bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-300">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg bg-white">
              <QrCode url={url} />
            </div>
            <div className="flex flex-col gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-yellow-400/70 px-4 py-2 text-center font-semibold text-yellow-200 hover:bg-white/10">
                See what buyers see
              </a>
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-white/25 px-4 py-2 font-semibold text-white/90 hover:bg-white/10">
                Print a QR card
              </button>
            </div>
          </div>
          <PrintCard url={url} facts={facts} dealerName={dealerName} />
        </SupernovaGlowCard>
      )}
    </div>
  );
}
