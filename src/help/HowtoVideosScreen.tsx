import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import { useAuth } from "@/context/AuthContext";
import HowtoVideoPlayer from "./HowtoVideoPlayer";
import { videosFor } from "./howtoVideos";

// Every how-to video this person can use, in one place. The same videos are
// offered on the screens they're about, in "Help with this page".
export default function HowtoVideosScreen() {
  const { user } = useAuth();
  const videos = videosFor(user);

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-5xl mx-auto">
      <SupernovaHeroHeader title="How-to videos" subtitle="Short videos, about a minute each, with Wendy showing you how." />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <HowtoVideoPlayer key={v.id} video={v} />
        ))}
      </div>
      <p className="text-white/40 text-xs mt-8">
        Filmed in Dealer OS with a sample dealership, so the cars, people and figures are made up. The words are on screen too,
        for watching with the sound off.
      </p>
    </div>
  );
}
