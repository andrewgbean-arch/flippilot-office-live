// Minimal RFC-4180-ish CSV parser — handles quoted fields (with escaped
// "" inside them), commas inside quotes, and both \n and \r\n line
// endings. Good enough for the kind of stock/inventory export a dealer
// would get out of Excel, Google Sheets, or another dealer system —
// not a full spec implementation (no multi-char delimiters, no BOM
// stripping beyond the one common case below).
export function parseCSV(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  return rows;
}

// The text of a CSV file's bytes.
//
// `file.text()` always decodes as UTF-8. Excel's default "CSV (Comma delimited)" on
// a UK Windows PC does NOT save UTF-8: it saves Windows-1252, where the pound sign
// is the single byte 0xA3. That byte is not valid UTF-8, so every "£5,000" turned
// into a replacement character and the price could not be read. So: UTF-8 first
// (what Excel's "CSV UTF-8", Google Sheets and Numbers save), and when the bytes are
// not valid UTF-8, Windows-1252. A UTF-8 byte order mark is dropped.
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Reads a chosen file. A File has arrayBuffer(); anything that only has text()
// (a stand-in, an old browser) is read the plain way.
export async function readCsvFile(file: {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
}): Promise<string> {
  if (typeof file.arrayBuffer === "function") return decodeCsvBytes(await file.arrayBuffer());
  return file.text();
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSVWithHeaders(text: string): ParsedCSV {
  const all = parseCSV(text);
  const [headers, ...rows] = all;
  return { headers: headers ?? [], rows };
}

// Reverse of parseCSV — quotes a field only when it actually needs it
// (contains a comma, quote, or newline), so a plain CSV of simple
// values stays readable rather than every cell wrapped in quotes.
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => csvField(cell == null ? "" : String(cell))).join(","));
  }
  return lines.join("\r\n");
}

// Triggers a real browser file download for CSV text built with
// toCSV() — no backend round-trip needed since the data (inventory,
// bookkeeping) is already loaded client-side via existing providers.
export function downloadCSV(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Best-effort auto-match of a target field to one of the file's real
// headers, so most real-world exports need zero manual remapping —
// staff only need to fix whatever didn't guess correctly.
export function guessColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx] ?? null;
  }
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h.includes(alias));
    if (idx !== -1) return headers[idx] ?? null;
  }
  return null;
}
