import process from "node:process";
import "dotenv/config";
import { getHodDashboardData } from "../services/hod-dashboard.service.js";

async function test() {
  const mockAuthz = {
    userId: 1,
    roleKeys: ["hod"],
    roles: [{ roleKey: "hod", collegeId: 1, branchId: 17, isPrimary: true }],
    collegeId: 1,
    scope: { collegeIds: [1], branchIds: [17] },
  } as any;

  const data = await getHodDashboardData(mockAuthz, { branchId: 17, date: "2026-10-17" });
  console.log("PRIORITY ITEMS COUNT:", data.priorityItems.length);
  console.log("PRIORITY ITEMS:", JSON.stringify(data.priorityItems, null, 2));
}

test()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
