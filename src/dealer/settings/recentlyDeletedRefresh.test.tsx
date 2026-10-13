import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthProvider } from "@/context/AuthContext";
import { DealerNotificationsProvider } from "@/features/dealer-notifications/DealerNotificationsContext";
import { LeadsProvider, useLeads } from "@/context/LeadsContext";
import { JobsProvider, useJobs } from "@/context/JobsContext";
import { ContactsProvider, useContacts } from "@/context/ContactsContext";
import { ConsumablesProvider, useConsumables } from "@/context/ConsumablesContext";

// Restoring a lead, job, contact or consumable from Recently deleted puts it back on the
// server, but each of those screens keeps its own copy of its list. Without reading the list
// again, the restored item was missing from Leads (and the rest) until the page was reloaded,
// so a restore looked like it had failed.

function probe<T>(Provider: React.ComponentType<{ children: React.ReactNode }>, read: () => T): T {
  let got: T | undefined;
  function Grab() {
    got = read();
    return null;
  }
  renderToStaticMarkup(
    <AuthProvider>
      <DealerNotificationsProvider>
        <Provider>
          <Grab />
        </Provider>
      </DealerNotificationsProvider>
    </AuthProvider>
  );
  return got as T;
}

describe("every list that can be restored can be read again", () => {
  it("leads", () => expect(typeof probe(LeadsProvider, useLeads).refreshLeads).toBe("function"));
  it("jobs", () => expect(typeof probe(JobsProvider, useJobs).refreshJobs).toBe("function"));
  it("contacts", () => expect(typeof probe(ContactsProvider, useContacts).refreshContacts).toBe("function"));
  it("consumables", () => expect(typeof probe(ConsumablesProvider, useConsumables).refreshConsumables).toBe("function"));
});

describe("the Recently deleted screen", () => {
  const source = readFileSync(join(__dirname, "RecentlyDeletedScreen.tsx"), "utf8");

  it("reads the matching list again after a successful restore, and not before it succeeds", () => {
    const restore = source.slice(source.indexOf("async function restore"), source.indexOf("async function remove"));
    const failed = restore.indexOf("if (!res.ok)");
    const refresh = restore.indexOf("refreshList[item.list]()");
    expect(failed).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(failed);
  });

  it("knows how to read all four lists", () => {
    for (const name of ["leads: refreshLeads", "jobs: refreshJobs", "contacts: refreshContacts", "consumables: refreshConsumables"]) {
      expect(source).toContain(name);
    }
  });
});
