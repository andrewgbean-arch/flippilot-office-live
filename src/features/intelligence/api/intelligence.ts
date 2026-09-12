export async function fetchIntelligenceScore(vehicle: {
  make: string;
  model: string;
  year: number;
  mileage: number | null;
  expiry: string | null;
}) {
  try {
    const response = await fetch("http://localhost:3001/intelligence/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicle),
    });

    const data = await response.json();
    if (!data.ok) return null;

    return data;
  } catch (err) {
    console.log("Intelligence scoring failed:", err);
    return null;
  }
}
