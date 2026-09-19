import { useState } from "react";
import type { MessagePhoto } from "@/lib/messagePhotosApi";
import "@/components/MessagePhotos.css";

// The photos that came with a message, as a row of small thumbnails. Each is a
// plain link that opens the picture full size in a new tab. Renders nothing at
// all for a message with no photos.
//
// The links are signed and stop working after 24 hours (a fresh set comes with
// every fetch), so they're only ever used as they arrive, never stored.
export default function MessagePhotoStrip({ photos }: { photos?: MessagePhoto[] | undefined }) {
  // Only web addresses the server actually gave us.
  const shown = (photos ?? []).filter(
    photo => photo && typeof photo.url === "string" && /^https?:\/\//i.test(photo.url)
  );
  if (shown.length === 0) return null;

  return (
    <div className="mp-strip">
      {shown.map((photo, index) => (
        <StripPhoto key={photo.id} photo={photo} index={index} total={shown.length} />
      ))}
    </div>
  );
}

function StripPhoto({ photo, index, total }: { photo: MessagePhoto; index: number; total: number }) {
  // Remembered per address, so a fresh link for the same photo gets a fresh try.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const broken = brokenUrl === photo.url;

  return (
    <a
      className="mp-strip__link"
      href={photo.url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open full size"
    >
      {broken ? (
        <span className="mp-strip__missing">Photo unavailable</span>
      ) : (
        <img
          src={photo.url}
          alt={`Photo ${index + 1} of ${total}`}
          loading="lazy"
          onError={() => setBrokenUrl(photo.url)}
        />
      )}
    </a>
  );
}
