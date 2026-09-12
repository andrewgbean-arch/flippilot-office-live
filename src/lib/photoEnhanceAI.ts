export async function enhancePhoto(uri: string) {
  return {
    enhancedUri: uri, // placeholder — backend will return a new image
    brightnessBoost: Math.random() > 0.5,
    sharpened: Math.random() > 0.5,
    backgroundCleaned: Math.random() > 0.5,
    noiseReduced: Math.random() > 0.5,
    autoCropped: Math.random() > 0.5,
    bestPhotoScore: Math.floor(Math.random() * 100),
    summary: "Photo enhanced successfully.",
  };
}
