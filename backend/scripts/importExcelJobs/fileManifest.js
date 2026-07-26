const path = require("path");

// Root of the source data dropped in by the user.
const SOURCE_ROOT = path.resolve(__dirname, "..", "..", "..", "all jobs 2025 to 2026");

// Every vehicle we have jobs for, keyed by registration number (matches
// backend/model/vehicle.js `regNumber`).
const VEHICLES = {
  AEX7352: { make: "Iveco Eurocargo", size: "mediumVehicle" },
  AFE5848: { make: "DAF", size: "mediumVehicle" },
  AFO0724: { make: "Toyota Dyna", size: "smallVehicle" },
  AAV4331: { make: "Toyota Dyna", size: "smallVehicle" },
};

// Confirmed with the user: one fixed driver per vehicle for this whole
// historical import (no driver column exists anywhere in the source files).
const DRIVER_BY_VEHICLE = {
  AAV4331: "Chamu",
  AFO0724: "Chris",
  AFE5848: "Chris",
  AEX7352: "Chris",
};

// contractor.prefix -> contractor.companyName, confirmed against the live
// contractors collection.
const CONTRACTOR_PREFIXES = {
  LM: "Lammel",
  RK: "Romeo Kitchens",
  BH: "Besthule",
  UF: "Ufurn",
  CR: "Carador",
  MN: "Moxon",
};

// filename (relative to SOURCE_ROOT) -> vehicle regNumber. Every file was
// visually inspected (title row + filename + mileage range) during planning.
const FILE_VEHICLE_MAP = {
  "2025-jobs/DAF AFE APR 2025.xlsx": "AFE5848",
  "2025-jobs/DAF AFE AUGUST 2025.xlsx": "AFE5848",
  "2025-jobs/DAF AFE FEB 2025.xlsx": "AFE5848",
  "2025-jobs/daf afe july 2025.xlsx": "AFE5848",
  "2025-jobs/DAF AFE MAY 2025'.xlsx": "AFE5848",
  "2025-jobs/DAF AFE SEPTEMBER 2025.xlsx": "AFE5848",
  "2025-jobs/DAF MARCH 2025.xlsx": "AFE5848",
  "2025-jobs/dafafe june 2025.xlsx": "AFE5848",
  "2025-jobs/TOTA AAV MAY 2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AAV APRIL 2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AAV AUGUST2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AAV FEB 2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AAV JAN 2025.xlsx": "AAV4331",
  "2025-jobs/toyota aav July2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AAV MARCH 2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AAV SEPTEMBER 2025.xlsx": "AAV4331",
  "2025-jobs/toyta aav june 2025.xlsx": "AAV4331",
  "2025-jobs/TOYOTA AFO APRIL 2025.xlsx": "AFO0724",
  "2025-jobs/TOYOTA AFO AUGUST 2025.xlsx": "AFO0724",
  "2025-jobs/TOYOTA AFO FEB 2025.xlsx": "AFO0724",
  "2025-jobs/TOYOTA AFO JAN 2025.xlsx": "AFO0724",
  "2025-jobs/Toyota afo july 2025.xlsx": "AFO0724",
  "2025-jobs/TOYOTA AFO JUNE 2025.xlsx": "AFO0724",
  "2025-jobs/TOYOTA AFO MARCH 2025.xlsx": "AFO0724",
  "2025-jobs/TOYOTA AFO MAY 2025.xlsx": "AFO0724",
  "2025-jobs/Toyota afo September 2025.xlsx": "AFO0724",

  // Converted from the two source PDFs by convertIvecoPdfs.js.
  "2025-jobs/IVECO AEX JAN 2025.xlsx": "AEX7352",
  "2025-jobs/IVECO AEX FEB 2025.xlsx": "AEX7352",

  // Multi-vehicle aggregate: one sheet per vehicle, Oct-Dec 2025.
  "2025-jobs/Fleet_Jobs_Aggregated_Oct-Dec_2025.xlsx": {
    "DAF AFE": "AFE5848",
    "TOYOTA AFO": "AFO0724",
    "TOYOTA AAV": "AAV4331",
  },

  "2026-jobs/DAF AFE JAN 2026.xlsx": "AFE5848",
  "2026-jobs/Daf afe march 2026.xlsx": "AFE5848",
  "2026-jobs/Daf Feb 2026.xlsx": "AFE5848",
  "2026-jobs/DAF-AFE5848-2026-04-30-jobs (2).xlsx": "AFE5848",
  "2026-jobs/DAF-AFE5848-2026-06-02-jobs may .xlsx": "AFE5848",
  "2026-jobs/DAF-AFE5848-june-jobs (1).xlsx": "AFE5848",

  "2026-jobs/Toyota aav feb 2026.xlsx": "AAV4331",
  "2026-jobs/toyota aav jan 2026.xlsx": "AAV4331",
  "2026-jobs/toyota_aav_march_2026 (1).xlsx": "AAV4331",
  "2026-jobs/Toyota-Dyna-AAV4331-2026-04-30-jobs (2).xlsx": "AAV4331",
  "2026-jobs/Toyota-Dyna-AAV4331-2026-06-02-jobs (1) latest may.xlsx": "AAV4331",
  "2026-jobs/Toyota-Dyna-AAV4331-june-jobs (1).xlsx": "AAV4331",

  "2026-jobs/Toyota afo feb 2026.xlsx": "AFO0724",
  "2026-jobs/Toyota AFO Jan 2026.xlsx": "AFO0724",
  "2026-jobs/Toyota afo march 2026.xlsx": "AFO0724",
  "2026-jobs/Toyota-Dyna-AFO0724 April 2026 (2).xlsx": "AFO0724",
  "2026-jobs/Toyota-Dyna-AFO0724-2026-06-02-jobs  may .xlsx": "AFO0724",
  "2026-jobs/Toyota-Dyna-AFO0724-june-jobs (1).xlsx": "AFO0724",
};

module.exports = {
  SOURCE_ROOT,
  VEHICLES,
  DRIVER_BY_VEHICLE,
  CONTRACTOR_PREFIXES,
  FILE_VEHICLE_MAP,
};
