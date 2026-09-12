export interface GlobalIntelModel {
  region: string;
  totalLeads: number;
  avgFlipScore: number;
  pressure: number;
  stability: "Stable" | "Moderate Stress" | "High Stress";
  economicsImpact: EconomicsModel;
}
export interface SupplyChainModel {
  oem: string;
  globalDemand: number;
  supplyCapacity: number;
  supplyStress: "Stable" | "Near Capacity" | "Overloaded";
  economicsImpact: EconomicsModel;
  recommendation: string;
}
export interface GlobalStressModel {
  avgPressure: number;
  supplyStressCount: number;
  globalStress: number;
  band: "Low Global Stress" | "Moderate Global Stress" | "Severe Global Stress";
  recommendation: string;
}
export interface StockStrategyModel {
  region: string;
  ratio: number;
  strategy: "Hold" | "Shift stock INTO region" | "Shift stock OUT of region";
  economicsImpact: EconomicsModel;
}
export interface GovernanceModel {
  regionIntel: GlobalIntelModel[];
  supplyIntel: SupplyChainModel[];
  stressIntel: GlobalStressModel;
  stockStrategy: StockStrategyModel[];
  governanceStatus: string;
}
export interface EconomicsModel {
  globalInflation: number;
  shippingCostIndex: number;
  commodityPrices: number;
  energyCost: number;
}
export interface GlobalAISuiteModel {
  globalIntel: GlobalIntelModel[];
  supplyChain: SupplyChainModel[];
  globalStress: GlobalStressModel;
  stockStrategy: StockStrategyModel[];
  governanceBrain: GovernanceModel;
  economicsBrain: EconomicsModel;
  status: string;
}
