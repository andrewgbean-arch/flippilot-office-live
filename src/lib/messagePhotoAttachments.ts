// The plain (no React, no network) side of attaching photos to a message:
// what a photo that's still being added looks like, and the questions a
// screen asks about the whole list before it lets someone press Send.

export const MAX_MESSAGE_PHOTOS = 6;

export type PendingPhotoStatus = "uploading" | "done" | "error";

// One photo on its way into a message. `previewUrl` is the shrunk picture as a
// data URL (a real address the moment it's ready, empty for the instant while
// it's still being shrunk); `photoId` is the server's id once it has been
// uploaded, which is what the message is sent with.
export interface PendingMessagePhoto {
  localId: string;
  previewUrl: string;
  status: PendingPhotoStatus;
  photoId?: string;
  error?: string;
}

let lastLocalId = 0;

export function newPendingPhoto(): PendingMessagePhoto {
  lastLocalId += 1;
  return { localId: `pending-photo-${lastLocalId}`, previewUrl: "", status: "uploading" };
}

// Ids of the photos that have finished uploading, in the order they were added.
export function readyPhotoIds(photos: PendingMessagePhoto[]): string[] {
  const ids: string[] = [];
  for (const photo of photos) {
    if (photo.status === "done" && photo.photoId) ids.push(photo.photoId);
  }
  return ids;
}

export function anyUploading(photos: PendingMessagePhoto[]): boolean {
  return photos.some(photo => photo.status === "uploading");
}

// Sending needs words or a finished photo, a recipient where the message has
// one, nothing still uploading (the message would go without it), and no send
// already under way.
export function canSendMessage(input: {
  text: string;
  photos: PendingMessagePhoto[];
  hasRecipient?: boolean;
  sending: boolean;
}): boolean {
  if (input.sending) return false;
  if (input.hasRecipient === false) return false;
  if (anyUploading(input.photos)) return false;
  return input.text.trim().length > 0 || readyPhotoIds(input.photos).length > 0;
}

// Change one photo in the list. Written to be handed to a state setter as
// `prev => patchPendingPhoto(prev, id, patch)`, so several uploads finishing in
// any order each land on the list as it is by then, not as it was when they
// started. Returns the very same list when that photo is no longer in it (it
// was removed meanwhile), so nothing re-renders for it.
export function patchPendingPhoto(
  photos: PendingMessagePhoto[],
  localId: string,
  patch: Partial<PendingMessagePhoto>
): PendingMessagePhoto[] {
  let found = false;
  const next = photos.map(photo => {
    if (photo.localId !== localId) return photo;
    found = true;
    return { ...photo, ...patch };
  });
  return found ? next : photos;
}
