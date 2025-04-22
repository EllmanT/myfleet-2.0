const mongoose = require("mongoose");
const OverallStats = require("../model/overallStats"); // Update with the correct path
const Job = require("../model/job"); // Update with the correct path
const Contractor = require("../model/contractor"); // Update with the correct path
const VehicleStats = require("../model/vehicleStats"); // Update with the correct path
const DriverStats = require("../model/driverStats"); // Update with the correct path
const ContractorStats = require("../model/contractorStats"); // Update with the correct path
const Deliverer = require("../model/deliverer"); // Update with the correct path
const Vehicle = require("../model/vehicle"); // Update with the correct path
const Driver = require("../model/driver"); // Update with the correct path
const Customer = require("../model/customer"); // Update with the correct path

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/myfleet-test2", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Function to populate OverallStats
const populateOverallStatsFromJobs = async (companyId) => {
  try {
      const currentYear = new Date().getFullYear();
      console.log(companyId + ": " + currentYear)
    
    // Fetch all jobs for the current year
    const jobs = await Job.find({
      orderDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    });

    console.log(jobs)
    // Initialize aggregation variables
    let yearlyJobs = 0;
    let yearlyMileage = 0;
    let yearlyRevenue = 0;
    let yearlyExpenses = 0;
    const monthlyData = {};
    const dailyData = {};
    const revenueByContractor = new Map();
    const jobsByContractor = new Map();

    // Aggregate data
    jobs.forEach((job) => {
      yearlyJobs++;
      yearlyMileage += job.distance || 0;
      yearlyRevenue += parseFloat(job.cost?.toString() || "0");
      yearlyExpenses += 0; // Adjust if there is a field for expenses in `Job`

      const orderDate = new Date(job.orderDate);
      const month = orderDate.toLocaleString("default", { month: "long" });
      const day = orderDate.toISOString().split("T")[0]; // This will give the date in YYYY-MM-DD format
      

      // Monthly aggregation
      if (!monthlyData[month]) {
        monthlyData[month] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalExpenses: 0,
          totalJobs: 0,
        };
      }
      monthlyData[month].totalMileage += job.distance || 0;
      monthlyData[month].totalRevenue += parseFloat(job.cost?.toString() || "0");
      monthlyData[month].totalProfit += parseFloat(job.cost?.toString() || "0");
        parseFloat(job.cost?.toString() || "0") - 0; // Adjust if there is an expenses field
      monthlyData[month].totalJobs++;

      // Round to 2 decimal places
monthlyData[month].totalRevenue = parseFloat(monthlyData[month].totalRevenue.toFixed(2));
monthlyData[month].totalProfit = parseFloat(monthlyData[month].totalProfit.toFixed(2));
      // Daily aggregation
      if (!dailyData[day]) {
        dailyData[day] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalJobs: 0,
        };
      }
      dailyData[day].totalMileage += job.distance || 0;
      dailyData[day].totalRevenue += parseFloat(job.cost?.toString() || "0");
      dailyData[day].totalJobs++;
      // Round to 2 decimal places
dailyData[day].totalRevenue = parseFloat(dailyData[day].totalRevenue.toFixed(2));


      // Contractor-specific aggregation
      if (job.contractorId) {
  
        if (!jobsByContractor.has(job.contractorId.toString())) {
          jobsByContractor.set(job.contractorId.toString(), 0);
          revenueByContractor.set(job.contractorId.toString(), 0);
        }
        jobsByContractor.set(
          job.contractorId.toString(),
          jobsByContractor.get(job.contractorId.toString()) + 1
        );
        revenueByContractor.set(
          job.contractorId.toString(),
          parseFloat(revenueByContractor.get(job.contractorId.toString()) || "0") +
            parseFloat(job.cost?.toString() || "0")
        );
      }
    });

    // Format the dailyData dates
    const formattedDailyData = Object.keys(dailyData).map((date) => ({
      date: date, // Keep date in YYYY-MM-DD format
      ...dailyData[date],
    }));

    // Sort the dailyData by date in ascending order
    formattedDailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Format the monthlyData months
    const formattedMonthlyData = Object.keys(monthlyData).map((month) => ({
      month: month, // Month name only (e.g., "January", "March")
      ...monthlyData[month],
    }));

    // Sort the monthlyData by month in ascending order
    const monthOrder = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    formattedMonthlyData.sort((a, b) => {
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    const numberOfCustomers = await Customer.countDocuments();
    console.log(numberOfCustomers + " customer")
    // Prepare OverallStats document
    const overallStatsData = {
      yearlyJobs,
      yearlyMileage,
      yearlyRevenue: parseFloat(yearlyRevenue.toFixed(2)), // Ensure revenue is to 2 decimal places
      yearlyExpenses: parseFloat(yearlyExpenses.toFixed(2)), // Ensure expenses are to 2 decimal places
      yearlyProfit: parseFloat((yearlyRevenue - yearlyExpenses).toFixed(2)), // Ensure profit is to 2 decimal places
      year: currentYear,
      monthlyData: formattedMonthlyData,
      dailyData: formattedDailyData,
      totalCustomers: numberOfCustomers, // Add logic if customer count is required
      totalContractors: jobsByContractor.size,
      revenueByContractor: Object.fromEntries(
        Array.from(revenueByContractor.entries()).map(([key, value]) => [key, parseFloat(value.toFixed(2))]) // Ensure revenue by contractor is to 2 decimal places
      ),
      jobsByContractor: Object.fromEntries(jobsByContractor.entries()),
      companyId,
    };

    
    // Step 1: Fetch all contractors from the database
const contractors = await Contractor.find(); // Assuming a simple find for all contractors

// Step 2: Create the contractorMap from the contractors array
const contractorMap = new Map(
  contractors
    .filter(contractor => jobsByContractor.has(contractor.id)) // Only include contractors in jobsByContractor
    .map(contractor => [contractor.id, contractor.companyName]) // Map contractor ID to company name
);

// Step 3: Replace contractor IDs with company names in `jobsByContractor`
const jobsWithNames = Object.fromEntries(
  Array.from(jobsByContractor.entries()).map(([contractorId, value]) => [
    contractorMap.get(contractorId) || "Unknown", // Replace ID with company name, default to "Unknown"
    
      value,
      // revenue: parseFloat(value.revenue.toFixed(2)), // Ensure revenue is to 2 decimal places
    
  ])
);
const revenueWithNames = Object.fromEntries(
  Array.from(revenueByContractor.entries()).map(([contractorId, value]) => [
    contractorMap.get(contractorId) || "Unknown", // Replace ID with company name, default to "Unknown"
    
      parseFloat(value.toFixed(2)), // Ensure revenue is to 2 decimal places
      // revenue: parseFloat(value.revenue.toFixed(2)), // Ensure revenue is to 2 decimal places
    
  ])
);

// Step 4: Update the `jobsByContractor` in overallStatsData with the updated `jobsWithNames`

// Log the result to see the updated `jobsByContractor`
  // Step 5: Create a new object with the modified jobsByContractor (with company names)
  const updatedOverallStatsData = {
    ...overallStatsData,
    jobsByContractor: jobsWithNames, // Replace jobsByContractor with the updated one
    revenueByContractor: revenueWithNames, // Replace revenueByContractor with the updated one
  };

    // Insert or Update OverallStats in the database
    const result = await OverallStats.findOneAndUpdate(
      { companyId, year: currentYear },
      updatedOverallStatsData,
      { upsert: true, new: true }
    );

    // console.log("OverallStats populated successfully:", result);
  } catch (err) {
    console.error("Error populating OverallStats:", err);
  } finally {
    mongoose.disconnect();
  }
};
const populateVehicleStatsFromJobs = async (vehicleId) => {
  try {
    const currentYear = new Date().getFullYear();
    console.log(vehicleId + ": " + currentYear)
        // Check if the vehicleId is valid
        if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
          console.error("Invalid vehicleId");
          return;
        }
  // Convert vehicleId string to mongoose ObjectId
  const objectId = new mongoose.Types.ObjectId(vehicleId);
  console.log(objectId)
    // Fetch all jobs for the current year
    const jobs = await Job.find({
      vehicleId:objectId,
      orderDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    });

   
    
    console.log("here now")
    console.log(jobs)
    // Initialize aggregation variables
    let yearlyJobs = 0;
    let yearlyMileage = 0;
    let yearlyRevenue = 0;
    let yearlyExpenses = 0;
    const monthlyData = {};
    const dailyData = {};
    const revenueByContractor = new Map();
    const jobsByContractor = new Map();

    // Aggregate data
    jobs.forEach((job) => {
      yearlyJobs++;
      yearlyMileage += job.distance || 0;
      yearlyRevenue += parseFloat(job.cost?.toString() || "0");
      yearlyExpenses += 0; // Adjust if there is a field for expenses in `Job`

      const orderDate = new Date(job.orderDate);
      const month = orderDate.toLocaleString("default", { month: "long" });
      const day = orderDate.toISOString().split("T")[0]; // This will give the date in YYYY-MM-DD format
      

      // Monthly aggregation
      if (!monthlyData[month]) {
        monthlyData[month] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalExpenses: 0,
          totalJobs: 0,
        };
      }
      monthlyData[month].totalMileage += job.distance || 0;
      monthlyData[month].totalRevenue += parseFloat(job.cost?.toString() || "0");
      monthlyData[month].totalProfit += parseFloat(job.cost?.toString() || "0");
        parseFloat(job.cost?.toString() || "0") - 0; // Adjust if there is an expenses field
      monthlyData[month].totalJobs++;

      // Round to 2 decimal places
monthlyData[month].totalRevenue = parseFloat(monthlyData[month].totalRevenue.toFixed(2));
monthlyData[month].totalProfit = parseFloat(monthlyData[month].totalProfit.toFixed(2));
      // Daily aggregation
      if (!dailyData[day]) {
        dailyData[day] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalJobs: 0,
        };
      }
      dailyData[day].totalMileage += job.distance || 0;
      dailyData[day].totalRevenue += parseFloat(job.cost?.toString() || "0");
      dailyData[day].totalJobs++;
      // Round to 2 decimal places
dailyData[day].totalRevenue = parseFloat(dailyData[day].totalRevenue.toFixed(2));


      // Contractor-specific aggregation
      if (job.contractorId) {
  
        if (!jobsByContractor.has(job.contractorId.toString())) {
          jobsByContractor.set(job.contractorId.toString(), 0);
          revenueByContractor.set(job.contractorId.toString(), 0);
        }
        jobsByContractor.set(
          job.contractorId.toString(),
          jobsByContractor.get(job.contractorId.toString()) + 1
        );
        revenueByContractor.set(
          job.contractorId.toString(),
          parseFloat(revenueByContractor.get(job.contractorId.toString()) || "0") +
            parseFloat(job.cost?.toString() || "0")
        );
      }
    });

    // Format the dailyData dates
    const formattedDailyData = Object.keys(dailyData).map((date) => ({
      date: date, // Keep date in YYYY-MM-DD format
      ...dailyData[date],
    }));

    // Sort the dailyData by date in ascending order
    formattedDailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Format the monthlyData months
    const formattedMonthlyData = Object.keys(monthlyData).map((month) => ({
      month: month, // Month name only (e.g., "January", "March")
      ...monthlyData[month],
    }));

    // Sort the monthlyData by month in ascending order
    const monthOrder = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    formattedMonthlyData.sort((a, b) => {
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    // Prepare OverallStats document
    const overallStatsData = {
      yearlyJobs,
      yearlyMileage,
      yearlyRevenue: parseFloat(yearlyRevenue.toFixed(2)), // Ensure revenue is to 2 decimal places
      yearlyExpenses: parseFloat(yearlyExpenses.toFixed(2)), // Ensure expenses are to 2 decimal places
      yearlyProfit: parseFloat((yearlyRevenue - yearlyExpenses).toFixed(2)), // Ensure profit is to 2 decimal places
      year: currentYear,
      monthlyData: formattedMonthlyData,
      dailyData: formattedDailyData,
      totalCustomers: 0, // Add logic if customer count is required
      totalContractors: jobsByContractor.size,
      revenueByContractor: Object.fromEntries(
        Array.from(revenueByContractor.entries()).map(([key, value]) => [key, parseFloat(value.toFixed(2))]) // Ensure revenue by contractor is to 2 decimal places
      ),
      jobsByContractor: Object.fromEntries(jobsByContractor.entries()),
      vehicleId,
    };

    
    console.log(jobsByContractor)
    // Step 1: Fetch all contractors from the database
const contractors = await Contractor.find(); // Assuming a simple find for all contractors

// Step 2: Create the contractorMap from the contractors array
const contractorMap = new Map(
  contractors
    .filter(contractor => jobsByContractor.has(contractor.id)) // Only include contractors in jobsByContractor
    .map(contractor => [contractor.id, contractor.companyName]) // Map contractor ID to company name
);

// Step 3: Replace contractor IDs with company names in `jobsByContractor`
const jobsWithNames = Object.fromEntries(
  Array.from(jobsByContractor.entries()).map(([contractorId, value]) => [
    contractorMap.get(contractorId) || "Unknown", // Replace ID with company name, default to "Unknown"
    
      value,
      // revenue: parseFloat(value.revenue.toFixed(2)), // Ensure revenue is to 2 decimal places
    
  ])
);
const revenueWithNames = Object.fromEntries(
  Array.from(revenueByContractor.entries()).map(([contractorId, value]) => [
    contractorMap.get(contractorId) || "Unknown", // Replace ID with company name, default to "Unknown"
    
      parseFloat(value.toFixed(2)), // Ensure revenue is to 2 decimal places
      // revenue: parseFloat(value.revenue.toFixed(2)), // Ensure revenue is to 2 decimal places
    
  ])
);

// Step 4: Update the `jobsByContractor` in overallStatsData with the updated `jobsWithNames`

// Log the result to see the updated `jobsByContractor`
  // Step 5: Create a new object with the modified jobsByContractor (with company names)
  const updatedOverallStatsData = {
    ...overallStatsData,
    jobsByContractor: jobsWithNames, // Replace jobsByContractor with the updated one
    revenueByContractor: revenueWithNames, // Replace revenueByContractor with the updated one
  };

    // Insert or Update OverallStats in the database
    const result = await VehicleStats.findOneAndUpdate(
      { vehicleId:vehicleId, year: currentYear },
      updatedOverallStatsData,
      { upsert: true, new: true }
    );

    // console.log("OverallStats populated successfully:", result);
  } catch (err) {
    console.error("Error populating OverallStats:", err);
  } finally {
    mongoose.disconnect();
  }
};
const populateDriverStatsFromJobs = async (driverId) => {
  try {
    const currentYear = new Date().getFullYear();
    console.log(driverId + ": " + currentYear)
        // Check if the driverId is valid
        if (!mongoose.Types.ObjectId.isValid(driverId)) {
          console.error("Invalid driverId");
          return;
        }
  // Convert driverId string to mongoose ObjectId
  const objectId = new mongoose.Types.ObjectId(driverId);
  console.log(objectId)
    // Fetch all jobs for the current year
    const jobs = await Job.find({
      driverId:objectId,
      orderDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    });

   
    
    console.log("here now")
    console.log(jobs)
    // Initialize aggregation variables
    let yearlyJobs = 0;
    let yearlyMileage = 0;
    let yearlyRevenue = 0;
    let yearlyExpenses = 0;
    const monthlyData = {};
    const dailyData = {};
    const revenueByContractor = new Map();
    const jobsByContractor = new Map();

    // Aggregate data
    jobs.forEach((job) => {
      yearlyJobs++;
      yearlyMileage += job.distance || 0;
      yearlyRevenue += parseFloat(job.cost?.toString() || "0");
      yearlyExpenses += 0; // Adjust if there is a field for expenses in `Job`

      const orderDate = new Date(job.orderDate);
      const month = orderDate.toLocaleString("default", { month: "long" });
      const day = orderDate.toISOString().split("T")[0]; // This will give the date in YYYY-MM-DD format
      

      // Monthly aggregation
      if (!monthlyData[month]) {
        monthlyData[month] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalExpenses: 0,
          totalJobs: 0,
        };
      }
      monthlyData[month].totalMileage += job.distance || 0;
      monthlyData[month].totalRevenue += parseFloat(job.cost?.toString() || "0");
      monthlyData[month].totalProfit += parseFloat(job.cost?.toString() || "0");
        parseFloat(job.cost?.toString() || "0") - 0; // Adjust if there is an expenses field
      monthlyData[month].totalJobs++;

      // Round to 2 decimal places
monthlyData[month].totalRevenue = parseFloat(monthlyData[month].totalRevenue.toFixed(2));
monthlyData[month].totalProfit = parseFloat(monthlyData[month].totalProfit.toFixed(2));
      // Daily aggregation
      if (!dailyData[day]) {
        dailyData[day] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalJobs: 0,
        };
      }
      dailyData[day].totalMileage += job.distance || 0;
      dailyData[day].totalRevenue += parseFloat(job.cost?.toString() || "0");
      dailyData[day].totalJobs++;
      // Round to 2 decimal places
dailyData[day].totalRevenue = parseFloat(dailyData[day].totalRevenue.toFixed(2));


      // Contractor-specific aggregation
      if (job.contractorId) {
  
        if (!jobsByContractor.has(job.contractorId.toString())) {
          jobsByContractor.set(job.contractorId.toString(), 0);
          revenueByContractor.set(job.contractorId.toString(), 0);
        }
        jobsByContractor.set(
          job.contractorId.toString(),
          jobsByContractor.get(job.contractorId.toString()) + 1
        );
        revenueByContractor.set(
          job.contractorId.toString(),
          parseFloat(revenueByContractor.get(job.contractorId.toString()) || "0") +
            parseFloat(job.cost?.toString() || "0")
        );
      }
    });

    // Format the dailyData dates
    const formattedDailyData = Object.keys(dailyData).map((date) => ({
      date: date, // Keep date in YYYY-MM-DD format
      ...dailyData[date],
    }));

    // Sort the dailyData by date in ascending order
    formattedDailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Format the monthlyData months
    const formattedMonthlyData = Object.keys(monthlyData).map((month) => ({
      month: month, // Month name only (e.g., "January", "March")
      ...monthlyData[month],
    }));

    // Sort the monthlyData by month in ascending order
    const monthOrder = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    formattedMonthlyData.sort((a, b) => {
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    // Prepare OverallStats document
    const overallStatsData = {
      yearlyJobs,
      yearlyMileage,
      yearlyRevenue: parseFloat(yearlyRevenue.toFixed(2)), // Ensure revenue is to 2 decimal places
      yearlyExpenses: parseFloat(yearlyExpenses.toFixed(2)), // Ensure expenses are to 2 decimal places
      yearlyProfit: parseFloat((yearlyRevenue - yearlyExpenses).toFixed(2)), // Ensure profit is to 2 decimal places
      year: currentYear,
      monthlyData: formattedMonthlyData,
      dailyData: formattedDailyData,
      totalCustomers: 0, // Add logic if customer count is required
      totalContractors: jobsByContractor.size,
      revenueByContractor: Object.fromEntries(
        Array.from(revenueByContractor.entries()).map(([key, value]) => [key, parseFloat(value.toFixed(2))]) // Ensure revenue by contractor is to 2 decimal places
      ),
      jobsByContractor: Object.fromEntries(jobsByContractor.entries()),
      driverId,
    };

    
    console.log(jobsByContractor)
    // Step 1: Fetch all contractors from the database
const contractors = await Contractor.find(); // Assuming a simple find for all contractors

// Step 2: Create the contractorMap from the contractors array
const contractorMap = new Map(
  contractors
    .filter(contractor => jobsByContractor.has(contractor.id)) // Only include contractors in jobsByContractor
    .map(contractor => [contractor.id, contractor.companyName]) // Map contractor ID to company name
);

// Step 3: Replace contractor IDs with company names in `jobsByContractor`
const jobsWithNames = Object.fromEntries(
  Array.from(jobsByContractor.entries()).map(([contractorId, value]) => [
    contractorMap.get(contractorId) || "Unknown", // Replace ID with company name, default to "Unknown"
    
      value,
      // revenue: parseFloat(value.revenue.toFixed(2)), // Ensure revenue is to 2 decimal places
    
  ])
);
const revenueWithNames = Object.fromEntries(
  Array.from(revenueByContractor.entries()).map(([contractorId, value]) => [
    contractorMap.get(contractorId) || "Unknown", // Replace ID with company name, default to "Unknown"
    
      parseFloat(value.toFixed(2)), // Ensure revenue is to 2 decimal places
      // revenue: parseFloat(value.revenue.toFixed(2)), // Ensure revenue is to 2 decimal places
    
  ])
);

// Step 4: Update the `jobsByContractor` in overallStatsData with the updated `jobsWithNames`

// Log the result to see the updated `jobsByContractor`
  // Step 5: Create a new object with the modified jobsByContractor (with company names)
  const updatedOverallStatsData = {
    ...overallStatsData,
    jobsByContractor: jobsWithNames, // Replace jobsByContractor with the updated one
    revenueByContractor: revenueWithNames, // Replace revenueByContractor with the updated one
  };

    // Insert or Update OverallStats in the database
    const result = await DriverStats.findOneAndUpdate(
      { driverId:driverId, year: currentYear },
      updatedOverallStatsData,
      { upsert: true, new: true }
    );

    // console.log("OverallStats populated successfully:", result);
  } catch (err) {
    console.error("Error populating OverallStats:", err);
  } finally {
    mongoose.disconnect();
  }
};
const populateContractorStatsFromJobs = async (contractorId,delivererId) => {
  try {
    const currentYear = new Date().getFullYear();
    console.log(contractorId + ": " + currentYear)
        // Check if the contractorId is valid
        if (!mongoose.Types.ObjectId.isValid(contractorId)) {
          console.error("Invalid contractorId");
          return;
        }
  // Convert contractorId string to mongoose ObjectId
  const objectId = new mongoose.Types.ObjectId(contractorId);
  console.log(objectId)
    // Fetch all jobs for the current year
    const jobs = await Job.find({
      contractorId:objectId,
      orderDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`),
      },
    });

   
    
    console.log("here now")
    console.log(jobs)
    // Initialize aggregation variables
    let yearlyJobs = 0;
    let yearlyMileage = 0;
    let yearlyRevenue = 0;
    let yearlyExpenses = 0;
    const monthlyData = {};
    const dailyData = {};
    const revenueByContractor = new Map();
    const jobsByContractor = new Map();

    // Aggregate data
    jobs.forEach((job) => {
      yearlyJobs++;
      yearlyMileage += job.distance || 0;
      yearlyRevenue += parseFloat(job.cost?.toString() || "0");
      yearlyExpenses += 0; // Adjust if there is a field for expenses in `Job`

      const orderDate = new Date(job.orderDate);
      const month = orderDate.toLocaleString("default", { month: "long" });
      const day = orderDate.toISOString().split("T")[0]; // This will give the date in YYYY-MM-DD format
      

      // Monthly aggregation
      if (!monthlyData[month]) {
        monthlyData[month] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalExpenses: 0,
          totalJobs: 0,
        };
      }
      monthlyData[month].totalMileage += job.distance || 0;
      monthlyData[month].totalRevenue += parseFloat(job.cost?.toString() || "0");
      monthlyData[month].totalProfit += parseFloat(job.cost?.toString() || "0");
        parseFloat(job.cost?.toString() || "0") - 0; // Adjust if there is an expenses field
      monthlyData[month].totalJobs++;

      // Round to 2 decimal places
monthlyData[month].totalRevenue = parseFloat(monthlyData[month].totalRevenue.toFixed(2));
monthlyData[month].totalProfit = parseFloat(monthlyData[month].totalProfit.toFixed(2));
      // Daily aggregation
      if (!dailyData[day]) {
        dailyData[day] = {
          totalMileage: 0,
          totalRevenue: 0,
          totalJobs: 0,
        };
      }
      dailyData[day].totalMileage += job.distance || 0;
      dailyData[day].totalRevenue += parseFloat(job.cost?.toString() || "0");
      dailyData[day].totalJobs++;
      // Round to 2 decimal places
dailyData[day].totalRevenue = parseFloat(dailyData[day].totalRevenue.toFixed(2));


      // Contractor-specific aggregation
      if (job.contractorId) {
  
        if (!jobsByContractor.has(job.contractorId.toString())) {
          jobsByContractor.set(job.contractorId.toString(), 0);
          revenueByContractor.set(job.contractorId.toString(), 0);
        }
        jobsByContractor.set(
          job.contractorId.toString(),
          jobsByContractor.get(job.contractorId.toString()) + 1
        );
        revenueByContractor.set(
          job.contractorId.toString(),
          parseFloat(revenueByContractor.get(job.contractorId.toString()) || "0") +
            parseFloat(job.cost?.toString() || "0")
        );
      }
    });

    // Format the dailyData dates
    const formattedDailyData = Object.keys(dailyData).map((date) => ({
      date: date, // Keep date in YYYY-MM-DD format
      ...dailyData[date],
    }));

    // Sort the dailyData by date in ascending order
    formattedDailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Format the monthlyData months
    const formattedMonthlyData = Object.keys(monthlyData).map((month) => ({
      month: month, // Month name only (e.g., "January", "March")
      ...monthlyData[month],
    }));

    // Sort the monthlyData by month in ascending order
    const monthOrder = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    
    formattedMonthlyData.sort((a, b) => {
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    // Prepare OverallStats document
    const overallStatsData = {
      yearlyJobs,
      yearlyMileage,
      yearlyRevenue: parseFloat(yearlyRevenue.toFixed(2)), // Ensure revenue is to 2 decimal places
      year: currentYear,
      monthlyData: formattedMonthlyData,
      dailyData: formattedDailyData,
      totalContractors: jobsByContractor.size,
      contractorId,
    };

    
 // Extract job IDs
 const jobIds = jobs.map(job => job._id);

console.log(jobIds)
    // Insert or Update OverallStats in the database
    const result = await ContractorStats.findOneAndUpdate(
      { contractorId:contractorId, delivererId:delivererId, year: currentYear },
      {
        $set: overallStatsData, // Set the other fields in `overallStatsData`
        $addToSet: { job_ids: { $each: jobIds } }, // Append jobIds ensuring no duplicates
      },
      { upsert: true, new: true }
    );

    // console.log("OverallStats populated successfully:", result);
  } catch (err) {
    console.error("Error populating OverallStats:", err);
  } finally {
    mongoose.disconnect();
  }
};

const updateDelivererStats = async (delivererId) => {
  const currentYear = new Date().getFullYear();

  try {
    // Fetch all jobs for the current contractorId
    const jobs = await Job.find({     
        orderDate: {
      $gte: new Date(`${currentYear}-01-01`),
      $lte: new Date(`${currentYear}-12-31`),
    },
});


const vehicles = await Vehicle.find({companyId: delivererId})
const customers = await Customer.find({})
const contractors = await Contractor.find({})
const drivers = await Driver.find({companyId:delivererId})
    // Extract job IDs
    const jobIds = jobs.map(job => job._id);
    const vehicleIds = vehicles.map(vehicle => vehicle._id)
    const customerIds = customers.map(customer => customer._id)
    const contractorIds = contractors.map(contractor => contractor._id)
    const driverIds = drivers.map(driver => driver._id)

    const contractorlength = contractorIds.length
    // Update the contractorStats by appending to the job_ids array
    const updatedStats = await Deliverer.findByIdAndUpdate(
      delivererId,
      {
        $set: {
           job_ids: jobIds,
          vehicle_ids: vehicleIds,
          contractor_ids: contractorIds,
          customer_ids: customerIds, 
          driver_ids: driverIds,

          }, // Ensures no duplicates are added

      },
      { new: true } // Returns the updated document
    );
console.log("updating done")
    // console.log("Updated Deliverer:", updatedStats);
  } catch (error) {
    console.error("Error updating ContractorStats:", error);
  }
};

const updateVehicleStats = async (vehicleId) => {
  const currentYear = new Date().getFullYear();

  try {
    // Fetch all jobs for the current contractorId
    const jobs = await Job.find({ 
      vehicleId, 
    //     orderDate: {
    //   $gte: new Date(`${currentYear}-01-01`),
    //   $lte: new Date(`${currentYear}-12-31`),
    // },
});



    // Extract job IDs
    const jobIds = jobs.map(job => job._id);
   
    // Update the contractorStats by appending to the job_ids array
    const updatedStats = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        $set: {
           job_ids: jobIds,
        

          }, // Ensures no duplicates are added

      },
      { new: true } // Returns the updated document
    );
console.log("updating done")
    // console.log("Updated Deliverer:", updatedStats);
  } catch (error) {
    console.error("Error updating ContractorStats:", error);
  }
};

const updateDriverStats = async (driverId) => {
  const currentYear = new Date().getFullYear();

  try {
    // Fetch all jobs for the current contractorId
    const jobs = await Job.find({ 
      driverId, 
    //     orderDate: {
    //   $gte: new Date(`${currentYear}-01-01`),
    //   $lte: new Date(`${currentYear}-12-31`),
    // },
});



    // Extract job IDs
    const jobIds = jobs.map(job => job._id);
   
    // Update the contractorStats by appending to the job_ids array
    const updatedStats = await Driver.findByIdAndUpdate(
      driverId,
      {
        $set: {
           job_ids: jobIds,
        

          }, // Ensures no duplicates are added

      },
      { new: true } // Returns the updated document
    );
console.log("updating done")
    // console.log("Updated Deliverer:", updatedStats);
  } catch (error) {
    console.error("Error updating ContractorStats:", error);
  }
};

const updateContractorStats = async (contractorId) => {
  const currentYear = new Date().getFullYear();

  try {
    // Fetch all jobs for the current contractorId
    const jobs = await Job.find({ 
      contractorId, 
    //     orderDate: {
    //   $gte: new Date(`${currentYear}-01-01`),
    //   $lte: new Date(`${currentYear}-12-31`),
    // },
});



    // Extract job IDs
    const jobIds = jobs.map(job => job._id);
   
    // Update the contractorStats by appending to the job_ids array
    const updatedStats = await Contractor.findByIdAndUpdate(
      contractorId,
      {
        $set: {
           job_ids: jobIds,
        

          }, // Ensures no duplicates are added

      },
      { new: true } // Returns the updated document
    );
console.log("updating done")
    // console.log("Updated Deliverer:", updatedStats);
  } catch (error) {
    console.error("Error updating ContractorStats:", error);
  }
};




// Call the functions to update the overall stats
// populateOverallStatsFromJobs("654f669091e232eb07068b57"); // Replace with the actual company ID

// Updating the 4 vehicle stats
// populateVehicleStatsFromJobs("65aea656c461048f0f5b07cd");
// populateVehicleStatsFromJobs("65aea67fc461048f0f5b07d5");
// populateVehicleStatsFromJobs("65aea69cc461048f0f5b07dd");
// populateVehicleStatsFromJobs("65aea6bec461048f0f5b07e5"); 

// updating the 5 driver stats
// populateDriverStatsFromJobs("65aea916c461048f0f5b09f1");
// populateDriverStatsFromJobs("65aea966c461048f0f5b09f9");
// populateDriverStatsFromJobs("66a8a009882410a581ad3db3");
// populateDriverStatsFromJobs("66a8a031882410a581ad3dd3");
// populateDriverStatsFromJobs("67bae1f0e3df22e03fb8a871");

// updating the contractor stats
// populateContractorStatsFromJobs("6565950c8827f7f34b114a52","654f669091e232eb07068b57");
// populateContractorStatsFromJobs("6565958e8827f7f34b114a79","654f669091e232eb07068b57");
// populateContractorStatsFromJobs("656595d18827f7f34b114a89","654f669091e232eb07068b57");
// populateContractorStatsFromJobs("6634dc8a1f8a6fe66f1f44d5","654f669091e232eb07068b57");
// populateContractorStatsFromJobs("66a33f81b4e40575ba5ca026","654f669091e232eb07068b57");
// populateContractorStatsFromJobs("66ce04eb1719b164fe1380e6","654f669091e232eb07068b57");


// Updating the deliver table
// updateDelivererStats("654f669091e232eb07068b57");

// Update the contractor table
// updateContractorStats("6565950c8827f7f34b114a52");
// updateContractorStats("6565958e8827f7f34b114a79");
// updateContractorStats("656595d18827f7f34b114a89");
// updateContractorStats("6634dc8a1f8a6fe66f1f44d5");
// updateContractorStats("66a33f81b4e40575ba5ca026");
// updateContractorStats("66ce04eb1719b164fe1380e6");


// updating the vehicle table
// updateVehicleStats("65aea656c461048f0f5b07cd");
// updateVehicleStats("65aea67fc461048f0f5b07d5");
// updateVehicleStats("65aea69cc461048f0f5b07dd");
// updateVehicleStats("65aea6bec461048f0f5b07e5");

// updating the driver table
// updateDriverStats("65aea916c461048f0f5b09f1");
// updateDriverStats("65aea966c461048f0f5b09f9");
// updateDriverStats("66a8a009882410a581ad3db3");
// updateDriverStats("66a8a031882410a581ad3dd3");
// updateDriverStats("67bae1f0e3df22e03fb8a871");
