import { useMemo, useState } from "react";
import { useInventory } from "@/context/InventoryProvider";
import { useConsumables } from "@/context/ConsumablesContext";
import { useBookkeeping } from "@/bookkeeping/BookkeepingProvider";
import { parseCSVWithHeaders, guessColumn, readCsvFile } from "@/lib/csv";
import { readImportPrices, readImportCounts, unreadablePriceSummary, unreadableCountSummary } from "./importPrices";

type ImportType = "vehicles" | "consumables";

interface FieldSpec {
  key: string;
  label: string;
  required?: boolean;
  numeric?: boolean;
  aliases: string[];
}

const VEHICLE_FIELDS: FieldSpec[] = [
  { key: "make", label: "Make", required: true, aliases: ["make", "manufacturer", "brand"] },
  { key: "model", label: "Model", required: true, aliases: ["model"] },
  { key: "reg", label: "Registration", aliases: ["reg", "registration", "plate", "vrm", "reg no", "reg number"] },
  { key: "year", label: "Year", numeric: true, aliases: ["year", "reg year", "model year"] },
  { key: "mileage", label: "Mileage", numeric: true, aliases: ["mileage", "miles", "odometer"] },
  { key: "colour", label: "Colour", aliases: ["colour", "color"] },
  { key: "buyPrice", label: "Buy / Trade Price", numeric: true, aliases: ["buy price", "trade price", "cost price", "purchase price", "cost"] },
  { key: "sellPrice", label: "Sell / Retail Price", numeric: true, aliases: ["sell price", "retail price", "asking price", "price"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
];

const CONSUMABLE_FIELDS: FieldSpec[] = [
  { key: "name", label: "Item Name", required: true, aliases: ["name", "item", "item name", "product"] },
  { key: "partNumber", label: "Part Number", aliases: ["part number", "part no", "sku", "code"] },
  { key: "description", label: "Description", aliases: ["description", "desc", "spec"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom"] },
  { key: "currentStock", label: "Current Stock", numeric: true, aliases: ["current stock", "stock", "qty", "quantity", "stock level"] },
  { key: "reorderThreshold", label: "Reorder Below", numeric: true, aliases: ["reorder threshold", "reorder level", "min stock", "reorder below"] },
  { key: "supplierName", label: "Supplier Name", aliases: ["supplier", "supplier name"] },
  { key: "supplierEmail", label: "Supplier Email", aliases: ["supplier email", "email"] },
  { key: "supplierPhone", label: "Supplier Phone", aliases: ["supplier phone", "phone"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
];

export default function ImportScreen() {
  const { importVehicles, vehicles: stock } = useInventory();
  const { importConsumables } = useConsumables();
  const { addPurchases } = useBookkeeping();

  const [type, setType] = useState<ImportType>("vehicles");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    unreadablePrices: number;
    unreadableCounts: number;
    // Cars that were imported with a buy price whose purchase record could NOT be
    // saved to the books.
    purchasesNotSaved: number;
    // Cars left out because a car with the same registration is already in
    // stock (or earlier in the same file): importing a file twice used to add
    // every car again.
    alreadyInStock: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const fields = type === "vehicles" ? VEHICLE_FIELDS : CONSUMABLE_FIELDS;

  function resetFile() {
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setError(null);
  }

  function switchType(next: ImportType) {
    setType(next);
    resetFile();
  }

  async function handleFile(file: File) {
    setResult(null);
    setError(null);
    // Read as bytes, not file.text(): Excel's default CSV is Windows-1252, and a
    // UTF-8-only read turns its pound signs into unreadable characters.
    const text = await readCsvFile(file);
    const parsed = parseCSVWithHeaders(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError("Couldn't find any rows in that file — check it's a real CSV with a header row.");
      return;
    }
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);

    const guessed: Record<string, string> = {};
    const activeFields = type === "vehicles" ? VEHICLE_FIELDS : CONSUMABLE_FIELDS;
    for (const f of activeFields) {
      const match = guessColumn(parsed.headers, f.aliases);
      if (match) guessed[f.key] = match;
    }
    setMapping(guessed);
  }

  // Every row mapped to target field values, plus whether it's usable
  // (required fields present) — computed fresh whenever the mapping
  // or file changes, so the preview and the real import always agree.
  const builtRows = useMemo(() => {
    if (headers.length === 0) return [];
    const colIndex = (header: string) => headers.indexOf(header);

    return rows.map((row) => {
      const values: Record<string, string> = {};
      for (const f of fields) {
        const header = mapping[f.key];
        const idx = header ? colIndex(header) : -1;
        values[f.key] = idx >= 0 ? (row[idx] ?? "").trim() : "";
      }
      const missingRequired = fields.filter((f) => f.required && !values[f.key]);
      // Prices, a year or a mileage typed in the file that cannot be read ("£5,00",
      // "abc", "45k"): the import leaves them blank, and says so, rather than
      // dropping them silently.
      const unreadablePrices =
        type === "vehicles" ? [...readImportPrices(values).unreadable, ...readImportCounts(values).unreadable] : [];
      return { values, valid: missingRequired.length === 0, missingRequired, unreadablePrices };
    });
  }, [rows, headers, mapping, fields, type]);

  const validCount = builtRows.filter((r) => r.valid).length;

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const usable = builtRows.filter((r) => r.valid);

      let unreadablePrices = 0;
      let unreadableCounts = 0;
      let purchasesNotSaved = 0;
      let alreadyInStock = 0;

      if (type === "vehicles") {
        const plate = (text: unknown) => (typeof text === "string" ? text.replace(/\s+/g, "").toUpperCase() : "");
        const seen = new Set((stock ?? []).flatMap((v) => [plate(v.reg), plate(v.mot?.reg)]).filter(Boolean));
        const fresh = usable.filter((r) => {
          const reg = plate(r.values.reg);
          if (!reg) return true; // no registration: nothing to match on, so it's added
          if (seen.has(reg)) {
            alreadyInStock += 1;
            return false;
          }
          seen.add(reg);
          return true;
        });
        const payload = fresh.map((r) => {
          // A price that reads ("£5,000", "5,000") is kept; blank stays unset;
          // one that is typed but unreadable is left unset and COUNTED. A year or
          // mileage is read the same way ("45,000" reads; "45k" is counted).
          const prices = readImportPrices(r.values);
          const counts = readImportCounts(r.values);
          if (prices.unreadable.length > 0) unreadablePrices += 1;
          if (counts.unreadable.length > 0) unreadableCounts += 1;
          return {
            make: r.values.make ?? "",
            model: r.values.model ?? "",
            ...(r.values.reg ? { reg: r.values.reg } : {}),
            year: counts.year,
            mileage: counts.mileage,
            ...(r.values.colour ? { colour: r.values.colour } : {}),
            buyPrice: prices.buyPrice,
            sellPrice: prices.sellPrice,
            notes: r.values.notes || null,
          };
        });
        const created = importVehicles(payload);
        // Without this, an imported vehicle's buyPrice sits only on the
        // Vehicle record — Pricing Workflow (and anything else keyed off
        // bookkeeping.purchases, e.g. margin-scheme sale calculations)
        // looks for a matching PurchaseEntry and finds none, so every
        // imported car would show "Vehicle Not Found" there forever.
        // Mirrors NewVehicle.tsx's manual add-vehicle flow. VAT is left
        // at 0/not-included since the CSV carries no VAT information —
        // better to under-claim than fabricate a reclaim that isn't real.
        //
        // ALL the purchases go in as ONE batch. They used to be added one at a
        // time in a loop, and each call built its new list from the same
        // out-of-date copy of the books, so of N priced cars only the last
        // purchase survived while the screen said "Imported N vehicles".
        const purchases = created
          .filter((vehicle) => vehicle.buyPrice != null)
          .map((vehicle) => ({
            id: crypto.randomUUID(),
            vehicleId: vehicle.id,
            purchasePrice: vehicle.buyPrice as number,
            source: "CSV Import",
            date: new Date().toISOString(),
            vatRate: 0,
            vatIncluded: false,
            vatAmount: 0,
            netAmount: vehicle.buyPrice as number,
          }));
        // Say so when the books could not take them, rather than reporting success.
        if (purchases.length > 0) purchasesNotSaved = purchases.length - addPurchases(purchases);
      } else {
        const payload = usable.map((r) => ({
          name: r.values.name ?? "",
          ...(r.values.partNumber ? { partNumber: r.values.partNumber } : {}),
          ...(r.values.description ? { description: r.values.description } : {}),
          ...(r.values.unit ? { unit: r.values.unit } : {}),
          currentStock: r.values.currentStock ? Number(r.values.currentStock) || 0 : 0,
          reorderThreshold: r.values.reorderThreshold ? Number(r.values.reorderThreshold) || 0 : 5,
          ...(r.values.supplierName ? { supplierName: r.values.supplierName } : {}),
          ...(r.values.supplierEmail ? { supplierEmail: r.values.supplierEmail } : {}),
          ...(r.values.supplierPhone ? { supplierPhone: r.values.supplierPhone } : {}),
          ...(r.values.notes ? { notes: r.values.notes } : {}),
        }));
        await importConsumables(payload);
      }

      setResult({
        imported: usable.length - alreadyInStock,
        skipped: builtRows.length - usable.length,
        unreadablePrices,
        unreadableCounts,
        purchasesNotSaved,
        alreadyInStock,
      });
    } catch (err) {
      setError("Import failed — check the backend is reachable and try again.");
      console.error(err);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="animate-fadeIn text-white px-6 py-10 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-yellow-300 mb-2">Import from a File</h1>
      <p className="text-white/60 mb-6">
        Bring in your existing stock list from a CSV export — a spreadsheet, or an export from
        another system. Nothing here needs a specific format; map whatever columns your file has.
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => switchType("vehicles")}
          className={`px-4 py-2 rounded font-semibold ${type === "vehicles" ? "bg-yellow-400 text-black" : "bg-white/10 text-white/70"}`}
        >
          Vehicle Inventory
        </button>
        <button
          onClick={() => switchType("consumables")}
          className={`px-4 py-2 rounded font-semibold ${type === "consumables" ? "bg-yellow-400 text-black" : "bg-white/10 text-white/70"}`}
        >
          Consumables / Parts
        </button>
      </div>

      <div className="bg-black/40 border border-white/10 rounded-xl p-6 mb-6">
        <label htmlFor="importscreen-csv-file" className="text-white/60 text-sm block mb-2">CSV file</label>
        <input id="importscreen-csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-white/80 text-sm"
        />
        {fileName && <p className="text-white/60 text-xs mt-2">{fileName} — {rows.length} row{rows.length === 1 ? "" : "s"} found</p>}
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

        <button
          onClick={() => setShowHelp((v) => !v)}
          className="mt-4 px-4 py-2 rounded font-semibold bg-red-600 text-white hover:bg-red-500 transition"
        >
          {showHelp ? "Hide Help" : "Need Help? Step-by-Step Guide"}
        </button>

        {showHelp && (
          <ol className="mt-4 space-y-3 text-white/70 text-sm list-decimal list-inside bg-black/30 border border-white/10 rounded-lg p-4">
            <li>
              Choose whether you're importing <strong className="text-white/90">Vehicle Inventory</strong> or{" "}
              <strong className="text-white/90">Consumables / Parts</strong> using the two buttons above.
            </li>
            <li>
              Make sure your file is saved as a <strong className="text-white/90">CSV</strong> file. If your
              stock list is in Excel or Google Sheets, use "Save As" / "Export" and choose CSV — this screen
              can't read a plain .xlsx file directly.
            </li>
            <li>
              Click <strong className="text-white/90">Choose File</strong> above and pick your CSV from your
              computer.
            </li>
            <li>
              Check the <strong className="text-white/90">"Your file, as uploaded"</strong> table that
              appears — this shows exactly what was read from your file, so you can confirm it's the right
              one before doing anything else.
            </li>
            <li>
              In <strong className="text-white/90">"Match your columns"</strong>, tell it which column in
              your file matches each field. Most common column names are matched automatically — you only
              need to fix any that show "— Not in file —".
            </li>
            <li>
              Check the <strong className="text-white/90">Preview</strong> table — it shows exactly how many
              rows are ready to import, and flags any row that's missing a required field.
            </li>
            <li>
              Click <strong className="text-white/90">Import</strong>. Nothing is saved to your real stock
              until you click this — everything before this step is just a preview.
            </li>
          </ol>
        )}
      </div>

      {headers.length > 0 && (
        <>
          {/* Raw preview of the file exactly as uploaded — shown before
              any mapping/import decisions, so a customer uploading their
              real stock list for the first time gets an immediate "yep,
              that's my file" confirmation rather than being dropped
              straight into a column-matching form with no visual
              context for what was actually read. */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-6 mb-6 overflow-x-auto">
            <h2 className="text-white/80 font-semibold mb-1">Your file, as uploaded</h2>
            <p className="text-white/60 text-xs mb-4">
              Exactly what's in {fileName} — nothing changed or interpreted yet. Check this looks
              like your stock list before mapping the columns below.
            </p>
            <table className="text-sm w-full">
              <thead>
                <tr className="text-white/50 text-left">
                  {headers.map((h, i) => <th key={i} className="pr-4 pb-2 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-white/10">
                    {headers.map((_, j) => (
                      <td key={j} className="pr-4 py-1 text-white/80 whitespace-nowrap">{row[j] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && <p className="text-white/60 text-xs mt-2">…and {rows.length - 5} more rows</p>}
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-white/80 font-semibold mb-4">Match your columns</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-white/60 text-sm">
                    {f.label}{f.required && <span className="text-red-400"> *</span>}
                  </label>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full p-2 rounded bg-black/40 border border-white/10 text-white/80"
                  >
                    <option value="">— Not in file —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-xl p-6 mb-6 overflow-x-auto">
            <h2 className="text-white/80 font-semibold mb-4">
              Preview — {validCount} of {rows.length} row{rows.length === 1 ? "" : "s"} ready to import
            </h2>
            <table className="text-sm w-full">
              <thead>
                <tr className="text-white/50 text-left">
                  {fields.map((f) => <th key={f.key} className="pr-4 pb-2">{f.label}</th>)}
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {builtRows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-white/10">
                    {fields.map((f) => <td key={f.key} className="pr-4 py-1 text-white/80">{r.values[f.key] || "—"}</td>)}
                    <td className="py-1">
                      {r.valid ? (
                        r.unreadablePrices.length > 0 ? (
                          <span className="text-yellow-300">
                            Ready, but {r.unreadablePrices.join(" and ")} can't be read and will be left blank
                          </span>
                        ) : (
                          <span className="text-green-400">Ready</span>
                        )
                      ) : (
                        <span className="text-red-400">Missing {r.missingRequired.map((f) => f.label).join(", ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && <p className="text-white/60 text-xs mt-2">…and {rows.length - 8} more rows</p>}
          </div>

          {result ? (
            <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-6">
              <p className="text-green-300 font-semibold">
                Imported {result.imported} {type === "vehicles" ? "vehicle" : "item"}{result.imported === 1 ? "" : "s"}.
                {result.skipped > 0 && ` Skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"} missing required fields.`}
                {result.alreadyInStock > 0 &&
                  ` Left out ${result.alreadyInStock} car${result.alreadyInStock === 1 ? "" : "s"} already in your stock (same registration).`}
              </p>
              {unreadablePriceSummary(result.unreadablePrices) && (
                <p role="status" className="text-yellow-300 text-sm mt-2">
                  {unreadablePriceSummary(result.unreadablePrices)}
                </p>
              )}
              {unreadableCountSummary(result.unreadableCounts) && (
                <p role="status" className="text-yellow-300 text-sm mt-2">
                  {unreadableCountSummary(result.unreadableCounts)}
                </p>
              )}
              {result.purchasesNotSaved > 0 && (
                <p role="alert" className="text-red-300 text-sm mt-2">
                  {result.purchasesNotSaved} of the imported cars had a buy price, but{" "}
                  {result.purchasesNotSaved === 1 ? "its purchase record" : "their purchase records"} could not be
                  saved to your books, so {result.purchasesNotSaved === 1 ? "it has" : "they have"} no purchase
                  in Bookkeeping and profit cannot be worked out for {result.purchasesNotSaved === 1 ? "it" : "them"}{" "}
                  yet. Check your connection and your role's access to the books.
                </p>
              )}
              <button onClick={resetFile} className="mt-3 px-4 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20">
                Import Another File
              </button>
            </div>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="px-6 py-3 rounded font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${validCount} ${type === "vehicles" ? "Vehicle" : "Item"}${validCount === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
