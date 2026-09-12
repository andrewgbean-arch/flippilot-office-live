import { ShareFlipBase } from "./types";
import { formatMoney, formatROI, proFlipBadge } from "./shareFormats";

export async function shareText(flip: ShareFlipBase, compact = false) {
  let msg = `✈️ FlipPilot — ${compact ? "Quick Share" : "Flip Summary"}\n\n`;

  msg += `📦 ${flip.title}\n`;
  msg += `Buy: ${formatMoney(flip.buyPrice)}\n`;
  msg += `Sell: ${formatMoney(flip.sellPrice)}\n`;
  msg += `Profit: ${formatMoney(flip.profit)}\n`;
  msg += `ROI: ${formatROI(flip.roi)}\n`;

  if (!compact) {
    if (flip.confidence != null) msg += `AI Confidence: ${flip.confidence}%\n`;
    if (flip.origin) msg += `Origin: ${flip.origin}\n`;
    if (flip.description) msg += `\n🧠 ${flip.description}\n`;
  }

  msg += `\n${proFlipBadge(flip.isProFlip ?? false, flip.flipScore)}`;

  // Web share API
  if (navigator.share) {
    try {
      await navigator.share({
        text: msg,
        title: "FlipPilot Flip",
      });
      return msg;   // ⭐ FIXED
    } catch (err) {
      console.warn("Web share failed:", err);
    }
  }

  // Fallback: copy to clipboard
  await navigator.clipboard.writeText(msg);
  alert("Flip summary copied to clipboard!");

  return msg;       // ⭐ FIXED
}

