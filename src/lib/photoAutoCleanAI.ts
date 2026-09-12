export async function autoCleanPhoto(uri: string) {
  return {
    cleanedUri: uri, // backend will return a new cleaned image
    dirtRemoved: Math.random() > 0.4,
    paintShineBoost: Math.random() > 0.5,
    tyreDarkening: Math.random() > 0.5,
    windowClarity: Math.random() > 0.5,
    shadowSmoothing: Math.random() > 0.5,
    colorCorrection: Math.random() > 0.5,
    cleanlinessScore: Math.floor(Math.random() * 100),
    summary: "Auto-clean applied successfully.",
  };
}
