import { readTenantDoc, writeTenantDoc } from "./db";

/**
 * The free taster of Pilot Brain for a dealership that has never PAID for
 * it — a trial dealership, in practice, since requirePilotBrainAccess only
 * lets anyone else in once they're a real subscriber: 5 chat questions and
 * 1 morning briefing, once, ever, so they can see what she does before
 * deciding whether to add her. Once a dealership actually subscribes to
 * Pilot Brain this is never checked again (chat becomes the ordinary,
 * much larger rate limit; see routes/pilotBrain.ts's chatLimiter).
 *
 * Deliberately NOT reset by a new trial, a new month, or anything else — a
 * lifetime allowance per dealership, since the point is a one-time look,
 * not a recurring free ration.
 */
export const TASTER_QUESTIONS = 5;

export interface TasterState {
  questionsUsed: number;
  briefingUsed: boolean;
}

const COLLECTION = "pilotBrainTaster";

export function readTasterState(dealershipId: string): TasterState {
  const raw = readTenantDoc<Partial<TasterState> | null>(dealershipId, COLLECTION, null);
  return {
    questionsUsed: typeof raw?.questionsUsed === "number" ? raw.questionsUsed : 0,
    briefingUsed: raw?.briefingUsed === true,
  };
}

export function tasterQuestionsRemaining(dealershipId: string): number {
  return Math.max(0, TASTER_QUESTIONS - readTasterState(dealershipId).questionsUsed);
}

// Counted only for a message that actually reached the real, paid model
// call and got a real reply — not one the shield turned away, and not one
// that errored, same "only count what really happened" reasoning as the
// web-search log.
export function recordTasterQuestion(dealershipId: string): void {
  const state = readTasterState(dealershipId);
  writeTenantDoc(dealershipId, COLLECTION, { ...state, questionsUsed: state.questionsUsed + 1 });
}

export function recordTasterBriefing(dealershipId: string): void {
  const state = readTasterState(dealershipId);
  writeTenantDoc(dealershipId, COLLECTION, { ...state, briefingUsed: true });
}
