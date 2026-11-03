import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { Suspense, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { themeSettings } from "theme";
import ClerkShell from "component/auth/ClerkShell";
import ModulesPage from "pages/deliverer/ModulesPage";
import TripsPage from "pages/deliverer/TripsPage";
import InvoicesPage from "pages/deliverer/InvoicesPage";
import MaintenancePage from "pages/deliverer/MaintenancePage";
import QuotationsPage from "pages/deliverer/QuotationsPage";
import TrailersPage from "pages/deliverer/TrailersPage";
import DocumentsPage from "pages/deliverer/DocumentsPage";
import { clerkEnabled } from "utils/clerk";
import {
  ClerkSignInPage,
  ClerkSignUpPage,
  CreateOrganizationPage,
} from "pages/ClerkAuthPages";

//getting the deliverer routes
import {
  DelLoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  DelDashboardPage,
  DelVehiclesPage,
  DelDriversPage,
  DelCustomersPage,
  DelAdminsPage,
  DelContractorsPage,
  DelPaymentsPage,
  DelAllOrdersPage,
  DelDashOrdersPage,
  DelDashDriverPage,
  DelDashVehiclePage,
  DelDashContractorPage,
  DelDashRevenuePage,
  DelExpensesPage,
  DelProfitabilityPage,
  DelFuelLogPage,
  DelDeliverersPage,
  ActivationPage,
  DelAddJobPage,
  DelDashJobsAnalyticsPage,
  DelDashVehicleAnalyticsPage,
  DelDashDriverAnalyticsPage,
  DelDashContrAnalyticsPage,
  DelDashDailyDataPage,
  DelDashVehicleDailyDataPage,
  DelDashContrDailyDataPage,
  DelDashDriverDailyDataPage,
  DelDashRevenueBreakdownPage,
  DelDashRevenueMonthlyPage,
  DelDashRevenueDailyDataPage,
  DelDashReportsPage,
  DelDashContrReportsPage,
  DelDashDriverReportsPage,
  DelDashVehicleReportsPage,
 
} from "./route/delRoutes";

import ToasterProvider from "providers/ToastProvider";
import Store from "redux/store";
import { loadUser } from "redux/actions/user";

//getting the layouts
import DelLayout from "component/deliverer/DelLayout";
import DelProtectedRoutes from "route/delProtectedRoutes";
import { getRates } from "redux/actions/rate";

const App = () => {
//const dispatch= useDispatch();
  //making the necessary calls the db so that we get only the necessary info when we start the application.
  useEffect(() => {
    // With Clerk on, ClerkBridge loads the user once the session token is ready.
    if (clerkEnabled) return;
    Store.dispatch(loadUser());
  //  Store.dispatch(getDelivererInfo());
    //Store.dispatch(getAllCustomersDeliverer());
   // Store.dispatch(getAllContractorsDeliverer());
   // Store.dispatch(getAllVehiclesCompany());
    //Store.dispatch(getAllDriversCompany());
    Store.dispatch(getRates());
  }, []);

  const mode = useSelector((state) => state.global.mode);
  const theme = useMemo(() => createTheme(themeSettings(mode)), [mode]);

  return (
    <div className="App">
      <BrowserRouter>
        <ClerkShell>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          <Suspense fallback={null}>
          <Routes>
            <Route element={<DelLayout />}>
              <Route
                path="/"
                element={<Navigate to="/del-dashboard" replace />}
              />
              <Route
                path="/del-vehicles"
                element={
                  <DelProtectedRoutes>
                    <DelVehiclesPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-drivers"
                element={
                  <DelProtectedRoutes>
                    <DelDriversPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-payments"
                element={
                  <DelProtectedRoutes>
                    <DelPaymentsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-admins"
                element={
                    <DelAdminsPage />
                }
              />
              <Route
                path="/del-contractors"
                element={
                  <DelProtectedRoutes>
                    <DelContractorsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-deliverers"
                element={
                    <DelDeliverersPage />
                }
              />
              <Route
                path="/del-customers"
                element={
                  <DelProtectedRoutes>
                    <DelCustomersPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-dash-orders"
                element={
                  <DelProtectedRoutes>
                    <DelDashOrdersPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-dash-revenue"
                element={
                  <DelProtectedRoutes>
                    <DelDashRevenuePage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-trips"
                element={
                  <DelProtectedRoutes module="crossBorder">
                    <TripsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-trailers"
                element={
                  <DelProtectedRoutes module="tractorUnits">
                    <TrailersPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-documents"
                element={
                  <DelProtectedRoutes module="tractorUnits">
                    <DocumentsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-maintenance"
                element={
                  <DelProtectedRoutes module="maintenance">
                    <MaintenancePage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-invoices"
                element={
                  <DelProtectedRoutes module="invoices">
                    <InvoicesPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-quotations"
                element={
                  <DelProtectedRoutes module="quotations">
                    <QuotationsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-modules"
                element={
                  <DelProtectedRoutes>
                    <ModulesPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-expenses"
                element={
                  <DelProtectedRoutes module="expenses">
                    <DelExpensesPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-fuel-log"
                element={
                  <DelProtectedRoutes module="fuel">
                    <DelFuelLogPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-profitability"
                element={
                  <DelProtectedRoutes module="expenses">
                    <DelProfitabilityPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-all-orders"
                element={
                  <DelProtectedRoutes>
                    <DelAllOrdersPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-dash-driver/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-dash-vehicle/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehiclePage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-dash-contractor/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContractorPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/add-order"
                element={
                  <DelProtectedRoutes>
                    <DelAddJobPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/add-job"
                element={
                  <DelProtectedRoutes>
                    <DelAddJobPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/del-dashboard"
                element={
                  <DelProtectedRoutes>
                    <DelDashboardPage />
                  </DelProtectedRoutes>
                }
              />

              {/**Analytics routes */}

              <Route
                path="/job-analytics/:companyId"
                element={
                  <DelProtectedRoutes>
                    <DelDashJobsAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/job-analytics/daily-data/:companyId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/vehicle-analytics/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehicleAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/vehicle-analytics/daily-data/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehicleDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/driver-analytics/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/driver-analytics/daily-data/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/contractor-analytics/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContrAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/contractor-analytics/daily-data/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContrDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/breakdown/:companyId"
                element={
                  <DelProtectedRoutes module="analytics">
                    <DelDashRevenueBreakdownPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/monthly/:companyId"
                element={
                  <DelProtectedRoutes module="analytics">
                    <DelDashRevenueMonthlyPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/daily-data/:companyId"
                element={
                  <DelProtectedRoutes module="analytics">
                    <DelDashRevenueDailyDataPage />
                  </DelProtectedRoutes>
                }
              />

              <Route
                path="/reports"
                element={
                  <DelProtectedRoutes>
                    <DelDashReportsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/reports-contractor/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContrReportsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/reports-driver/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverReportsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/reports-vehicle/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehicleReportsPage />
                  </DelProtectedRoutes>
                }
              />

              {/**Analytics routes */}

              <Route
                path="/job-analytics/:companyId"
                element={
                  <DelProtectedRoutes>
                    <DelDashJobsAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/job-analytics/daily-data/:companyId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/vehicle-analytics/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehicleAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/vehicle-analytics/daily-data/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehicleDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/driver-analytics/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/driver-analytics/daily-data/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/contractor-analytics/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContrAnalyticsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/contractor-analytics/daily-data/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContrDailyDataPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/breakdown/:companyId"
                element={
                  <DelProtectedRoutes module="analytics">
                    <DelDashRevenueBreakdownPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/monthly/:companyId"
                element={
                  <DelProtectedRoutes module="analytics">
                    <DelDashRevenueMonthlyPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/daily-data/:companyId"
                element={
                  <DelProtectedRoutes module="analytics">
                    <DelDashRevenueDailyDataPage />
                  </DelProtectedRoutes>
                }
              />

              <Route
                path="/reports"
                element={
                  <DelProtectedRoutes>
                    <DelDashReportsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/reports-contractor/:contractorId"
                element={
                  <DelProtectedRoutes>
                    <DelDashContrReportsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/reports-driver/:driverId"
                element={
                  <DelProtectedRoutes>
                    <DelDashDriverReportsPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/reports-vehicle/:vehicleId"
                element={
                  <DelProtectedRoutes>
                    <DelDashVehicleReportsPage />
                  </DelProtectedRoutes>
                }
              />
            </Route>

            {clerkEnabled ? (
              <>
                <Route path="/login/*" element={<ClerkSignInPage />} />
                <Route path="/sign-up/*" element={<ClerkSignUpPage />} />
                <Route path="/create-organization" element={<CreateOrganizationPage />} />
              </>
            ) : (
              <Route path="/login" element={<DelLoginPage />} />
            )}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/activation/:activation_token"
              element={<ActivationPage />}
            />
          </Routes>
          </Suspense>
        </ThemeProvider>
        <ToasterProvider />
        </ClerkShell>
      </BrowserRouter>
    </div>
  );
};

export default App;
