import type { RowDataPacket } from "mysql2";
import { executeAcademic, queryAcademic, queryStudent } from "../db/pools.js";

export type AttendanceThresholds = {
  eligibleThreshold: number; // e.g. 75
  condonationMinThreshold: number; // e.g. 65
};

export const DEFAULT_ATTENDANCE_THRESHOLDS: AttendanceThresholds = {
  eligibleThreshold: 75,
  condonationMinThreshold: 65,
};

type ThresholdRow = RowDataPacket & {
  id: number;
  college_id: number | null;
  eligible_threshold: number;
  condonation_min_threshold: number;
  is_active: number;
};

let tableReady: Promise<void> | null = null;

async function ensureAttendanceThresholdsTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_attendance_thresholds (
          id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          college_id INT NULL,
          eligible_threshold DECIMAL(5,2) NOT NULL DEFAULT 75.00,
          condonation_min_threshold DECIMAL(5,2) NOT NULL DEFAULT 65.00,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_attendance_threshold_college (college_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }
  await tableReady;
}

export async function getAttendanceThresholdSettings(collegeId?: number | null) {
  await ensureAttendanceThresholdsTable();

  // Try college-specific first if provided
  let row: ThresholdRow | undefined;
  if (collegeId) {
    const collegeRows = await queryAcademic<ThresholdRow[]>(
      `SELECT * FROM ap_attendance_thresholds WHERE college_id = ? AND is_active = 1 LIMIT 1`,
      [collegeId],
    );
    row = collegeRows[0];
  }

  // Fallback to global setting (college_id IS NULL)
  if (!row) {
    const globalRows = await queryAcademic<ThresholdRow[]>(
      `SELECT * FROM ap_attendance_thresholds WHERE college_id IS NULL AND is_active = 1 LIMIT 1`,
    );
    row = globalRows[0];
  }

  const thresholds: AttendanceThresholds = row
    ? {
        eligibleThreshold: Number(row.eligible_threshold) || 75,
        condonationMinThreshold: Number(row.condonation_min_threshold) || 65,
      }
    : { ...DEFAULT_ATTENDANCE_THRESHOLDS };

  // Fetch list of colleges for overrides
  const collegesRows = await queryStudent<(RowDataPacket & { id: number; name: string })[]>(
    `SELECT id, name FROM colleges WHERE status = 1 ORDER BY name ASC`,
  ).catch(() => []);

  // Check which colleges have overrides
  const overrideRows = await queryAcademic<(RowDataPacket & { college_id: number })[]>(
    `SELECT college_id FROM ap_attendance_thresholds WHERE college_id IS NOT NULL AND is_active = 1`,
  );
  const overrideSet = new Set(overrideRows.map((r) => r.college_id));

  return {
    collegeId: collegeId ?? null,
    thresholds,
    usingDefaults: !row,
    colleges: collegesRows.map((c) => ({
      id: c.id,
      name: c.name,
      hasOverride: overrideSet.has(c.id),
    })),
    description: "Configures academic attendance eligibility thresholds (Eligible, Condonation, and Detained).",
  };
}

export async function saveAttendanceThresholdSettings(params: {
  collegeId?: number | null;
  eligibleThreshold: number;
  condonationMinThreshold: number;
}) {
  await ensureAttendanceThresholdsTable();

  const collegeId = params.collegeId ? Number(params.collegeId) : null;
  const eligible = Math.min(100, Math.max(1, Number(params.eligibleThreshold) || 75));
  const condonation = Math.min(eligible - 1, Math.max(1, Number(params.condonationMinThreshold) || 65));

  await executeAcademic(
    `
    INSERT INTO ap_attendance_thresholds (college_id, eligible_threshold, condonation_min_threshold, is_active)
    VALUES (?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      eligible_threshold = VALUES(eligible_threshold),
      condonation_min_threshold = VALUES(condonation_min_threshold),
      is_active = 1
    `,
    [collegeId, eligible, condonation],
  );

  return getAttendanceThresholdSettings(collegeId);
}

