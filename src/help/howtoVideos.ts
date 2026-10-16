import type { AuthUser } from "@/context/AuthContext";
import { canOpenPage } from "@/lib/pageAccess";

// The short how-to videos (about a minute each, Wendy talking), filmed in the real
// app with sample data. The files are in public/howto: <id>.mp4, <id>.jpg (the
// still shown before it plays) and <id>.vtt (the words, for watching with the
// sound off). "Help with this page" offers the ones for the screen you're on;
// the How-to videos page lists them all.

export interface HowtoVideo {
  id: string;
  title: string;
  // One line on what it shows.
  about: string;
  seconds: number;
  // The screens it is about (whole address, or the start of one).
  pages: RegExp[];
  // A page it opens, so someone who can't open that page isn't offered it.
  needs?: string;
}

export const HOWTO_VIDEOS: HowtoVideo[] = [
  {
    id: "howto-help",
    title: "Getting help, and the tour",
    about: "The gold Help button on every screen, Wendy's walk-round, and the full tour.",
    seconds: 56,
    pages: [/^\/dealer-dashboard$/],
  },
  {
    id: "howto-team",
    title: "Invite your team",
    about: "Give everyone their own login, pick their role, and see who can see what.",
    seconds: 41,
    pages: [/^\/dealer\/settings$/, /^\/dealer\/staff(\/permissions)?$/],
    needs: "/dealer/staff/add",
  },
  {
    id: "howto-photos",
    title: "Photo Studio",
    about: "Brighten and straighten a photo, add a banner, hide the plate, and make a post for social media.",
    seconds: 64,
    pages: [/^\/photo-studio(\/|$)/, /^\/dealer\/workflow\/photos\//],
  },
  {
    id: "howto-passport",
    title: "Car Passport",
    about: "Give a car its own web page, with a QR card for the windscreen.",
    seconds: 54,
    pages: [/^\/dealer\/inventory\/[^/]+$/],
  },
  {
    id: "howto-bookings",
    title: "Bookings",
    about: "Your booking link, and saying yes when a customer books a viewing or test drive.",
    seconds: 59,
    pages: [/^\/appointments$/],
  },
  {
    id: "howto-wendy",
    title: "Ask Wendy",
    about: "Ask about your own stock, leads, bookings and jobs, by typing or just saying it.",
    seconds: 46,
    pages: [/^\/pilot-brain$/],
  },
  {
    id: "howto-sale",
    title: "Record a sale and the invoice",
    about: "Record what a car sold for, then print or email the invoice.",
    seconds: 52,
    pages: [/^\/bookkeeping(\/|$)/],
    needs: "/bookkeeping",
  },
  {
    id: "howto-costs",
    title: "Costs and profit on a car",
    about: "Put what you spend on a car in the books, see its real profit, and fix a mistake.",
    seconds: 49,
    pages: [/^\/bookkeeping(\/|$)/],
    needs: "/bookkeeping",
  },
  {
    id: "howto-leads",
    title: "Add a lead and keep it moving",
    about: "Add someone who's asked about a car, move them along as things happen, and see the pipeline.",
    seconds: 53,
    pages: [/^\/dealer\/sales\/(leads|add|pipeline)(\/|$)/],
  },
  {
    id: "howto-jobs",
    title: "The Jobs Board",
    about: "Add a job, give it to someone, move it along, and see it on the workshop calendar.",
    seconds: 47,
    pages: [/^\/jobs$/, /^\/workshop-calendar$/],
  },
];

export const videoFile = (v: HowtoVideo) => `/howto/${v.id}.mp4`;
export const videoPoster = (v: HowtoVideo) => `/howto/${v.id}.jpg`;
export const videoCaptions = (v: HowtoVideo) => `/howto/${v.id}.vtt`;

const canWatch = (user: AuthUser | null, v: HowtoVideo) => !v.needs || canOpenPage(user, v.needs);

/** Every video this person can use, in the order above. */
export function videosFor(user: AuthUser | null): HowtoVideo[] {
  return HOWTO_VIDEOS.filter((v) => canWatch(user, v));
}

/** The videos about the screen at `path`. */
export function videosForPage(path: string, user: AuthUser | null): HowtoVideo[] {
  return videosFor(user).filter((v) => v.pages.some((p) => p.test(path)));
}

export const lengthLabel = (seconds: number) => (seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60 ? `${seconds % 60} sec` : ""}`.trim());
