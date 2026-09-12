export async function fetchIntelligenceV3(payload: {
  title: string;
  mot: any;
  images: string[];
}) {
  try {
    const response = await fetch("http://localhost:3001/intelligence/v3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.ok) return null;

    return data;
  } catch (err) {
    console.log("Intelligence V3 failed:", err);
    return null;
  }
}
