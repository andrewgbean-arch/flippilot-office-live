// Every backend fetch in this app used to hardcode "http://localhost:4001"
// directly, which only ever worked for local dev. Reads VITE_API_URL (set
// per-environment — e.g. a real Render backend URL in production) and falls
// back to localhost so local dev keeps working unconfigured.
export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001";
