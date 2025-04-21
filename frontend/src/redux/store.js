import { configureStore } from "@reduxjs/toolkit";
import globalReducer from "../state/index";
import { userReducer } from "./reducers/user";
import { customerReducer } from "./reducers/customer";
import { contractorReducer } from "./reducers/contractor";
import { vehicleReducer } from "./reducers/vehicle";
import { delivererReducer } from "./reducers/deliverer";
import { driverReducer } from "./reducers/driver";
import { jobReducer } from "./reducers/job";
import { rateReducer } from "./reducers/rate";
import { overallStatsReducer } from "./reducers/overallStats";
import { expensesReducer } from "./reducers/expense";
import { vehicleStatsReducer } from "./reducers/vehicleStats";
import { driverStatsReducer } from "./reducers/driverStats";
import { contractorStatsReducer } from "./reducers/contractorStats";

const Store = configureStore({
  reducer: {
    global: globalReducer,
    user: userReducer,
    customers: customerReducer,
    contractors: contractorReducer,
    vehicles: vehicleReducer,
    deliverers: delivererReducer,
    drivers: driverReducer,
    jobs: jobReducer,
    rates: rateReducer,
    overallStats: overallStatsReducer,
    vehicleStats: vehicleStatsReducer,
    driverStats: driverStatsReducer,
    contractorStats: contractorStatsReducer,
    expenses: expensesReducer,
  },
});

export default Store;
