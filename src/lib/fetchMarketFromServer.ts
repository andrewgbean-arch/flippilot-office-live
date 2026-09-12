const SERVER = "http://192.168.0.47:3001";
export default async function fetchMarketData(query: string) {
  if (!query) {
    console.log("fetchMarketData: no query provided");
    return null;
  }
  try {
    const url = `${SERVER}/search?q=${encodeURIComponent(query)}`;
    console.log("fetchMarketData →", url);
    const res = await fetch(url);
    const json = await res.json();
    console.log("📦 BARCODE BACKEND RESPONSE →", JSON.stringify(json, null, 2));
    return json;
  } catch (err) {
    console.log("fetchMarketData ERROR →", err);
    return null;
  }
}
