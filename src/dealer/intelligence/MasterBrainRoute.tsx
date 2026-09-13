import MasterBrainScreen from "@/features/dealer-ai/dashboards/MasterBrainScreen";
import { useInventory } from "@/context/InventoryProvider";
import { useLeads } from "@/context/LeadsContext";

// MasterBrainScreen (the real SuperBrainEngine-powered dealer/group/oem/
// global/planet AI dashboard) was fully built but never routed anywhere
// in the app — this wires it to the real inventory/leads data and gives
// it a URL.
export default function MasterBrainRoute() {
  const { vehicles } = useInventory();
  const { leads } = useLeads();

  return <MasterBrainScreen data={{ vehicles, leads }} />;
}
