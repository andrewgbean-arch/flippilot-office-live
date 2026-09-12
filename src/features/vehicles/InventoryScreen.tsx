import React from "react";
import { InventoryProvider } from "@/context/InventoryProvider";
import { SupernovaHeroHeader } from "@/components/supernova/SupernovaHeroHeader";
import InventoryDashboard from "@/dealer/inventory/InventoryDashboard";

const InventoryScreen: React.FC = () => {
  return (
    <InventoryProvider>
      <div className="space-y-8">
        <SupernovaHeroHeader
          title="Dealer Inventory"
          subtitle="Manage stock, MOT, recon and market position."
        />
        <InventoryDashboard />
      </div>
    </InventoryProvider>
  );
};

export default InventoryScreen;
