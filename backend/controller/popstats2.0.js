const mongoose = require("mongoose");
const OverallStats = require("../model/overallStats"); // Update with the correct path
const Job = require("../model/job"); // Update with the correct path

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/myfleet-test", {
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
      monthlyData[month].totalProfit += parseFloat(job.cost?.toString() || "0") - 0; // Adjust if there is an expenses field
      monthlyData[month].totalJobs++;

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

      // Contractor aggregation
      const contractorId = job.contractorId; // Assuming the contractor ID is stored in the job
      if (contractorId) {
        // Aggregate jobs by contractor
        jobsByContractor.set(contractorId, (jobsByContractor.get(contractorId) || 0) + 1);

        // Aggregate revenue by contractor
        revenueByContractor.set(
          contractorId,
          (revenueByContractor.get(contractorId) || 0) + parseFloat(job.cost?.toString() || "0")
        );
      }
    });

    // Format the dailyData dates and ensure values are to 2 decimal places
    const formattedDailyData = Object.keys(dailyData).map((date) => ({
      date: new Date(date).toDateString(), // Convert to date string in the required format
      totalMileage: parseFloat(dailyData[date].totalMileage.toFixed(2)), // Ensure mileage is to 2 decimal places
      totalRevenue: parseFloat(dailyData[date].totalRevenue.toFixed(2)), // Ensure revenue is to 2 decimal places
      totalJobs: dailyData[date].totalJobs, // Keep jobs as is
    }));

    // Sort the dailyData by date in ascending order
    formattedDailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Format the monthlyData months and ensure values are to 2 decimal places
    const formattedMonthlyData = Object.keys(monthlyData).map((month) => ({
      month: new Date(`${currentYear}-${new Date(Date.parse(month + " 1, 2024")).getMonth() + 1}-01`)
        .toLocaleString("default", { month: "long" }), // Only show month name
      totalMileage: parseFloat(monthlyData[month].totalMileage.toFixed(2)), // Ensure mileage is to 2 decimal places
      totalRevenue: parseFloat(monthlyData[month].totalRevenue.toFixed(2)), // Ensure revenue is to 2 decimal places
      totalProfit: parseFloat(monthlyData[month].totalProfit.toFixed(2)), // Ensure profit is to 2 decimal places
      totalExpenses: parseFloat(monthlyData[month].totalExpenses.toFixed(2)), // Ensure expenses are to 2 decimal places
      totalJobs: monthlyData[month].totalJobs, // Keep jobs as is
    }));

    // Sort the monthlyData by month in ascending order
    formattedMonthlyData.sort((a, b) => {
      return new Date(`${currentYear}-${new Date(Date.parse(a.month + " 1, 2024")).getMonth() + 1}-01`) -
        new Date(`${currentYear}-${new Date(Date.parse(b.month + " 1, 2024")).getMonth() + 1}-01`);
    });

    // Prepare OverallStats document
    const overallStatsData = {
      yearlyJobs,
      yearlyMileage: parseFloat(yearlyMileage.toFixed(2)), // Ensure yearly mileage is to 2 decimal places
      yearlyRevenue: parseFloat(yearlyRevenue.toFixed(2)), // Ensure yearly revenue is to 2 decimal places
      yearlyExpenses: parseFloat(yearlyExpenses.toFixed(2)), // Ensure yearly expenses is to 2 decimal places
      yearlyProfit: parseFloat((yearlyRevenue - yearlyExpenses).toFixed(2)), // Ensure yearly profit is to 2 decimal places
      year: currentYear,
      monthlyData: formattedMonthlyData,
      dailyData: formattedDailyData,
      totalCustomers: 0, // Add logic if customer count is required
      totalContractors: jobsByContractor.size, // Calculate the total number of contractors
      revenueByContractor: Object.fromEntries(
        Array.from(revenueByContractor.entries()).map(([key, value]) => [key, parseFloat(value.toFixed(2))]) // Ensure revenue by contractor is to 2 decimal places
      ),
      jobsByContractor: Object.fromEntries(jobsByContractor.entries()), // Ensure jobs by contractor is correct
      companyId,
    };

    // Insert or Update OverallStats in the database
    const result = await OverallStats.findOneAndUpdate(
      { companyId, year: currentYear },
      overallStatsData,
      { upsert: true, new: true }
    );

    console.log("OverallStats populated successfully:", result);
  } catch (err) {
    console.error("Error populating OverallStats:", err);
  } finally {
    mongoose.disconnect();
  }
};

// Call the function
populateOverallStatsFromJobs("6765690ff556b1211a8e7588"); // Replace with the actual company ID
