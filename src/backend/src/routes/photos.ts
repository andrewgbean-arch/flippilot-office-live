import { randomUUID } from "crypto";
import { Express, Request } from "express";
import {
  attachMessagePhotos,
  countPhotos,
  countUnattachedMessagePhotos,
  deletePhoto,
  deleteUnattachedMessagePhoto,
  getPhoto,
  insertPhoto,
  listPhotoMeta,
  photoBytes,
  purgeAbandonedUnsentPhotos,
  purgeStaleUnattachedMessagePhotos,
  readTenantCollection,
  writeTenantCollection,
} from "../db";
import { getJwtSecret, type AuthUser } from "../auth";
import {
  decodeImageDataUrl,
  hostedPhotoUrl,
  isValidPhotoSignature,
  MAX_MESSAGE_PHOTO_BYTES_PER_DEALERSHIP,
  MAX_PHOTOS_PER_DEALERSHIP,
  MAX_PHOTOS_PER_VEHICLE,
  MAX_UNATTACHED_PER_USER,
  MAX_VEHICLE_PHOTO_BYTES_PER_DEALERSHIP,
  photoIdFromUrl,
  signedMessagePhotoUrl,
  UNATTACHED_GRACE_MS,
  UNSENT_ABANDONED_AFTER_MS,
} from "../photoStore";

// Vehicle photos taken on a phone (or added anywhere else). The picture
// lives in its own table; the vehicle's `images` list only gets a short
// URL to it, so the stock list stays small no matter how many photos a
// dealer takes. The web app shows and reorders that list exactly as
// before — a URL in `images` is just another image to it.

type VehicleRecord = Record<string, unknown>;

function authedUser(req: Request): AuthUser {
  return (req as Request & { user: AuthUser }).user;
}

// The address photos are served from, baked into each stored URL. Set
// PUBLIC_API_URL to pin it; otherwise it's taken from the request, honouring
// the proxy's forwarded protocol so a Render https URL isn't saved as http.
export function publicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const forwarded = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwarded === "https" || forwarded === "http" ? forwarded : req.protocol;
  const host = req.get("host");
  return `${proto}://${host && /^[A-Za-z0-9.\-:[\]]+$/.test(host) ? host : "localhost"}`;
}

// Called by PUT /inventory on the vehicles a screen sent. The web app saves
// its whole in-memory stock list, and that list can be out of date in either
// direction:
//  - loaded BEFORE a photo arrived from a phone: saving it would quietly
//    drop the photo's URL from the vehicle, so any hosted photo the server
//    still holds for a vehicle is put back;
//  - loaded BEFORE a photo was deleted elsewhere: saving it would write a
//    dead link back in, so links to hosted photos that no longer exist are
//    dropped.
// The only way to actually remove a photo is DELETE below. Everything else
// in the list (legacy inline pictures, the client's ordering, other
// fields) is left exactly as sent.
export function keepHostedPhotos(dealershipId: string, items: unknown[], origin: string): unknown[] {
  const dealershipHasPhotos = countPhotos(dealershipId, "vehicle") > 0;

  return items.map(item => {
    if (!item || typeof item !== "object") return item;
    const vehicle = item as VehicleRecord;
    if (typeof vehicle.id !== "string") return item;

    const current = Array.isArray(vehicle.images) ? vehicle.images : [];
    const mentionsHosted = current.some(url => photoIdFromUrl(url) !== null);
    if (!dealershipHasPhotos && !mentionsHosted) return item;

    const hosted = listPhotoMeta(dealershipId, "vehicle", vehicle.id);
    const known = new Set(hosted.map(photo => photo.id));

    const kept = current.filter(url => {
      const id = photoIdFromUrl(url);
      return id === null || known.has(id);
    });
    const present = new Set(kept.map(photoIdFromUrl));
    const missing = hosted.filter(photo => !present.has(photo.id));
    if (kept.length === current.length && missing.length === 0) return item;

    const images = [...kept, ...missing.map(photo => hostedPhotoUrl(origin, photo.id, photo.mime))];
    return { ...vehicle, images: images.length > 0 ? images : null };
  });
}

// There is deliberately NO clean-up here that deletes pictures because their
// vehicle isn't in a saved list. A list from a stale screen is missing every
// car added since it loaded, so "not in the list" says nothing about whether
// a car is gone. Hosted pictures are removed in exactly two ways: the photo
// DELETE route below, and PUT /inventory's explicit `deletedIds` (which
// removes a deleted vehicle's pictures with it).

export interface MessagePhoto {
  id: string;
  url: string;
}

// A message (1:1 or team board) as sent to a client: its stored photoIds
// turned into signed, expiring links. Only ever called on messages the
// requester is allowed to read, so a link is proof of entitlement at the
// moment it was issued.
export function withPhotoUrls<T extends { photoIds?: string[] }>(
  entry: T,
  origin: string
): T & { photos: MessagePhoto[] } {
  const ids = entry.photoIds ?? [];
  if (ids.length === 0) return { ...entry, photos: [] };
  const secret = getJwtSecret();
  return { ...entry, photos: ids.map(id => ({ id, url: signedMessagePhotoUrl(origin, id, secret) })) };
}

// Attach photos that were uploaded earlier to a message that has just been
// validated. Refuses (and changes nothing) unless every one is an unsent
// photo THIS user uploaded.
export function attachPhotosToMessage(
  dealershipId: string,
  userId: string,
  photoIds: string[],
  messageId: string,
  anonymous: boolean
): { ok: true } | { ok: false; status: number; error: string } {
  const oldestAttachable = new Date(Date.now() - UNATTACHED_GRACE_MS).toISOString();
  if (attachMessagePhotos(dealershipId, userId, photoIds, messageId, anonymous, oldestAttachable)) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 400,
    error: "One of those photos couldn't be attached — add it again and retry",
  };
}

export default function registerPhotosRoute(app: Express) {
  // Step one of sharing a photo in a message: upload it, get an id back,
  // then send the message with that id in `photoIds`. No link comes back
  // here — links are only issued inside a message payload.
  app.post("/message-photos", (req, res) => {
    const user = authedUser(req);

    const decoded = decodeImageDataUrl(req.body?.dataUrl);
    if (!decoded.ok) {
      return res.status(decoded.status).json({ ok: false, error: decoded.error });
    }

    // Forget photos that were uploaded but never sent.
    purgeStaleUnattachedMessagePhotos(
      user.dealershipId,
      new Date(Date.now() - UNATTACHED_GRACE_MS).toISOString()
    );

    // At their limit? Drafts they walked away from a couple of hours ago
    // are cleared to make room before anything is refused.
    if (countUnattachedMessagePhotos(user.dealershipId, user.id) >= MAX_UNATTACHED_PER_USER) {
      purgeAbandonedUnsentPhotos(
        user.dealershipId,
        user.id,
        new Date(Date.now() - UNSENT_ABANDONED_AFTER_MS).toISOString()
      );
    }
    if (countUnattachedMessagePhotos(user.dealershipId, user.id) >= MAX_UNATTACHED_PER_USER) {
      return res.status(409).json({
        ok: false,
        error:
          "You have a lot of photos waiting to be sent from the last couple of hours. Send them in a message, or wait a little and try again.",
      });
    }
    if (photoBytes(user.dealershipId, "message") + decoded.bytes.length > MAX_MESSAGE_PHOTO_BYTES_PER_DEALERSHIP) {
      return res.status(409).json({
        ok: false,
        error: "Your dealership has used all its message-photo storage — contact support",
      });
    }

    const id = randomUUID();
    insertPhoto({
      id,
      dealershipId: user.dealershipId,
      kind: "message",
      refId: null,
      uploadedBy: user.id,
      mime: decoded.mime,
      size: decoded.bytes.length,
      data: decoded.bytes,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true, photo: { id } });
  });

  // Changed their mind before sending.
  app.delete("/message-photos/:id", (req, res) => {
    const user = authedUser(req);
    if (!deleteUnattachedMessagePhoto(user.dealershipId, user.id, String(req.params.id).toLowerCase())) {
      return res.status(404).json({ ok: false, error: "That photo wasn't found" });
    }
    res.json({ ok: true });
  });

  // Any signed-in staff member may add a photo — same as editing stock.
  // (Behind the /inventory login + approval + subscription gate in app.ts.)
  app.post("/inventory/:vehicleId/photos", (req, res) => {
    const user = authedUser(req);
    const vehicleId = req.params.vehicleId;

    const vehicles = readTenantCollection<VehicleRecord>(user.dealershipId, "vehicles");
    const index = vehicles.findIndex(v => v.id === vehicleId);
    // Only ever a vehicle in THIS dealership; another dealer's id looks
    // exactly like one that doesn't exist.
    if (index === -1) {
      return res.status(404).json({ ok: false, error: "That vehicle wasn't found" });
    }

    const decoded = decodeImageDataUrl(req.body?.dataUrl);
    if (!decoded.ok) {
      return res.status(decoded.status).json({ ok: false, error: decoded.error });
    }

    if (listPhotoMeta(user.dealershipId, "vehicle", String(vehicleId)).length >= MAX_PHOTOS_PER_VEHICLE) {
      return res.status(409).json({
        ok: false,
        error: `This vehicle already has the maximum of ${MAX_PHOTOS_PER_VEHICLE} photos`,
      });
    }
    if (
      countPhotos(user.dealershipId, "vehicle") >= MAX_PHOTOS_PER_DEALERSHIP ||
      photoBytes(user.dealershipId, "vehicle") + decoded.bytes.length > MAX_VEHICLE_PHOTO_BYTES_PER_DEALERSHIP
    ) {
      return res.status(409).json({
        ok: false,
        error: "Your dealership's photo storage limit has been reached — contact support",
      });
    }

    const id = randomUUID();
    insertPhoto({
      id,
      dealershipId: user.dealershipId,
      kind: "vehicle",
      refId: String(vehicleId),
      uploadedBy: user.id,
      mime: decoded.mime,
      size: decoded.bytes.length,
      data: decoded.bytes,
      createdAt: new Date().toISOString(),
    });

    const url = hostedPhotoUrl(publicOrigin(req), id, decoded.mime);
    try {
      // Read-modify-write with nothing awaited in between, so no other
      // request can slip a change in and get overwritten.
      const vehicle = vehicles[index] as VehicleRecord;
      const current = Array.isArray(vehicle.images) ? vehicle.images : [];
      const images = [...current, url];
      writeTenantCollection(
        user.dealershipId,
        "vehicles",
        vehicles.map((v, i) => (i === index ? { ...vehicle, images } : v))
      );
      res.json({ ok: true, photo: { id, url }, images });
    } catch (err) {
      // Don't leave a picture behind that no vehicle points to.
      deletePhoto(user.dealershipId, id);
      throw err;
    }
  });

  app.delete("/inventory/:vehicleId/photos/:photoId", (req, res) => {
    const user = authedUser(req);
    const { vehicleId, photoId } = req.params;

    const owned = listPhotoMeta(user.dealershipId, "vehicle", String(vehicleId)).find(p => p.id === photoId);
    if (!owned) {
      return res.status(404).json({ ok: false, error: "That photo wasn't found" });
    }
    deletePhoto(user.dealershipId, owned.id);

    // Take its URL off the vehicle too (if the vehicle still exists).
    const vehicles = readTenantCollection<VehicleRecord>(user.dealershipId, "vehicles");
    const index = vehicles.findIndex(v => v.id === vehicleId);
    let images: unknown[] | null = null;
    if (index !== -1) {
      const vehicle = vehicles[index] as VehicleRecord;
      const current = Array.isArray(vehicle.images) ? vehicle.images : [];
      const remaining = current.filter(url => photoIdFromUrl(url) !== owned.id);
      images = remaining.length > 0 ? remaining : null;
      writeTenantCollection(
        user.dealershipId,
        "vehicles",
        vehicles.map((v, i) => (i === index ? { ...vehicle, images } : v))
      );
    }
    res.json({ ok: true, images });
  });

  // Listing photos are PUBLIC, on purpose: a portal or a browser showing
  // the shop window can't send a login. Each address is a random 128-bit
  // id, so it can't be guessed, and the content behind it never changes —
  // hence the year-long cache.
  // Message photos are PRIVATE: they're only served with a valid,
  // unexpired signature (issued inside a message the requester can read),
  // and every other case looks exactly like a photo that doesn't exist.
  app.get("/photos/:file", (req, res) => {
    const id = photoIdFromUrl(`/photos/${req.params.file}`);
    if (!id) return res.status(404).end();

    const photo = getPhoto(id);
    if (!photo) return res.status(404).end();

    if (photo.kind === "message") {
      if (!isValidPhotoSignature(getJwtSecret(), id, req.query.exp, req.query.sig)) {
        return res.status(404).end();
      }
      res.setHeader("Cache-Control", "private, max-age=3600");
    } else if (photo.kind === "vehicle") {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      return res.status(404).end();
    }

    res.setHeader("Content-Type", photo.mime);
    res.setHeader("Content-Disposition", "inline");
    // helmet's default is same-origin, which would stop the web app (a
    // different address from this API) from showing them.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.status(200).send(Buffer.from(photo.data));
  });
}
