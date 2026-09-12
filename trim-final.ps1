# ============================
# FLIPPILOT FINAL TRIM SCRIPT
# ============================

# --- Old Screens ---
Remove-Item "screens/AutonomousMonitor.tsx"
Remove-Item "screens/DealerCommandCenter.tsx"
Remove-Item "screens/LeadCRMIntelligence.tsx"
Remove-Item "screens/VehicleIntelligence.tsx"

# --- Old Dealer Intelligence (v1) ---
Remove-Item "dealer/AIInsights.tsx"
Remove-Item "dealer/intelligence/dealerAI.ts"
Remove-Item "dealer/intelligence/DealerAICommandHub.tsx"
Remove-Item "dealer/intelligence/DealerClosingHub.tsx"
Remove-Item "dealer/intelligence/DealerCRMIntelligence.tsx"
Remove-Item "dealer/intelligence/DealerForecastHub.tsx"
Remove-Item "dealer/intelligence/DealerRiskHub.tsx"
Remove-Item "dealer/intelligence/DealerMotorsDashboard.tsx"

# --- Dealer Test Inventory Files ---
Remove-Item "dealer/ultraInventory.ts"
Remove-Item "dealer/advancedDealerInventory.ts"
Remove-Item "dealer/dummyVehicles.ts"
Remove-Item "dealer/seed.ts"

# --- Duplicate Intelligence API ---
Remove-Item "features/intelligence/intelligenceV3.ts"
Remove-Item "src/routes/intelligenceV3.ts"

# --- Duplicate MOT AI Engine ---
Remove-Item "features/vehicles/ai/motAiEngine.ts"

# --- Duplicate Supernova Models ---
Remove-Item "features/vehicles/models/SupernovaEngine.ts"
Remove-Item "features/vehicles/models/SupernovaScore.ts"
