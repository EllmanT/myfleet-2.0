import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { themeSettings } from "theme";

//getting the deliverer routes
import {
  DelRegisterPage,
  DelLoginPage,
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


//the analytics pages
import { getAllCustomersDeliverer } from "redux/actions/customer";
import { getAllContractorsDeliverer } from "redux/actions/contractor";
import { getAllVehiclesCompany } from "redux/actions/vehicle";
import { getAllDriversCompany } from "redux/actions/driver";
import { getDelivererInfo } from "redux/actions/deliverer";
import { getRates } from "redux/actions/rate";

//the analytics pages

const App = () => {
//const dispatch= useDispatch();
  //making the necessary calls the db so that we get only the necessary info when we start the application.
  useEffect(() => {
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
        <ThemeProvider theme={theme}>
          <CssBaseline />

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
                  <DelProtectedRoutes>
                    <DelDashRevenueBreakdownPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/monthly/:companyId"
                element={
                  <DelProtectedRoutes>
                    <DelDashRevenueMonthlyPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/daily-data/:companyId"
                element={
                  <DelProtectedRoutes>
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
                  <DelProtectedRoutes>
                    <DelDashRevenueBreakdownPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/monthly/:companyId"
                element={
                  <DelProtectedRoutes>
                    <DelDashRevenueMonthlyPage />
                  </DelProtectedRoutes>
                }
              />
              <Route
                path="/revenue-analytics/daily-data/:companyId"
                element={
                  <DelProtectedRoutes>
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

            <Route path="/login" element={<DelLoginPage />} />
            <Route
              path="/activation/:activation_token"
              element={<ActivationPage />}
            />
          </Routes>
        </ThemeProvider>
        <ToasterProvider />
      </BrowserRouter>
    </div>
  );
};

export default App;
