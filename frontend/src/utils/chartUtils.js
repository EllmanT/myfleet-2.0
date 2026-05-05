const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function padMonthlyData(monthlyData = [], selectedYear) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const isCurrentYear = selectedYear === currentYear;

  const dataMap = {};
  monthlyData.forEach((item) => { dataMap[item.month] = item; });

  return MONTHS
    .filter((_, idx) => !isCurrentYear || idx <= currentMonth)
    .map((month) => dataMap[month] || {
      month,
      totalJobs: 0,
      totalMileage: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      totalProfit: 0,
    });
}
