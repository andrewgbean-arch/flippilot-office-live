import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/context/InventoryProvider", () => ({
  useInventory: () => ({ vehicles: [] }),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { dealershipId: "d1" } }),
}));

import ToolsHub from "./tools/ToolsHub";
import MarketplaceSync, { PlatformCard } from "./marketing/MarketplaceSync";

// The Tools Hub and Marketplace Sync screens used to promise things the app
// does not do: "real per-vehicle valuation" from invented scores, and pushing
// stock to AutoTrader, Motors.co.uk and eBay Motors when all it has is a CSV
// download. These read the wording a dealer sees.

describe("Tools Hub wording", () => {
  const html = renderToStaticMarkup(<MemoryRouter><ToolsHub /></MemoryRouter>);

  it("no longer claims real valuation, risk and market-pressure scoring", () => {
    expect(html).not.toContain("Real per-vehicle valuation");
    expect(html).not.toContain("AI Price Estimator");
    expect(html).not.toContain("market-pressure");
    expect(html).not.toContain("Market trends and pricing intelligence");
  });

  it("calls the AI and market screens experimental and says they are not live market data", () => {
    expect(html).toContain("AI Insights (experimental)");
    expect(html).toContain("Market Views (experimental)");
    expect(html).toContain("not live market data");
    expect(html).toContain("not live");
  });

  it("says the marketplace feed is a file and that nothing is sent to a portal", () => {
    expect(html).not.toContain("syndication");
    expect(html).toContain("CSV stock feed");
    expect(html).toContain("Nothing is sent to any portal automatically");
  });

  it("is honest that the VIN scanner is best effort", () => {
    expect(html).toContain("Best effort only");
    expect(html).toContain("five makes");
  });
});

describe("Marketplace Sync wording", () => {
  const html = renderToStaticMarkup(<MarketplaceSync />);

  it("does not say it pushes stock to AutoTrader, Motors.co.uk or eBay Motors", () => {
    expect(html).not.toContain("Push your stock");
    expect(html).not.toContain("accept a stock feed like this directly");
    expect(html).not.toContain("Needs a Business Account First");
  });

  it("says what it really does: a CSV feed to download or link, and no sending", () => {
    expect(html).toContain("Download your stock as a CSV feed");
    expect(html).toContain("FlipPilot does not send your stock to any portal for you");
    expect(html).toContain("Direct Portal Connections: Not Available Yet");
    expect(html).toContain("FlipPilot cannot send your stock to these portals yet");
  });

  it("a portal card shows what the portal needs and never a Connected badge, even when the server has a key set", () => {
    for (const available of [true, false]) {
      const card = renderToStaticMarkup(
        <PlatformCard
          label="AutoTrader"
          platform={{ available, method: "api", note: "Requires a paid AutoTrader dealer account." }}
        />
      );
      expect(card).toContain("AutoTrader");
      expect(card).toContain("Requires a paid AutoTrader dealer account.");
      expect(card).not.toContain("Connected");
    }
  });
});
