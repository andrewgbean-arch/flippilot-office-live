import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { compressImageFile } from "@/lib/imageCompress";
import { discardMessagePhoto, uploadMessagePhoto } from "@/lib/messagePhotosApi";
import {
  MAX_MESSAGE_PHOTOS,
  newPendingPhoto,
  patchPendingPhoto,
  type PendingMessagePhoto,
} from "@/lib/messagePhotoAttachments";
import "@/components/MessagePhotos.css";

// The "Add photos" picker under a message box. Each photo is shrunk and
// uploaded the moment it's chosen, so by the time someone presses Send every
// photo already has an id to send with the message.
//
// The screen owns the list (so it can clear it after a send) and passes its
// state setter as `onChange`. Everything here changes the list with a
// `prev => next` function, which means several uploads finishing in any order
// each land on the list as it is by then. The screen asks the list two things
// with readyPhotoIds() and anyUploading() from "@/lib/messagePhotoAttachments".
//
// The preview of each photo is the shrunk picture itself (a data URL), so
// there are no object URLs here to release.
export default function MessagePhotoAttachments({
  value,
  onChange,
  disabled = false,
  max = MAX_MESSAGE_PHOTOS,
}: {
  value: PendingMessagePhoto[];
  onChange: Dispatch<SetStateAction<PendingMessagePhoto[]>>;
  // True while the message is being sent: photos can't be added or removed then.
  disabled?: boolean;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  // Photos still being shrunk or uploaded that nobody has removed. An upload
  // that lands after it was removed (or after the screen was left) finds its
  // id missing here and is thrown away instead of being added to the list.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [tooMany, setTooMany] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const atLimit = value.length >= max;
  const failedCount = value.filter(photo => photo.status === "error").length;

  function isWanted(localId: string): boolean {
    return mountedRef.current && inFlightRef.current.has(localId);
  }

  // Record how a photo's upload ended. False when nobody is waiting for it any
  // more, so the caller can clean up.
  function finish(localId: string, patch: Partial<PendingMessagePhoto>): boolean {
    const wanted = inFlightRef.current.delete(localId) && mountedRef.current;
    if (wanted) onChange(prev => patchPendingPhoto(prev, localId, patch));
    return wanted;
  }

  async function upload(localId: string, dataUrl: string) {
    const result = await uploadMessagePhoto(dataUrl); // never throws
    if (result.ok && result.id) {
      // Removed while it was uploading: it can never be sent now, so let the
      // server have it back straight away (best-effort).
      if (!finish(localId, { status: "done", photoId: result.id })) void discardMessagePhoto(result.id);
    } else {
      finish(localId, { status: "error", error: result.error ?? "Couldn't upload that photo" });
    }
  }

  // One photo is shrunk at a time (a big phone photo takes a lot of memory to
  // decode), but each upload starts as soon as its own photo is ready and
  // they finish in whatever order the network decides.
  async function prepare(batch: { localId: string; file: File }[]) {
    for (const { localId, file } of batch) {
      if (!isWanted(localId)) continue;
      let dataUrl: string;
      try {
        dataUrl = await compressImageFile(file);
      } catch (err) {
        console.error("Could not process that image", err);
        finish(localId, {
          status: "error",
          error: "That file couldn't be read as a photo — try a JPEG or PNG",
        });
        continue;
      }
      if (!isWanted(localId)) continue;
      onChange(prev => patchPendingPhoto(prev, localId, { previewUrl: dataUrl }));
      void upload(localId, dataUrl);
    }
  }

  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // lets picking the exact same file again re-fire onChange
    if (disabled || files.length === 0) return;

    const accepted = files.slice(0, Math.max(0, max - value.length));
    setTooMany(accepted.length < files.length);
    if (accepted.length === 0) return;

    // The places are taken straight away (before anything is shrunk), so
    // choosing more photos while these are still working can't go past the limit.
    const entries = accepted.map(file => ({ file, placeholder: newPendingPhoto() }));
    for (const { placeholder } of entries) inFlightRef.current.add(placeholder.localId);
    onChange(prev => [...prev, ...entries.map(entry => entry.placeholder)]);
    void prepare(entries.map(({ file, placeholder }) => ({ file, localId: placeholder.localId })));
  }

  function handleRemove(localId: string) {
    if (disabled) return;
    const photo = value.find(p => p.localId === localId);
    if (!photo) return; // already gone (a double-click)
    setTooMany(false);
    // Still uploading? Forget it; the upload is thrown away when it lands.
    inFlightRef.current.delete(localId);
    // Already uploaded but never sent: give it back (best-effort, the server
    // sweeps forgotten ones after a day anyway).
    if (photo.status === "done" && photo.photoId) void discardMessagePhoto(photo.photoId);
    onChange(prev => prev.filter(p => p.localId !== localId));
  }

  return (
    <div className="mp-attach">
      <div className="mp-attach__bar">
        <button
          type="button"
          className="sn-btn sn-btn--ghost"
          disabled={disabled || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          Add photos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Choose photos to attach"
          onChange={handlePick}
        />
        <span className="mp-attach__count">
          {value.length > 0 ? `${value.length} of ${max} photos` : `Up to ${max} photos`}
        </span>
      </div>

      {tooMany && (
        <p className="mp-attach__note">Only {max} photos fit on one message, so the extra ones weren't added.</p>
      )}

      {value.length > 0 && (
        <div className="mp-tiles">
          {value.map((photo, index) => (
            <PhotoTile
              key={photo.localId}
              photo={photo}
              index={index}
              disabled={disabled}
              onRemove={() => handleRemove(photo.localId)}
            />
          ))}
        </div>
      )}

      {failedCount > 0 && (
        <p className="mp-attach__warn">
          {failedCount === 1
            ? "1 photo couldn't be added, so it won't be sent. Remove it and add it again to retry."
            : `${failedCount} photos couldn't be added, so they won't be sent. Remove them and add them again to retry.`}
        </p>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  index,
  disabled,
  onRemove,
}: {
  photo: PendingMessagePhoto;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  const number = index + 1;

  if (photo.status === "error") {
    return (
      <div className="mp-fail">
        {photo.previewUrl ? <img className="mp-fail__thumb" src={photo.previewUrl} alt="" /> : null}
        <div>
          <p className="mp-fail__text" role="alert">
            {photo.error ?? "Couldn't upload that photo"}
          </p>
          <button
            type="button"
            className="sn-btn sn-btn--ghost mp-fail__remove"
            disabled={disabled}
            aria-label={`Remove photo ${number}`}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  const uploading = photo.status === "uploading";
  return (
    <div className={uploading ? "mp-tile mp-tile--uploading" : "mp-tile"}>
      {photo.previewUrl ? <img src={photo.previewUrl} alt={`Photo ${number} to send`} /> : null}
      {uploading && (
        <div className="mp-tile__busy" role="status" aria-label={`Uploading photo ${number}`}>
          <span className="mp-spinner" />
        </div>
      )}
      <button
        type="button"
        className="mp-tile__remove"
        disabled={disabled}
        aria-label={`Remove photo ${number}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
