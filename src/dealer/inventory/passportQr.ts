import qrcode from "qrcode-generator";

// A QR code for an address, as rows of dark/light squares. Medium error
// correction (about 15% can be damaged and it still scans: a windscreen and a
// bit of glare are fine), and the smallest size that fits the address.
export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
}

// One SVG path that draws every dark square, so the code is a single shape.
export function qrPath(modules: boolean[][]): string {
  const parts: string[] = [];
  modules.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) parts.push(`M${c},${r}h1v1h-1z`);
    })
  );
  return parts.join("");
}

// The quiet border a scanner needs around the code, in squares.
export const QR_QUIET_ZONE = 4;
