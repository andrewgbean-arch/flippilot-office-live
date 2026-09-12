export async function analyzePhotoBoundingBoxes(uri: string) {
  return {
    boxes: [
      {
        label: "Scratch",
        confidence: 0.82,
        x: 40,
        y: 60,
        width: 120,
        height: 40,
      },
      {
        label: "Dent",
        confidence: 0.74,
        x: 180,
        y: 110,
        width: 90,
        height: 60,
      },
    ],
    summary: "Detected potential damage regions.",
  };
}
