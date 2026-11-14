import "dotenv/config";
import type { RowDataPacket } from "mysql2";
import { executeAcademic, queryAcademic } from "../db/pools.js";

async function main() {
  // 1. Get staff role id
  const staffRoleRows = await queryAcademic<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM ap_roles WHERE role_key = 'staff' LIMIT 1`
  );
  const staffRoleId = staffRoleRows[0]?.id;
  if (!staffRoleId) {
    throw new Error("Staff role not found in ap_roles");
  }

  // 2. Find all users who have the staff role AND at least one other non-staff role
  const duplicateUsers = await queryAcademic<(RowDataPacket & {
    user_id: number;
    name: string;
    username: string;
    hrms_employee_id: string | null;
    non_staff_roles: string;
  })[]>(
    `
    SELECT
      u.id AS user_id,
      u.name,
      u.username,
      u.hrms_employee_id,
      GROUP_CONCAT(DISTINCT r.role_key ORDER BY r.role_key SEPARATOR ', ') AS non_staff_roles
    FROM ap_users u
    INNER JOIN ap_user_roles ur ON ur.user_id = u.id
    INNER JOIN ap_roles r ON r.id = ur.role_id
    WHERE ur.role_id != ?
      AND u.id IN (
        SELECT user_id FROM ap_user_roles WHERE role_id = ?
      )
    GROUP BY u.id, u.name, u.username, u.hrms_employee_id
    `,
    [staffRoleId, staffRoleId]
  );

  console.log(`Found ${duplicateUsers.length} users with both staff and leadership/other roles:`);
  for (const user of duplicateUsers) {
    console.log(`- User #${user.user_id} (${user.name}): Primary role(s): [${user.non_staff_roles}] -> Removing secondary 'staff' role`);
  }

  if (duplicateUsers.length > 0) {
    const userIds = duplicateUsers.map((u) => u.user_id);
    const placeholders = userIds.map(() => "?").join(",");
    const result = await executeAcademic(
      `DELETE FROM ap_user_roles WHERE role_id = ? AND user_id IN (${placeholders})`,
      [staffRoleId, ...userIds]
    );
    console.log(`Successfully removed ${result.affectedRows} extraneous 'staff' role assignment(s).`);
  }

  // Verify Penkey Teja specifically
  const tejaRoles = await queryAcademic<(RowDataPacket & { role_key: string; label: string; college_id: number | null; branch_id: number | null })[]>(
    `
    SELECT r.role_key, r.label, ur.college_id, ur.branch_id
    FROM ap_user_roles ur
    INNER JOIN ap_roles r ON r.id = ur.role_id
    INNER JOIN ap_users u ON u.id = ur.user_id
    WHERE u.hrms_employee_id = '2145' OR u.name LIKE '%PENKEY TEJA%'
    `
  );
  console.log("\nPenkey Teja remaining roles in DB:", tejaRoles);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
