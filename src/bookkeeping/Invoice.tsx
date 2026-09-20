import { formatMoney } from "@/lib/formatMoney";
import { useParams, useNavigate } from "react-router-dom";
import { useBookkeeping } from "./BookkeepingProvider";
import { useInventory } from "@/context/InventoryProvider";
import { useDealer } from "@/context/DealerContext";
import { mailtoHref } from "@/lib/mailto";
import { invoiceFigures } from "./invoiceUtils";
import "@/staff/StaffDashboard.css";

// Pulls everything from the real records already in the system — the
// vehicle, the recorded sale (with its already-computed VAT), and the
// dealer's own profile — rather than the manual re-entry ContractGenerator/
// DealSheet require. Nothing here is typed twice.
export default function Invoice() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { sales } = useBookkeeping();
  const { vehicles } = useInventory();
  const { dealer } = useDealer();

  const sale = sales.find((s) => s.vehicleId === vehicleId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!sale || !vehicle) {
    return (
      <div className="sn-panel sn-panel--full" style={{ margin: 24 }}>
        <h2 className="sn-panel__title">No Sale Recorded</h2>
        <p className="sn-empty">This vehicle has no recorded sale to invoice yet.</p>
        <button className="sn-btn sn-btn--ghost" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }

  // What the customer pays and the lines to print come from ONE function
  // (invoiceUtils.ts), used by the page below and by the email, so they cannot
  // disagree. The sale price alone is NOT the total: for a sale entered as
  // "VAT added on top" it is the net figure, and the VAT is on top of it.
  const figures = invoiceFigures(sale);
  const totalDue = figures.totalDue;
  if (totalDue === null) {
    // A sale saved with a blank or unreadable price has nothing honest to bill.
    // Printing £0.00 as if that were the price is exactly what must not happen.
    return (
      <div className="sn-panel sn-panel--full" style={{ margin: 24 }}>
        <h2 className="sn-panel__title">No Price Recorded</h2>
        <p className="sn-empty">
          Invoice {sale.invoiceNumber} has no usable sale price, so there is nothing to bill. Edit the sale and
          enter the price the car sold for, then come back to print this invoice.
        </p>
        <button className="sn-btn sn-btn--ghost" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }
  const money = (amount: number) => formatMoney(amount, { pence: true });

  // Under the UK VAT Margin Scheme (HMRC Notice 718), the invoice must
  // NOT show VAT separately at all — only the total price, with a
  // statement that it's a margin scheme supply. Showing a VAT
  // breakdown on a margin scheme invoice is a real, common compliance
  // mistake, not just a cosmetic choice — this branches on the sale's
  // actual scheme rather than always printing a VAT line.
  const isMargin = figures.scheme === "margin";
  const invoiceTitle = isMargin ? "Invoice" : dealer?.vatNumber ? "VAT Invoice" : "Invoice";
  const invoiceDate = new Date(sale.date).toLocaleDateString("en-GB");

  // mailto: can't attach the formatted invoice itself (no browser API
  // for that) — it pre-fills a plain-text summary in the customer's
  // own email client instead. Genuinely opens and sends for real, just
  // not an automatically-delivered PDF; that would need a real email
  // service (a provider decision, same as the DVLA API key situation).
  const invoiceMailto = sale.buyerEmail
    ? mailtoHref(sale.buyerEmail, {
        subject: `Invoice ${sale.invoiceNumber} from ${dealer?.name ?? "your dealer"}`,
        body: [
          `Dear ${sale.buyer || "Customer"},`,
          "",
          `Please find your invoice details below for the ${vehicle.make} ${vehicle.model}${
            vehicle.reg ? ` (${vehicle.reg})` : ""
          }.`,
          "",
          `Invoice Number: ${sale.invoiceNumber}`,
          `Date: ${invoiceDate}`,
          // The same lines the printed invoice shows. A margin-scheme invoice
          // has no VAT lines at all.
          ...(figures.vatLines
            ? [`Net: ${money(figures.vatLines.net)}`, `VAT (${figures.vatLines.ratePercent}%): ${money(figures.vatLines.vat)}`]
            : []),
          `Total: ${money(totalDue)}`,
          "",
          "Thank you for your business.",
          dealer?.name ?? "",
        ].join("\n"),
      })
    : null;

  return (
    <div className="sn-panel sn-panel--full" style={{ margin: 24 }}>
      <div className="sn-rota-header">
        <h2 className="sn-panel__title">Invoice {sale.invoiceNumber}</h2>
        <div className="sn-rota-week-nav">
          <button className="sn-btn sn-btn--ghost" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <button className="sn-btn sn-btn--gold" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          {invoiceMailto ? (
            <a className="sn-btn sn-btn--gold" href={invoiceMailto}>
              Email to Customer
            </a>
          ) : (
            <span className="sn-timeclock__subtitle" style={{ margin: 0 }}>
              Add the buyer's email on the sale to enable emailing.
            </span>
          )}
        </div>
      </div>

      <div className="sn-contract-doc printable-invoice">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{dealer?.name ?? "Your Dealership"}</p>
            {dealer?.address && <p style={{ margin: "2px 0", whiteSpace: "pre-line" }}>{dealer.address}</p>}
            {dealer?.phone && <p style={{ margin: "2px 0" }}>{dealer.phone}</p>}
            {dealer?.vatNumber && <p style={{ margin: "2px 0" }}>VAT No: {dealer.vatNumber}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{invoiceTitle}</p>
            <p style={{ margin: "2px 0" }}>No: {sale.invoiceNumber}</p>
            <p style={{ margin: "2px 0" }}>Date: {invoiceDate}</p>
          </div>
        </div>

        <hr />

        <p style={{ fontWeight: 700, marginBottom: 4 }}>Bill To</p>
        <p style={{ margin: "2px 0" }}>{sale.buyer || "—"}</p>
        {sale.buyerAddress && <p style={{ margin: "2px 0", whiteSpace: "pre-line" }}>{sale.buyerAddress}</p>}
        {sale.buyerEmail && <p style={{ margin: "2px 0" }}>{sale.buyerEmail}</p>}
        {sale.buyerPhone && <p style={{ margin: "2px 0" }}>{sale.buyerPhone}</p>}

        <hr />

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "6px 4px" }}>Description</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: "6px 4px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "6px 4px" }}>
                {vehicle.make} {vehicle.model}
                {vehicle.reg ? ` — ${vehicle.reg}` : ""}
                {vehicle.year ? `, ${vehicle.year}` : ""}
                {vehicle.mileage != null ? `, ${vehicle.mileage.toLocaleString()} miles` : ""}
              </td>
              <td style={{ textAlign: "right", padding: "6px 4px" }}>{money(figures.itemAmount ?? totalDue)}</td>
            </tr>
          </tbody>
        </table>

        {isMargin ? (
          <div style={{ marginTop: 12, fontSize: 12, color: "#555" }}>
            <p style={{ margin: "2px 0" }}>This vehicle is sold under the VAT Margin Scheme (HMRC Notice 718).</p>
            <p style={{ margin: "2px 0" }}>No VAT is separately identified on this invoice.</p>
          </div>
        ) : figures.vatLines ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>Net</span>
              <span>{money(figures.vatLines.net)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>VAT ({figures.vatLines.ratePercent}%)</span>
              <span>{money(figures.vatLines.vat)}</span>
            </div>
          </div>
        ) : null}

        <hr />

        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
          <span>Total Due</span>
          <span>{money(totalDue)}</span>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: "#555" }}>
          This vehicle is sold with a valid MOT (where applicable) unless otherwise stated. All prices are in GBP.
        </p>
      </div>
    </div>
  );
}
