import type { Lead } from "./leadTypes";

const LEADS_KEY = "dealer_leads";

export async function saveLeads(leads: Lead[]) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export async function loadLeads(): Promise<Lead[]> {
  const raw = localStorage.getItem(LEADS_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}