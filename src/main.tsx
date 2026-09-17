import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";

// Providers
import { VehicleHistoryProvider } from "./features/vehicles/context/VehicleHistoryContext";
import { DealerNotificationsProvider } from "./features/dealer-notifications/DealerNotificationsContext";

import { DealerContextProvider } from "./context/DealerContext";
import { InventoryProvider } from "./context/InventoryProvider";
import { IntelligenceProvider } from "./context/IntelligenceProvider";
import { LeadsProvider } from "./context/LeadsContext";
import { BookkeepingProvider } from "./bookkeeping/BookkeepingProvider";
import { StaffProvider } from "./staff/StaffContext";
import { JobsProvider } from "./context/JobsContext";
import { TimeClockProvider } from "./context/TimeClockContext";
import { PlannerProvider } from "./context/PlannerContext";
import { FeedbackProvider } from "./context/FeedbackContext";
import { ConsumablesProvider } from "./context/ConsumablesContext";
import { AppointmentsProvider } from "./context/AppointmentsContext";
import { ContactsProvider } from "./context/ContactsContext";
import { DiaryProvider } from "./context/DiaryContext";

// Registers the pass-through service worker (public/sw.js) needed for
// the desktop "Install app" prompt — safe to call even where service
// workers aren't supported, and a failed registration (e.g. running
// over plain HTTP on a real domain) just leaves the app installable
// only where the browser already allows it.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DealerNotificationsProvider>
            <DealerContextProvider>
              <InventoryProvider>
                <IntelligenceProvider>
                  <LeadsProvider>
                    <VehicleHistoryProvider>
                      <BookkeepingProvider>
                        <StaffProvider>
                          <JobsProvider>
                            <TimeClockProvider>
                              <PlannerProvider>
                                <FeedbackProvider>
                                  <ConsumablesProvider>
                                    <AppointmentsProvider>
                                      <ContactsProvider>
                                        <DiaryProvider>
                                          <App />
                                        </DiaryProvider>
                                      </ContactsProvider>
                                    </AppointmentsProvider>
                                  </ConsumablesProvider>
                                </FeedbackProvider>
                              </PlannerProvider>
                            </TimeClockProvider>
                          </JobsProvider>
                        </StaffProvider>
                      </BookkeepingProvider>
                    </VehicleHistoryProvider>
                  </LeadsProvider>
                </IntelligenceProvider>
              </InventoryProvider>
            </DealerContextProvider>
          </DealerNotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);