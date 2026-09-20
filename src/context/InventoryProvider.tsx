import React, { createContext, useContext, useState, useEffect, useRef } from "react";

import { loadInventoryFromServer, saveInventoryToServer } from "./inventoryStorage.web";
import { createInventorySaver, sameStatus, type InventorySaver, type SaverStatus } from "./inventorySaver";

import type { Vehicle } from "../types/Vehicle";

// ⭐ AI enrichment layer
import { enrichVehicleWithAI, prepareStock } from "../dealer/intelligence/dealerAI";

import { useDealerNotifications } from "@/features/dealer-notifications/DealerNotificationsContext";
import { useAuth } from "@/context/AuthContext";

const MOT_WARNING_DAYS = 30;

interface InventoryContextType {
  vehicles: Vehicle[];
  loading: boolean;
  // True when the dealer's real stock couldn't be loaded. `vehicles` is
  // empty in that state and nothing is saved until a retry succeeds.
  loadError: boolean;
  refreshInventory: () => void;
  // Why the latest changes to stock couldn't be saved (null when all is
  // well). The changes stay on screen: every later edit, and retrySave,
  // tries again.
  saveError: string | null;
  isSaving: boolean;
  retrySave: () => void;
  // A plain-words heads-up to show until it's dismissed: an edit of theirs was
  // dropped because someone else deleted that car. Not an error, and not
  // cleared by a later successful save (so it gets read).
  saveNotice: string | null;
  dismissSaveNotice: () => void;

  updateVehicleMOT: (vehicleId: string, motData: Vehicle["mot"]) => void;
  updateVehicleSale: (vehicleId: string, sellPrice: number) => void;
  updateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (vehicleId: string) => void;
  createVehicleFromMOT: (motData: any) => Vehicle;
  addManualVehicle: (data: {
    reg?: string | null;
    make: string;
    model: string;
    year?: number | null;
    colour?: string | null;
    mileage?: number | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    notes?: string | null;
    images?: string[] | null;
    mot?: Partial<Vehicle["mot"]>;
    vatScheme?: "standard" | "margin";
  }) => Vehicle;
  importVehicles: (rows: {
    reg?: string | null;
    make: string;
    model: string;
    year?: number | null;
    colour?: string | null;
    mileage?: number | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    notes?: string | null;
    images?: string[] | null;
    mot?: Partial<Vehicle["mot"]>;
    vatScheme?: "standard" | "margin";
  }[]) => Vehicle[];
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaverStatus>({ saving: false, error: null, unsaved: false, notice: null });
  const { addNotification } = useDealerNotifications();
  const { user } = useAuth();
  const motWarnedIds = useRef<Set<string>>(new Set());

  // Everything about saving lives in the saver (see inventorySaver.ts). It
  // holds the list and knows whether it is THIS login's real stock, i.e. a
  // load has succeeded for it — saving from any other state (before the
  // first load lands, after a failed one, or while holding the previous
  // login's cars) would write the wrong thing. The mutators below still hand
  // it whole lists; it works out what the user actually changed (which fields
  // of which cars, which cars are new, which were deleted) and sends only
  // that, so a stale screen can never put back what someone else changed. It
  // remembers everything the server hasn't confirmed yet, saves one request
  // at a time, keeps everything if a save fails, and takes in the server's
  // answer without discarding edits made while the save was in flight.
  // Created once; it only ever calls React's stable setters.
  const saverRef = useRef<InventorySaver | null>(null);
  if (saverRef.current === null) {
    saverRef.current = createInventorySaver({
      send: saveInventoryToServer,
      // One car at a time, so a record the AI layer can't make sense of (say,
      // one saved by another client with no `mot` object) is shown as it is
      // instead of failing the load for the whole stock.
      prepare: prepareStock,
      onVehicles: setVehicles,
      onStatus: (next) => setSaveStatus((prev) => (sameStatus(prev, next) ? prev : next)),
    });
  }
  const saver = saverRef.current;
  // Bumped on every load and on every login change, so a slow response
  // that arrives after the login has changed can't land in the new one.
  const loadSeq = useRef(0);

  // Every change to the stock goes through here. `deletedId` is only ever
  // passed for a car the user deliberately deleted: a saved list that merely
  // lacks a car never removes it (the list may just be out of date).
  function commit(next: Vehicle[], deletedId?: string) {
    if (!saver.isReady()) {
      console.warn(
        "Inventory not saved: the stock hasn't loaded successfully, and saving now would overwrite it."
      );
    }
    void saver.change(next, deletedId);
  }

  // ⭐ MOT EXPIRY WARNINGS
  //
  // A "MOT" notification type already existed, but the only thing that
  // ever used it was "MOT data refreshed" after a manual lookup — there
  // was no proactive check anywhere for a real vehicle's MOT actually
  // approaching (or past) expiry. This runs against the real inventory
  // vehicles use everywhere else in the app, and only ever warns once
  // per vehicle per browser session (motWarnedIds), so it doesn't spam
  // the same alert on every unrelated inventory change.
  useEffect(() => {
    if (loading) return;

    vehicles.forEach((v) => {
      if (v.status === "sold") return;
      if (!v.mot?.expiry) return;
      if (motWarnedIds.current.has(v.id)) return;

      const daysLeft = Math.ceil(
        (new Date(v.mot.expiry).getTime() - Date.now()) / 86400000
      );
      if (daysLeft > MOT_WARNING_DAYS) return;

      motWarnedIds.current.add(v.id);
      const label = `${v.make} ${v.model}${v.reg ? ` (${v.reg})` : ""}`;

      addNotification({
        type: "MOT",
        title: daysLeft < 0 ? "MOT Expired" : "MOT Expiring Soon",
        message:
          daysLeft < 0
            ? `${label}'s MOT expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago.`
            : `${label}'s MOT expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
      });
    });
  }, [vehicles, loading, addNotification]);

  // ⭐ LOAD — THE SERVER IS THE ONLY SOURCE OF TRUTH
  //
  // This used to seed 8 demo cars into a dealer's REAL stock whenever
  // the server answered with an empty list (and, because a failed
  // request also looked like an empty list, whenever it failed). Two
  // real consequences, both reproduced live: those demo cars were
  // "In Stock", so the public /store page and the anonymous CSV feed
  // published them as the dealer's own stock; and after one dropped
  // request at login, the next ordinary "add vehicle" saved the demo
  // cars over the dealer's real ones. Now: an empty list is just an
  // empty stock (a brand-new dealer starts with none, and can clear
  // theirs without it coming back); a failed FIRST load shows nothing,
  // says so (loadError), and blocks saving until a retry succeeds.
  //
  // A refresh (the header's "Sync AI") is different: memory already
  // holds this login's real stock, so a failed refresh just means it
  // didn't get any fresher — it must not blank the screen or block
  // saving over a blip. The saver is only ever not ready when memory ISN'T
  // known-real (never loaded, failed first load, or a login change), so
  // asking it here tells a refresh from a first load.
  //
  // Two more rules, both about not throwing away what the dealer has done:
  //  - If there are changes the server hasn't confirmed (a save failed, or
  //    is still on its way), a refresh means "save them again": a save
  //    answers with the server's whole current list, so it syncs too, while
  //    reading the list instead couldn't be adopted without discarding them.
  //  - A refresh that comes back after the dealer has edited something is
  //    dropped rather than laid over their newer work (see adoptRefresh).
  const loadInventory = async () => {
    if (saver.isReady() && saver.hasUnsaved()) {
      await saver.retry();
      return;
    }

    const seq = ++loadSeq.current;
    const isRefresh = saver.isReady();
    const stamp = saver.stamp();
    setLoading(true);

    const fromServer = await loadInventoryFromServer();
    if (seq !== loadSeq.current) return; // the login changed while this was in flight

    if (fromServer === null) {
      if (!isRefresh) {
        saver.reset();
        setLoadError(true);
      }
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) saver.adoptRefresh(stamp, fromServer);
      else saver.loaded(fromServer);
      setLoadError(false);
    } catch (err) {
      // Real data the AI layer couldn't process: on a first load, fail
      // closed like any other failed load rather than fall back to
      // invented cars; on a refresh, keep the last good stock.
      console.error("Inventory load failed while preparing vehicles:", err);
      if (!isRefresh) {
        saver.reset();
        setLoadError(true);
      }
    }
    setLoading(false);
  };

  // Was `}, [])` — fetched once at app boot and never again. Confirmed
  // live: a real user logging in via the normal form (no full page
  // reload) got stuck with whatever the ONE fetch during the brief
  // unauthenticated moment before login had produced, even though their
  // real inventory genuinely existed on the backend. Depending on the
  // authenticated user's dealershipId makes this re-run exactly when a
  // real login completes (or a different account logs in over an old
  // session in the same tab), instead of only on the very first page
  // load.
  useEffect(() => {
    // Whatever is in memory now belongs to whoever was logged in before
    // (or to nobody) — never to be saved into this account. Resetting also
    // forgets any deletions still waiting to be confirmed and drops a save
    // still on its way, so neither can land in this login.
    saver.reset();

    if (!user?.dealershipId) {
      loadSeq.current += 1; // drop any load still in flight for the last login
      setLoadError(false);
      setLoading(false);
      return;
    }

    void loadInventory();
  }, [user?.dealershipId]);

  // ⭐ UPDATE VEHICLE MOT
  function updateVehicleMOT(vehicleId: string, motData: Vehicle["mot"]) {
    commit(
      saver.getList().map(v =>
        v.id === vehicleId
          ? { ...v, mot: motData }
          : v
      )
    );
  }

  // ⭐ RECORD SALE PRICE
  //
  // Bookkeeping's AddSaleModal records sales into its own store
  // (BookkeepingProvider's SaleEntry[]) — that's the source of truth for
  // the ledger itself, but nothing kept the vehicle's own sellPrice in
  // sync, so anything reading it from here (Supplier Analytics/Detail)
  // showed £0 profit even after a real sale was recorded.
  function updateVehicleSale(vehicleId: string, sellPrice: number) {
    commit(
      saver.getList().map(v =>
        v.id === vehicleId
          ? { ...v, sellPrice, status: "sold" as Vehicle["status"] }
          : v
      )
    );
  }

  // ⭐ GENERIC EDIT
  //
  // EditVehicle.tsx used to call `(window as any).__inventory_setVehicles?.(...)`
  // — a global hook nothing in the codebase ever assigned, so Save/Delete
  // there silently did nothing at all before navigating to a dead route.
  function updateVehicle(vehicleId: string, patch: Partial<Vehicle>) {
    commit(
      saver.getList().map(v =>
        v.id === vehicleId ? { ...v, ...patch } : v
      )
    );
  }

  // The ONE way a car is removed. Its id goes to the server as an explicit
  // deletion (which also removes its hosted photos) and is remembered until
  // the server confirms it, so a failed save doesn't quietly lose the
  // deletion. Merely leaving a car out of a saved list deletes nothing.
  function deleteVehicle(vehicleId: string) {
    commit(
      saver.getList().filter(v => v.id !== vehicleId),
      vehicleId
    );
  }

  // ⭐ AUTO‑CREATE VEHICLE FROM MOT LOOKUP
  function createVehicleFromMOT(mot: any): Vehicle {
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),

      make: mot.make ?? "",
      model: mot.model ?? "",
      year: mot.year ?? null,
      mileage: mot.mileage ?? null,
      colour: mot.colour ?? null,

      priceRetail: 0,
      priceTrade: 0,

      condition: "Unknown",

      mot: {
        expiry: mot.expiry ?? "",
        advisories: mot.advisories ?? [],
        historyScore: mot.historyScore ?? 0,
        history: mot.history ?? [],
        reg: mot.reg ?? null,
        make: mot.make ?? null,
        model: mot.model ?? null,
        year: mot.year ?? null,
        colour: mot.colour ?? null,
        mileage: mot.mileage ?? null,
        fuelType: mot.fuelType ?? null,
        euroStatus: mot.euroStatus ?? null,
      },

      serviceHistory: [],
      depreciationCurve: [],

      finance: {
        apr: 0,
        depositMin: 0,
        lenderTier: "A",
      },

      notes: null,
      images: null,

      costs: [],
      vatScheme: "margin",

      img: "/placeholder-car.png",
      status: "new",
    };

    const enriched = enrichVehicleWithAI(newVehicle);
    commit([...saver.getList(), enriched]);

    return enriched;
  }

  // ⭐ MANUAL "ADD A CAR" ENTRY (Bookkeeping's New Vehicle screen)
  //
  // This used to write to a completely different, unrelated data store
  // (VehicleHistoryContext, a FlipRecord[] left over from the original
  // consumer app this was ported from) — so a car "bought" here never
  // showed up in the real Inventory List, AI Insights, the dashboard,
  // or anywhere else that reads from this provider. It just vanished
  // into a shadow store nothing else looked at.
  function buildVehicle(data: {
    reg?: string | null;
    make: string;
    model: string;
    year?: number | null;
    colour?: string | null;
    mileage?: number | null;
    buyPrice?: number | null;
    sellPrice?: number | null;
    notes?: string | null;
    images?: string[] | null;
    mot?: Partial<Vehicle["mot"]>;
    vatScheme?: "standard" | "margin";
  }): Vehicle {
    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),

      ...(data.reg ? { reg: data.reg } : {}),
      make: data.make,
      model: data.model,
      year: data.year ?? null,
      mileage: data.mileage ?? null,
      ...(data.colour ? { colour: data.colour } : {}),

      buyPrice: data.buyPrice ?? null,
      sellPrice: data.sellPrice ?? null,
      priceRetail: data.sellPrice ?? 0,
      priceTrade: data.buyPrice ?? 0,

      condition: "Unknown",

      mot: {
        expiry: data.mot?.expiry ?? "",
        advisories: data.mot?.advisories ?? [],
        historyScore: data.mot?.historyScore ?? 0,
        history: data.mot?.history ?? [],
        reg: data.reg ?? data.mot?.reg ?? null,
        make: data.make ?? data.mot?.make ?? null,
        model: data.model ?? data.mot?.model ?? null,
        year: data.year ?? data.mot?.year ?? null,
        colour: data.colour ?? data.mot?.colour ?? null,
        mileage: data.mileage ?? data.mot?.mileage ?? null,
        fuelType: data.mot?.fuelType ?? null,
        euroStatus: data.mot?.euroStatus ?? null,
      },

      serviceHistory: [],
      depreciationCurve: [],

      finance: {
        apr: 0,
        depositMin: 0,
        lenderTier: "A",
      },

      notes: data.notes ?? null,
      images: data.images ?? null,

      costs: [],
      vatScheme: data.vatScheme ?? "margin",

      img: data.images?.[0] ?? "/placeholder-car.png",
      status: "new",
    };

    return enrichVehicleWithAI(newVehicle);
  }

  function addManualVehicle(data: Parameters<typeof buildVehicle>[0]): Vehicle {
    const enriched = buildVehicle(data);
    commit([...saver.getList(), enriched]);

    return enriched;
  }

  // Bulk create (CSV import etc.) — builds every vehicle first, then
  // saves once, instead of one save-to-server call per row.
  function importVehicles(rows: Parameters<typeof buildVehicle>[0][]): Vehicle[] {
    const built = rows.map(buildVehicle);
    commit([...saver.getList(), ...built]);
    return built;
  }

  return (
    <InventoryContext.Provider
      value={{
        vehicles,
        loading,
        loadError,
        refreshInventory: loadInventory,
        saveError: saveStatus.error,
        isSaving: saveStatus.saving,
        retrySave: () => {
          void saver.retry();
        },
        saveNotice: saveStatus.notice,
        dismissSaveNotice: () => {
          saver.dismissNotice();
        },
        updateVehicleMOT,
        updateVehicleSale,
        updateVehicle,
        deleteVehicle,
        createVehicleFromMOT,
        addManualVehicle,
        importVehicles,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
}
