import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// Providers
import { DealerAIProvider } from "./features/dealer-ai/DealerAIStateProvider";
import { VehicleHistoryProvider } from "./features/vehicles/context/VehicleHistoryContext";
import { DealerNotificationsProvider } from "./features/dealer-notifications/DealerNotificationsContext";

import { DealerContextProvider } from "./context/DealerContext";
import { InventoryProvider } from "./context/InventoryProvider";
import { IntelligenceProvider } from "./context/IntelligenceProvider";
import { LeadsProvider } from "./context/LeadsContext";
import { BookkeepingProvider } from "./bookkeeping/BookkeepingProvider";
import { StaffProvider } from "./staff/StaffContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <DealerNotificationsProvider>
          <DealerContextProvider>
            <InventoryProvider>
              <IntelligenceProvider>
                <LeadsProvider>
                  <DealerAIProvider>
                    <VehicleHistoryProvider>
                      <BookkeepingProvider>
                        <StaffProvider>
                          <App />
                        </StaffProvider>
                      </BookkeepingProvider>
                    </VehicleHistoryProvider>
                  </DealerAIProvider>
                </LeadsProvider>
              </IntelligenceProvider>
            </InventoryProvider>
          </DealerContextProvider>
        </DealerNotificationsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);