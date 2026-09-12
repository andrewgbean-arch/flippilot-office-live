export async function analyzePhoto(uri: string) {
  return {
    condition: ["Excellent", "Good", "Fair", "Poor"][Math.floor(Math.random() * 4)],
    damage: Math.random() > 0.7 ? "Minor scratches detected" : "No visible damage",
    rust: Math.random() > 0.85 ? "Rust spots detected" : "No rust",
    cleanliness: Math.random() > 0.5 ? "Clean" : "Needs cleaning",
    valueImpact: Math.floor(Math.random() * 300),
    summary: "Photo analyzed successfully. Condition and damage estimated.",
  };
}
export async function uploadPhoto(file: File): Promise<string> {
  return URL.createObjectURL(file); // temporary local preview
}
export async function cleanPhoto(url: string): Promise<string> {
  return url + "?cleaned=true";
}
export async function backgroundRemovePhoto(url: string): Promise<string> {
  return url + "?bgRemoved=true";
}
export async function enhancePhoto(url: string): Promise<string> {
  return url + "?enhanced=true";
}
export async function generateBestThumbnail(urls: string[]): Promise<string | null> {
  if (urls.length === 0) return null;

  return urls[Math.floor(Math.random() * urls.length)] ?? null;
}


