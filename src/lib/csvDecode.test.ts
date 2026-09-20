import { describe, it, expect } from "vitest";
import { decodeCsvBytes, readCsvFile, parseCSVWithHeaders } from "./csv";

// Excel's default "CSV (Comma delimited)" on a UK Windows PC is Windows-1252: the
// pound sign is the one byte 0xA3, which is not valid UTF-8. Reading such a file as
// UTF-8 turned every "£5,000" into a replacement character.

const cp1252 = (text: string) => Uint8Array.from(Array.from(text, (ch) => (ch === "£" ? 0xa3 : ch.charCodeAt(0))));

describe("decodeCsvBytes", () => {
  it("reads a Windows-1252 file: the pound sign survives", () => {
    expect(decodeCsvBytes(cp1252("Make,Buy Price\r\nFord,£5,000"))).toBe("Make,Buy Price\r\nFord,£5,000");
  });

  it("the plain UTF-8 read of the same bytes is what lost it (the bug)", () => {
    expect(new TextDecoder("utf-8").decode(cp1252("£5,000"))).toContain("\uFFFD");
    expect(decodeCsvBytes(cp1252("£5,000"))).not.toContain("\uFFFD");
  });

  it("reads UTF-8 as UTF-8, including accents and the pound sign", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("Citroën,£5,000"))).toBe("Citroën,£5,000");
  });

  it("drops a UTF-8 byte order mark", () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Make,Model")]);
    expect(decodeCsvBytes(bytes)).toBe("Make,Model");
  });

  it("reads Windows-1252 accents (é is 0xE9)", () => {
    expect(decodeCsvBytes(Uint8Array.from([0x43, 0x69, 0x74, 0x72, 0x6f, 0xeb, 0x6e]))).toBe("Citroën");
  });

  it("plain ASCII is the same either way", () => {
    expect(decodeCsvBytes(new TextEncoder().encode("a,b\n1,2"))).toBe("a,b\n1,2");
  });

  it("accepts an ArrayBuffer as well as a Uint8Array, and an empty file", () => {
    const bytes = cp1252("£1");
    expect(decodeCsvBytes(bytes.buffer)).toBe("£1");
    expect(decodeCsvBytes(new Uint8Array(0))).toBe("");
  });

  it("the parsed file has the pound signs in its cells", () => {
    const parsed = parseCSVWithHeaders(decodeCsvBytes(cp1252('Make,Price\r\nFord,"£5,000"')));
    expect(parsed.rows[0]).toEqual(["Ford", "£5,000"]);
  });
});

describe("readCsvFile", () => {
  it("reads a file by its bytes when it has arrayBuffer()", async () => {
    const bytes = cp1252("£5,000");
    const text = await readCsvFile({
      arrayBuffer: async () => bytes.buffer as ArrayBuffer,
      text: async () => "wrong: this is the UTF-8-only read",
    });
    expect(text).toBe("£5,000");
  });

  it("falls back to text() for anything that only has text()", async () => {
    expect(await readCsvFile({ text: async () => "a,b" })).toBe("a,b");
  });
});
