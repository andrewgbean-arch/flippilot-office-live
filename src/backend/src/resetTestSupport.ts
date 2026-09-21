// Shared by the password-reset test files (passwordResetSecurity, passwordResetSingleUse,
// passwordResetLimit). Not a test itself.
import { vi, expect } from "vitest";
import request from "supertest";
import type { Express } from "express";
import * as emailModule from "./email.js";

export const OWNER_PASSWORD = "reset-test-pass-1";
let counter = 0;

// A throwaway dealership owner made through the real signup route.
export async function signupOwner(app: Express, tag: string) {
  counter += 1;
  const email = `reset-${tag}-${Date.now()}-${counter}@test.local`;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email, password: OWNER_PASSWORD, name: `Reset ${tag}`, dealershipName: `Reset Motors ${tag} ${counter}` });
  expect(res.status).toBe(200);
  return { email, token: res.body.token as string, id: (res.body.user as { id: string }).id };
}

export interface SentEmail {
  to: string;
  subject: string;
  body: string;
}

// Stands in for the real email sender and remembers everything it was asked to
// send, so a test can read exactly what would have gone into the inbox.
export function captureEmails() {
  const sent: SentEmail[] = [];
  const spy = vi.spyOn(emailModule, "sendEmail").mockImplementation(async (to, subject, body) => {
    sent.push({ to, subject, body });
  });
  return { sent, spy };
}

// The reset token inside a reset email body.
export function tokenFromEmail(mail: SentEmail): string {
  const match = /[?&]token=([^\s&]+)/.exec(mail.body);
  if (!match) throw new Error(`no token in the email body: ${mail.body}`);
  return match[1] as string;
}

// Runs `fn` as a production server with no email provider configured (the state
// the live server may be in), then puts the environment back.
export async function asProduction<T>(fn: () => Promise<T>, extra: Record<string, string | undefined> = {}): Promise<T> {
  const saved: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    APP_URL: process.env.APP_URL,
  };
  process.env.NODE_ENV = "production";
  delete process.env.RESEND_API_KEY;
  delete process.env.APP_URL;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
