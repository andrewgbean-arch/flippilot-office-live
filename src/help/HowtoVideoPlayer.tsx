import { useState } from "react";
import { FiPlayCircle } from "react-icons/fi";
import { lengthLabel, videoCaptions, videoFile, videoPoster, type HowtoVideo } from "./howtoVideos";

// One how-to video: its still and title until someone presses play, then the
// video itself, with the words on screen (they can be turned off). Nothing is
// downloaded until then, so a screen with videos on it costs nothing to open.
export default function HowtoVideoPlayer({ video, compact = false }: { video: HowtoVideo; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <figure className="overflow-hidden rounded-xl border border-yellow-400/40 bg-black">
        <video
          className="block w-full"
          src={videoFile(video)}
          poster={videoPoster(video)}
          controls
          autoPlay
          playsInline
          preload="none"
        >
          {/* The words are already in the picture (Wendy's box); this track is there for players that read captions, off by default so they don't show twice. */}
          <track kind="captions" src={videoCaptions(video)} srcLang="en" label="English" />
          Your browser can't play this video.
        </video>
        <figcaption className="px-3 py-2 text-sm font-semibold text-white/85">{video.title}</figcaption>
      </figure>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play the video: ${video.title} (${lengthLabel(video.seconds)})`}
      className="group block w-full overflow-hidden rounded-xl border border-white/15 bg-black text-left transition hover:border-yellow-400/70"
    >
      <span className="relative block aspect-video w-full">
        <img src={videoPoster(video)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
        {/* In the corner, not the middle: the still is the video's title card. */}
        <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/75 py-1 pl-1 pr-3 text-sm font-bold text-yellow-300">
          <FiPlayCircle aria-hidden className="text-2xl" />
          Play
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-xs font-semibold text-white">
          {lengthLabel(video.seconds)}
        </span>
      </span>
      <span className="block px-3 py-2">
        <span className="block font-bold text-yellow-300">{video.title}</span>
        {!compact && <span className="block text-sm text-white/70">{video.about}</span>}
      </span>
    </button>
  );
}
