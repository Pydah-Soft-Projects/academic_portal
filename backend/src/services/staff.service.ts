import type { RowDataPacket } from "mysql2";
import { getHrmsDb, queryAcademic } from "../db/pools.js";
import {
  extractHrmsStaffProfile,
  HRMS_EMPLOYEE_PROJECTION,
  loadHrmsOrgLookups,
} from "./hrms-staff.service.js";
import {
  employeeMatchesFacultyGroupFilter,
  getFacultyGroupFilter,
} from "./portal-settings.service.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type StaffSlotDetail = {
  id?: number;
  timingSlotId?: number;
  slotLabel: string;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
  subjectCode: string | null;
  sectionName: string | null;
  status: string;
  isPosted: boolean;
  roomLabel?: string | null;
};

export type StaffAttendanceStatus = {
  status: "present" | "late" | "leave" | "od" | "permission" | "absent";
  displayStatus: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
  thumbStatus: "active" | "partial" | "full" | "none";
  punchCount: number;
  details: string | null;
  leaveType?: string | null;
  leaveReason?: string | null;
  odPlace?: string | null;
};

export type StaffOverviewItem = {
  hrmsEmployeeId: string;
  staffLinkId: number | null;
  name: string;
  code: string;
  division: string;
  department: string;
  designation: string;
  college: string;
  employeeGroup: string;
  isActive: boolean;
  linkStatus: "linked" | "unlinked";
  profilePhoto?: string | null;
  teachingSubjects: string[];
  todaySlotsCount: number;
  todayPostedSlotsCount: number;
  todayPendingSlotsCount: number;
  todaySlots: StaffSlotDetail[];
  todayAttendance: StaffAttendanceStatus;
};

export type StaffOverviewFilters = {
  date?: string;
  search?: string;
  department?: string;
  division?: string;
  designation?: string;
  status?: string;
  hasSlots?: "all" | "yes" | "no";
  collegeNames?: string[];
  page?: number;
  pageSize?: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatISTTime(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  return dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function dayCodeForDate(dateStr: string): string {
  const dateObj = new Date(dateStr + "T00:00:00");
  const dayIndex = isNaN(dateObj.getTime()) ? new Date().getDay() : dateObj.getDay();
  const dayCodes = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return dayCodes[dayIndex] || "MON";
}

// ─── Cached Base Faculty Rows ──────────────────────────────────────────────────

type StaffLinkRow = RowDataPacket & {
  id: number;
  hrms_employee_id: string;
  employee_code: string | null;
  display_name: string | null;
  department_name: string | null;
};

type BaseStaffRow = {
  hrmsEmployeeId: string;
  staffLinkId: number | null;
  name: string;
  code: string;
  division: string;
  department: string;
  designation: string;
  college: string;
  employeeGroup: string;
  isActive: boolean;
  linkStatus: "linked" | "unlinked";
  profilePhoto?: string | null;
};

const BASE_STAFF_TTL_MS = 60 * 1000;
let baseStaffCache: { expiresAt: number; rows: BaseStaffRow[] } | null = null;
let baseStaffInflight: Promise<BaseStaffRow[]> | null = null;

async function loadBaseStaffRows(): Promise<BaseStaffRow[]> {
  if (baseStaffCache && baseStaffCache.expiresAt > Date.now()) {
    return baseStaffCache.rows;
  }
  if (baseStaffInflight) return baseStaffInflight;

  baseStaffInflight = (async () => {
    try {
      const db = await getHrmsDb();
      const [lookups, groupFilter, employees, linkRows] = await Promise.all([
        loadHrmsOrgLookups(db),
        getFacultyGroupFilter(),
        db
          .collection("employees")
          .find({
            $or: [{ is_active: true }, { is_active: { $exists: false } }],
          })
          .project(HRMS_EMPLOYEE_PROJECTION)
          .limit(2000)
          .toArray(),
        queryAcademic<StaffLinkRow[]>(
          `SELECT id, hrms_employee_id, employee_code, display_name, department_name FROM ap_staff_link`,
        ).catch(() => []),
      ]);

      const linkMapByHrms = new Map<string, StaffLinkRow>();
      const linkMapByCode = new Map<string, StaffLinkRow>();
      for (const row of linkRows) {
        if (row.hrms_employee_id) linkMapByHrms.set(String(row.hrms_employee_id).trim(), row);
        if (row.employee_code) linkMapByCode.set(String(row.employee_code).trim(), row);
      }

      const rows: BaseStaffRow[] = [];
      const seenHrmsIds = new Set<string>();

      for (const raw of employees) {
        const emp = extractHrmsStaffProfile(raw as Record<string, unknown>, lookups);
        if (
          !employeeMatchesFacultyGroupFilter(
            groupFilter,
            emp.employeeGroupId,
            emp.employeeGroup,
          )
        ) {
          continue;
        }

        const link = linkMapByHrms.get(emp.hrmsId) || linkMapByCode.get(emp.hrmsId);
        seenHrmsIds.add(emp.hrmsId);

        rows.push({
          hrmsEmployeeId: emp.hrmsId,
          staffLinkId: link ? Number(link.id) : null,
          name: emp.name,
          code: link?.employee_code || emp.hrmsId,
          division: emp.division,
          department: emp.department,
          designation: emp.designation,
          college: emp.college,
          employeeGroup: emp.employeeGroup,
          isActive: emp.isActive,
          linkStatus: link ? "linked" : "unlinked",
          profilePhoto: emp.profilePhoto || null,
        });
      }

      // Also include any staff in ap_staff_link that wasn't found in HRMS employees
      for (const link of linkRows) {
        const hrmsId = String(link.hrms_employee_id || link.employee_code || "").trim();
        if (hrmsId && !seenHrmsIds.has(hrmsId)) {
          seenHrmsIds.add(hrmsId);
          rows.push({
            hrmsEmployeeId: hrmsId,
            staffLinkId: Number(link.id),
            name: link.display_name?.trim() || `Staff ${link.id}`,
            code: link.employee_code || hrmsId,
            division: "—",
            department: link.department_name?.trim() || "—",
            designation: "Faculty",
            college: "—",
            employeeGroup: "teaching",
            isActive: true,
            linkStatus: "linked",
            profilePhoto: null,
          });
        }
      }

      rows.sort((a, b) => a.name.localeCompare(b.name));
      baseStaffCache = { expiresAt: Date.now() + BASE_STAFF_TTL_MS, rows };
      return rows;
    } catch (err) {
      console.warn("loadBaseStaffRows fallback:", err);
      // Fallback directly to ap_staff_link if HRMS fails
      const linkRows = await queryAcademic<StaffLinkRow[]>(
        `SELECT id, hrms_employee_id, employee_code, display_name, department_name FROM ap_staff_link ORDER BY display_name ASC`,
      ).catch(() => []);

      return linkRows.map((link) => ({
        hrmsEmployeeId: String(link.hrms_employee_id || link.employee_code || link.id),
        staffLinkId: Number(link.id),
        name: link.display_name?.trim() || `Staff ${link.id}`,
        code: link.employee_code || String(link.id),
        division: "—",
        department: link.department_name?.trim() || "—",
        designation: "Faculty",
        college: "—",
        employeeGroup: "teaching",
        isActive: true,
        linkStatus: "linked" as const,
        profilePhoto: null,
      }));
    } finally {
      baseStaffInflight = null;
    }
  })();

  return baseStaffInflight;
}

// ─── Main Service Function ─────────────────────────────────────────────────────

export async function getStaffOverview(filters: StaffOverviewFilters = {}) {
  const selectedDate = (filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date))
    ? filters.date
    : getTodayIST();
  const dayCode = dayCodeForDate(selectedDate);

  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 25));

  // 1. Load base staff list
  const baseStaff = await loadBaseStaffRows();

  // Filter by college scope if present
  let scopedStaff = baseStaff;
  if (filters.collegeNames?.length) {
    const allowed = new Set(
      filters.collegeNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
    );
    scopedStaff = scopedStaff.filter((r) => {
      const college = r.college.trim().toLowerCase();
      return college && college !== "—" && allowed.has(college);
    });
  }

  // 2. Fetch teaching subjects (from master timetable + class sessions) in parallel with today's slots
  const [teachingSubjectRows, todaySessionRows, masterDayRows] = await Promise.all([
    queryAcademic<
      (RowDataPacket & {
        faculty_staff_link_id: number;
        subject_name: string | null;
        subject_code: string | null;
      })[]
    >(
      `SELECT DISTINCT
         te.faculty_staff_link_id,
         te.subject_name,
         te.subject_code
       FROM ap_timetable_entries te
       JOIN ap_timetable_plans p ON p.id = te.plan_id AND p.status = 'published'
       WHERE te.faculty_staff_link_id IS NOT NULL
       UNION
       SELECT DISTINCT
         cs.faculty_staff_link_id,
         cs.subject_name,
         cs.subject_code
       FROM ap_class_sessions cs
       WHERE cs.faculty_staff_link_id IS NOT NULL AND cs.subject_name IS NOT NULL`,
    ).catch(() => []),

    queryAcademic<
      (RowDataPacket & {
        id: number;
        faculty_staff_link_id: number;
        timing_slot_id: number;
        subject_name: string | null;
        subject_code: string | null;
        start_time: string | null;
        end_time: string | null;
        section_name: string | null;
        status: string;
        slot_label: string | null;
        slot_order: number | null;
        post_id: number | null;
      })[]
    >(
      `SELECT 
         cs.id,
         cs.faculty_staff_link_id,
         cs.timing_slot_id,
         cs.subject_name,
         cs.subject_code,
         cs.start_time,
         cs.end_time,
         cs.section_name,
         cs.status,
         ts.label as slot_label,
         ts.slot_order,
         ap.id as post_id
       FROM ap_class_sessions cs
       LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(cs.timing_slot_id, cs.period_slot_id)
       LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
       WHERE cs.session_date = ? AND cs.faculty_staff_link_id IS NOT NULL AND cs.status != 'cancelled'
       ORDER BY COALESCE(ts.slot_order, 99), cs.start_time ASC, cs.id ASC`,
      [selectedDate],
    ).catch(() => []),

    dayCode !== "SUN"
      ? queryAcademic<
          (RowDataPacket & {
            id: number;
            faculty_staff_link_id: number;
            subject_name: string | null;
            subject_code: string | null;
            section_name: string | null;
            slot_label: string | null;
            start_time: string | null;
            end_time: string | null;
            slot_order: number | null;
            room_label: string | null;
          })[]
        >(
          `SELECT
             te.id,
             te.faculty_staff_link_id,
             te.subject_name,
             te.subject_code,
             p.section_name,
             ts.label as slot_label,
             ts.start_time,
             ts.end_time,
             ts.slot_order,
             te.room_label
           FROM ap_timetable_entries te
           JOIN ap_timetable_plans p ON p.id = te.plan_id AND p.status = 'published'
           LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
           WHERE te.day_of_week = ? AND te.faculty_staff_link_id IS NOT NULL
           ORDER BY COALESCE(ts.slot_order, 99), ts.start_time ASC, te.id ASC`,
          [dayCode],
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Index teaching subjects by staffLinkId
  const teachingSubjectsMap = new Map<number, Set<string>>();
  for (const row of teachingSubjectRows) {
    const sName = row.subject_name?.trim();
    if (!sName) continue;
    const staffId = Number(row.faculty_staff_link_id);
    let set = teachingSubjectsMap.get(staffId);
    if (!set) {
      set = new Set<string>();
      teachingSubjectsMap.set(staffId, set);
    }
    set.add(sName);
  }

  // Index today's slots by staffLinkId
  const todaySlotsMap = new Map<number, StaffSlotDetail[]>();

  // First populate from class sessions on selected date (deduplicating duplicate/superseded plan sessions)
  const sessionsByStaff = new Map<number, any[]>();
  for (const cs of todaySessionRows) {
    const staffId = Number(cs.faculty_staff_link_id);
    if (!sessionsByStaff.has(staffId)) sessionsByStaff.set(staffId, []);
    sessionsByStaff.get(staffId)!.push(cs);
  }

  for (const [staffId, staffSessions] of sessionsByStaff.entries()) {
    const dedupMap = new Map<string, any>();
    for (const cs of staffSessions) {
      const key = `${cs.slot_label || cs.start_time}_${cs.subject_code || ""}_${cs.section_name || ""}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, cs);
      } else {
        const existing = dedupMap.get(key);
        if (cs.post_id && !existing.post_id) {
          dedupMap.set(key, cs);
        }
      }
    }
    const list: StaffSlotDetail[] = Array.from(dedupMap.values()).map((cs) => {
      const isPosted = cs.status === "posted" || cs.status === "completed" || cs.post_id != null;
      return {
        id: cs.id,
        timingSlotId: cs.timing_slot_id,
        slotLabel: cs.slot_label || `Slot ${cs.timing_slot_id}`,
        startTime: cs.start_time ? String(cs.start_time).slice(0, 5) : null,
        endTime: cs.end_time ? String(cs.end_time).slice(0, 5) : null,
        subjectName: cs.subject_name || "Class Session",
        subjectCode: cs.subject_code,
        sectionName: cs.section_name,
        status: cs.status,
        isPosted,
      };
    });
    todaySlotsMap.set(staffId, list);
  }

  // Master timetable fallback for staff members who don't have sessions recorded yet for today
  for (const me of masterDayRows) {
    const staffId = Number(me.faculty_staff_link_id);
    const existing = todaySlotsMap.get(staffId);
    if (!existing || existing.length === 0) {
      let list = existing;
      if (!list) {
        list = [];
        todaySlotsMap.set(staffId, list);
      }
      list.push({
        id: me.id,
        slotLabel: me.slot_label || "Period",
        startTime: me.start_time ? String(me.start_time).slice(0, 5) : null,
        endTime: me.end_time ? String(me.end_time).slice(0, 5) : null,
        subjectName: me.subject_name || "Class Session",
        subjectCode: me.subject_code,
        sectionName: me.section_name,
        status: "scheduled",
        isPosted: false,
        roomLabel: me.room_label,
      });
    }
  }

  // 3. Fetch HRMS Attendance & Leaves for today
  const empNos = scopedStaff
    .map((r) => String(r.hrmsEmployeeId || r.code || "").trim())
    .filter(Boolean);

  const startOfDay = new Date(`${selectedDate}T00:00:00+05:30`);
  const endOfDay = new Date(`${selectedDate}T23:59:59.999+05:30`);

  let dailies: any[] = [];
  let rawLogs: any[] = [];
  let leaves: any[] = [];
  let ods: any[] = [];
  let perms: any[] = [];

  if (empNos.length > 0) {
    try {
      const hrmsDb = await getHrmsDb();
      const leaveDateFilter = {
        $or: [
          { fromDate: { $lte: endOfDay }, toDate: { $gte: startOfDay } },
          { fromDate: { $lte: selectedDate }, toDate: { $gte: selectedDate } },
          { fromDate: { $gte: `${selectedDate}T00:00:00`, $lte: `${selectedDate}T23:59:59` } },
          { toDate: { $gte: `${selectedDate}T00:00:00`, $lte: `${selectedDate}T23:59:59` } },
        ],
      };

      [dailies, rawLogs, leaves, ods, perms] = await Promise.all([
        hrmsDb
          .collection("attendancedailies")
          .find({
            $or: [
              { emp_no: { $in: empNos }, date: selectedDate },
              { employeeNumber: { $in: empNos }, date: selectedDate },
              { emp_no: { $in: empNos }, date: { $gte: startOfDay, $lte: endOfDay } },
              { employeeNumber: { $in: empNos }, date: { $gte: startOfDay, $lte: endOfDay } },
            ],
          })
          .project({ emp_no: 1, employeeNumber: 1, date: 1, status: 1, totalLateInMinutes: 1, shifts: 1, odHours: 1, permissionHours: 1 })
          .toArray()
          .catch(() => []),

        hrmsDb
          .collection("attendancerawlogs")
          .find({
            employeeNumber: { $in: empNos },
            $or: [
              { timestamp: { $gte: startOfDay, $lte: endOfDay } },
              { timestamp: { $gte: `${selectedDate}T00:00:00`, $lte: `${selectedDate}T23:59:59` } },
              { date: { $gte: startOfDay, $lte: endOfDay } },
              { date: selectedDate },
            ],
          })
          .project({ employeeNumber: 1, emp_no: 1, timestamp: 1, date: 1, createdAt: 1 })
          .toArray()
          .catch(() => []),

        hrmsDb
          .collection("leaves")
          .find({
            emp_no: { $in: empNos },
            status: { $nin: ["rejected", "cancelled"] },
            ...leaveDateFilter,
          })
          .project({ emp_no: 1, leaveType: 1, fromDate: 1, toDate: 1, purpose: 1, remarks: 1, status: 1 })
          .toArray()
          .catch(() => []),

        hrmsDb
          .collection("ods")
          .find({
            emp_no: { $in: empNos },
            status: { $nin: ["rejected", "cancelled"] },
            ...leaveDateFilter,
          })
          .project({ emp_no: 1, odType: 1, fromDate: 1, toDate: 1, placeVisited: 1, purpose: 1, remarks: 1, status: 1 })
          .toArray()
          .catch(() => []),

        hrmsDb
          .collection("permissions")
          .find({
            emp_no: { $in: empNos },
            status: { $nin: ["rejected", "cancelled"] },
          })
          .project({ emp_no: 1, date: 1, hours: 1, reason: 1, status: 1 })
          .toArray()
          .catch(() => []),
      ]);
    } catch (err) {
      console.warn("Staff HRMS query fallback:", err);
    }
  }

  // Pre-index HRMS attendance records
  const rawPunchesMap = new Map<string, { first: Date; last: Date; count: number }>();
  for (const log of rawLogs) {
    const eNo = String(log.employeeNumber || log.emp_no || "").trim();
    if (!eNo) continue;
    const ts = new Date(log.timestamp || log.createdAt || log.date);
    if (isNaN(ts.getTime())) continue;
    const existing = rawPunchesMap.get(eNo);
    if (!existing) {
      rawPunchesMap.set(eNo, { first: ts, last: ts, count: 1 });
    } else {
      if (ts < existing.first) existing.first = ts;
      if (ts > existing.last) existing.last = ts;
      existing.count++;
    }
  }

  const dailyMap = new Map<string, any>();
  for (const d of dailies) {
    const key = String(d.employeeNumber || d.emp_no || "").trim();
    if (key) dailyMap.set(key, d);
  }

  const leaveMap = new Map<string, any>();
  for (const l of leaves) {
    const key = String(l.emp_no || "").trim();
    if (key) leaveMap.set(key, l);
  }

  const odMap = new Map<string, any>();
  for (const o of ods) {
    const key = String(o.emp_no || "").trim();
    if (key) odMap.set(key, o);
  }

  const permMap = new Map<string, any>();
  for (const p of perms) {
    const key = String(p.emp_no || "").trim();
    if (key) permMap.set(key, p);
  }

  // 4. Transform all staff into StaffOverviewItem
  let allItems: StaffOverviewItem[] = scopedStaff.map((staff) => {
    const hrmsId = String(staff.hrmsEmployeeId || staff.code || "").trim();
    const code = String(staff.code || staff.hrmsEmployeeId || "").trim();

    const punch = rawPunchesMap.get(hrmsId) || (code ? rawPunchesMap.get(code) : undefined);
    const daily = dailyMap.get(hrmsId) || (code ? dailyMap.get(code) : undefined);
    const leaveRec = leaveMap.get(hrmsId) || (code ? leaveMap.get(code) : undefined);
    const odRec = odMap.get(hrmsId) || (code ? odMap.get(code) : undefined);
    const permRec = permMap.get(hrmsId) || (code ? permMap.get(code) : undefined);

    const staffLinkId = staff.staffLinkId;
    const todaySlots = (staffLinkId ? todaySlotsMap.get(staffLinkId) : []) || [];
    const todaySlotsCount = todaySlots.length;
    const todayPostedSlotsCount = todaySlots.filter((s) => s.isPosted).length;
    const todayPendingSlotsCount = Math.max(0, todaySlotsCount - todayPostedSlotsCount);

    const teachingSubjects = staffLinkId
      ? Array.from(teachingSubjectsMap.get(staffLinkId) || [])
      : [];

    // Compute attendance status
    const shiftWithIn = daily?.shifts?.find((s: any) => s.inTime != null);
    const hasInTime = Boolean(shiftWithIn?.inTime);
    const hasThumb = Boolean(punch);
    const isPartial = daily?.status === "PARTIAL";
    const isPresentDaily = daily?.status === "PRESENT";
    const isLate = Boolean((daily?.totalLateInMinutes ?? 0) > 0 || shiftWithIn?.isLateIn);
    const isLeave = Boolean(leaveRec || daily?.status === "LEAVE");
    const isOd = Boolean(odRec || daily?.status === "OD" || (daily?.odHours && daily.odHours > 0));
    const isPermission = Boolean(permRec || (daily?.permissionHours ?? 0) > 0);

    let status: "present" | "late" | "leave" | "od" | "permission" | "absent" = "absent";
    let displayStatus = "Absent";
    let thumbStatus: "active" | "partial" | "full" | "none" = "none";
    let details: string | null = null;
    let lateMinutes = daily?.totalLateInMinutes || shiftWithIn?.lateInMinutes || 0;

    const checkIn = shiftWithIn?.inTime
      ? formatISTTime(shiftWithIn.inTime)
      : punch?.first
        ? formatISTTime(punch.first)
        : null;

    const checkOut = shiftWithIn?.outTime
      ? formatISTTime(shiftWithIn.outTime)
      : punch && punch.count > 1
        ? formatISTTime(punch.last)
        : null;

    if (hasThumb || hasInTime || isPartial || isPresentDaily) {
      status = isLate ? "late" : "present";
      displayStatus = isLate ? (lateMinutes > 0 ? `Late (${lateMinutes}m)` : "Late") : "Present";
      thumbStatus = isPartial ? "partial" : hasThumb ? "active" : "full";
      const punchText = punch ? `${punch.count} punch${punch.count > 1 ? "es" : ""}` : "Present";
      const slotText = todaySlotsCount > 0
        ? `${todaySlotsCount} slot${todaySlotsCount > 1 ? "s" : ""} today (${todayPostedSlotsCount} posted)`
        : "No slots today";
      details = `${punchText} • ${slotText}`;
    } else if (isLeave) {
      status = "leave";
      const leaveType = leaveRec?.leaveType || "CL";
      displayStatus = `Leave (${leaveType})`;
      const baseLeave = leaveRec?.purpose || leaveRec?.remarks || "Leave applied in HRMS";
      details = todaySlotsCount > 0
        ? `${baseLeave} • ${todaySlotsCount} slots scheduled`
        : baseLeave;
    } else if (isOd) {
      status = "od";
      const odType = odRec?.odType || "On Duty";
      displayStatus = `OD (${odType})`;
      const baseOd = odRec?.placeVisited ? `OD: ${odRec.placeVisited}` : (odRec?.purpose || "Official duty");
      details = todaySlotsCount > 0
        ? `${baseOd} • ${todaySlotsCount} slots scheduled`
        : baseOd;
    } else if (isPermission) {
      status = "permission";
      displayStatus = "Permission";
      details = `${daily?.permissionHours || 1} hr permission`;
    } else {
      status = "absent";
      displayStatus = "Absent";
      details = todaySlotsCount > 0
        ? `No biometric punch • ${todaySlotsCount} slots scheduled`
        : "No biometric punch";
    }

    return {
      hrmsEmployeeId: staff.hrmsEmployeeId,
      staffLinkId: staff.staffLinkId,
      name: staff.name,
      code: staff.code,
      division: staff.division,
      department: staff.department,
      designation: staff.designation || "Faculty",
      college: staff.college,
      employeeGroup: staff.employeeGroup,
      isActive: staff.isActive,
      linkStatus: staff.linkStatus,
      profilePhoto: staff.profilePhoto,
      teachingSubjects,
      todaySlotsCount,
      todayPostedSlotsCount,
      todayPendingSlotsCount,
      todaySlots,
      todayAttendance: {
        status,
        displayStatus,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        lateMinutes,
        thumbStatus,
        punchCount: punch?.count || 0,
        details,
        leaveType: leaveRec?.leaveType || null,
        leaveReason: leaveRec?.purpose || leaveRec?.remarks || null,
        odPlace: odRec?.placeVisited || odRec?.purpose || null,
      },
    };
  });

  // 1. Calculate overall global KPIs across all items (entire college scope)
  const globalTotalStaff = allItems.length;
  const globalPresentCount = allItems.filter((i) => i.todayAttendance.status === "present" || i.todayAttendance.status === "late").length;
  const globalLateCount = allItems.filter((i) => i.todayAttendance.status === "late").length;
  const globalAbsentCount = allItems.filter((i) => i.todayAttendance.status === "absent").length;
  const globalLeaveCount = allItems.filter((i) => i.todayAttendance.status === "leave").length;
  const globalOdCount = allItems.filter((i) => i.todayAttendance.status === "od").length;
  const globalPermissionCount = allItems.filter((i) => i.todayAttendance.status === "permission").length;
  const globalWithSlotsCount = allItems.filter((i) => i.todaySlotsCount > 0).length;
  const globalTotalSlotsToday = allItems.reduce((acc, i) => acc + i.todaySlotsCount, 0);

  const globalKpis = {
    totalStaff: globalTotalStaff,
    presentCount: globalPresentCount,
    lateCount: globalLateCount,
    absentCount: globalAbsentCount,
    leaveCount: globalLeaveCount,
    odCount: globalOdCount,
    permissionCount: globalPermissionCount,
    withSlotsCount: globalWithSlotsCount,
    totalSlotsToday: globalTotalSlotsToday,
  };

  // 2. Extract filter options from the full pool
  const divisions = [...new Set(allItems.map((i) => i.division).filter((d) => d && d !== "—"))].sort();
  const departments = [...new Set(allItems.map((i) => i.department).filter((d) => d && d !== "—"))].sort();
  const designations = [...new Set(allItems.map((i) => i.designation).filter((d) => d && d !== "—"))].sort();

  // 3. Apply contextual scope filters (search, department, division, designation, hasSlots)
  let contextualItems = allItems;

  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    contextualItems = contextualItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.hrmsEmployeeId.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.designation.toLowerCase().includes(q) ||
        item.division.toLowerCase().includes(q) ||
        item.teachingSubjects.some((s) => s.toLowerCase().includes(q)),
    );
  }

  if (filters.department && filters.department !== "all") {
    const dept = filters.department.toLowerCase();
    contextualItems = contextualItems.filter((i) => i.department.toLowerCase() === dept);
  }

  if (filters.division && filters.division !== "all") {
    const div = filters.division.toLowerCase();
    contextualItems = contextualItems.filter((i) => i.division.toLowerCase() === div);
  }

  if (filters.designation && filters.designation !== "all") {
    const des = filters.designation.toLowerCase();
    contextualItems = contextualItems.filter((i) => i.designation.toLowerCase() === des);
  }

  if (filters.hasSlots && filters.hasSlots !== "all") {
    if (filters.hasSlots === "yes") {
      contextualItems = contextualItems.filter((i) => i.todaySlotsCount > 0);
    } else if (filters.hasSlots === "no") {
      contextualItems = contextualItems.filter((i) => i.todaySlotsCount === 0);
    }
  }

  // 4. Calculate contextual KPIs matching the scoped filters
  const scopedTotalStaff = contextualItems.length;
  const scopedPresentCount = contextualItems.filter((i) => i.todayAttendance.status === "present" || i.todayAttendance.status === "late").length;
  const scopedLateCount = contextualItems.filter((i) => i.todayAttendance.status === "late").length;
  const scopedAbsentCount = contextualItems.filter((i) => i.todayAttendance.status === "absent").length;
  const scopedLeaveCount = contextualItems.filter((i) => i.todayAttendance.status === "leave").length;
  const scopedOdCount = contextualItems.filter((i) => i.todayAttendance.status === "od").length;
  const scopedPermissionCount = contextualItems.filter((i) => i.todayAttendance.status === "permission").length;
  const scopedWithSlotsCount = contextualItems.filter((i) => i.todaySlotsCount > 0).length;
  const scopedTotalSlotsToday = contextualItems.reduce((acc, i) => acc + i.todaySlotsCount, 0);

  const kpis = {
    totalStaff: scopedTotalStaff,
    presentCount: scopedPresentCount,
    lateCount: scopedLateCount,
    absentCount: scopedAbsentCount,
    leaveCount: scopedLeaveCount,
    odCount: scopedOdCount,
    permissionCount: scopedPermissionCount,
    withSlotsCount: scopedWithSlotsCount,
    totalSlotsToday: scopedTotalSlotsToday,
  };

  // 5. Apply status filter for the final table display
  let tableItems = contextualItems;
  if (filters.status && filters.status !== "all") {
    const st = filters.status.toLowerCase();
    if (st === "present") {
      tableItems = tableItems.filter((i) => i.todayAttendance.status === "present" || i.todayAttendance.status === "late");
    } else {
      tableItems = tableItems.filter((i) => i.todayAttendance.status === st);
    }
  }

  const filteredTotal = tableItems.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const data = tableItems.slice(start, start + pageSize);

  return {
    date: selectedDate,
    dayOfWeek: dayCode,
    data,
    kpis,
    globalKpis,
    pagination: {
      page: safePage,
      pageSize,
      total: filteredTotal,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
    filterOptions: {
      divisions,
      departments,
      designations,
    },
  };
}

// ─── Staff Member Detailed Profile ─────────────────────────────────────────────

export type StaffDetailOptions = {
  identifier: string;
  date?: string;
  collegeNames?: string[];
};

export async function getStaffMemberDetail({
  identifier,
  date,
  collegeNames,
}: StaffDetailOptions) {
  if (!identifier) return null;
  const idLower = identifier.trim().toLowerCase();
  const selectedDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : getTodayIST();
  const dayCode = dayCodeForDate(selectedDate);

  // 1. Locate staff member from base list
  const baseList = await loadBaseStaffRows();
  let staff = baseList.find(
    (s) =>
      s.code.toLowerCase() === idLower ||
      s.hrmsEmployeeId.toLowerCase() === idLower ||
      (s.staffLinkId != null && String(s.staffLinkId) === idLower),
  );

  // If not found in cached base, check MySQL ap_staff_link directly
  if (!staff) {
    const isNum = /^\d+$/.test(identifier.trim());
    const fallbackLink = await queryAcademic<StaffLinkRow[]>(
      `SELECT id, hrms_employee_id, employee_code, display_name, department_name 
       FROM ap_staff_link 
       WHERE ${isNum ? "id = ? OR " : ""} LOWER(hrms_employee_id) = ? OR LOWER(employee_code) = ?
       LIMIT 1`,
      isNum ? [Number(identifier.trim()), idLower, idLower] : [idLower, idLower],
    ).catch(() => []);

    if (fallbackLink.length > 0) {
      const row = fallbackLink[0];
      staff = {
        hrmsEmployeeId: String(row.hrms_employee_id || row.employee_code || row.id),
        staffLinkId: Number(row.id),
        name: row.display_name?.trim() || `Staff ${row.id}`,
        code: row.employee_code || String(row.id),
        division: "—",
        department: row.department_name?.trim() || "—",
        designation: "Faculty",
        college: "—",
        employeeGroup: "teaching",
        isActive: true,
        linkStatus: "linked",
        profilePhoto: null,
      };
    }
  }

  if (!staff) return null;

  // College scope check if restricted
  if (collegeNames?.length && staff.college && staff.college !== "—") {
    const allowed = new Set(collegeNames.map((c) => c.trim().toLowerCase()).filter(Boolean));
    if (!allowed.has(staff.college.trim().toLowerCase())) {
      return null;
    }
  }

  // 2. Fetch extra profile details from HRMS Mongo
  const hrmsDb = await getHrmsDb().catch(() => null);
  let email: string | null = null;
  let phone: string | null = null;
  let gender: string | null = null;
  let dateOfJoining: string | null = null;
  let qualification: string | null = null;
  let experience: string | null = null;

  if (hrmsDb) {
    try {
      const empDoc = await hrmsDb.collection("employees").findOne({
        $or: [
          { employeeNumber: staff.hrmsEmployeeId },
          { emp_no: staff.hrmsEmployeeId },
          { employeeNumber: staff.code },
          { emp_no: staff.code },
        ],
      });

      if (empDoc) {
        const dynamic = (empDoc.dynamicFields && typeof empDoc.dynamicFields === "object" ? empDoc.dynamicFields : {}) as Record<string, unknown>;
        let allData: Record<string, unknown> = {};
        if (typeof dynamic.allData === "string") {
          try { allData = JSON.parse(dynamic.allData); } catch {}
        } else if (dynamic.allData && typeof dynamic.allData === "object") {
          allData = dynamic.allData as Record<string, unknown>;
        }

        email = (empDoc.email || empDoc.official_email || empDoc.personal_email || dynamic.email || dynamic.official_email || allData.email) as string || null;
        phone = (empDoc.mobile || empDoc.phone || empDoc.contact_number || dynamic.mobile || dynamic.phone || allData.mobile || allData.phone) as string || null;
        gender = (empDoc.gender || dynamic.gender || allData.gender) as string || null;

        const rawDoj = empDoc.dateOfJoining || empDoc.doj || empDoc.joiningDate || dynamic.dateOfJoining || dynamic.doj || allData.dateOfJoining;
        if (rawDoj) {
          const d = new Date(rawDoj as string | number);
          dateOfJoining = isNaN(d.getTime()) ? String(rawDoj) : d.toISOString().split("T")[0];
        }

        qualification = (empDoc.qualification || empDoc.highestQualification || dynamic.qualification || allData.qualification) as string || null;
        experience = (empDoc.experience || empDoc.totalExperience || dynamic.experience || allData.experience) as string || null;
      }
    } catch (e) {
      console.warn("[getStaffMemberDetail] Error loading HRMS profile extra fields:", e);
    }
  }

  // 3. Load attendance & biometric punches for selectedDate
  const startOfDay = new Date(`${selectedDate}T00:00:00+05:30`);
  const endOfDay = new Date(`${selectedDate}T23:59:59.999+05:30`);

  let dailyDoc: any = null;
  let rawPunches: any[] = [];
  let leaveDoc: any = null;
  let odDoc: any = null;
  let permissionDoc: any = null;
  let recentDailyDocs: any[] = [];

  if (hrmsDb) {
    const empIdentifiers = [staff.hrmsEmployeeId, staff.code].filter(Boolean);
    const [dRes, pRes, lRes, oRes, permRes, recentRes] = await Promise.all([
      hrmsDb
        .collection("attendancedailies")
        .findOne({
          $or: [
            { emp_no: { $in: empIdentifiers }, date: { $gte: startOfDay, $lte: endOfDay } },
            { employeeNumber: { $in: empIdentifiers }, date: { $gte: startOfDay, $lte: endOfDay } },
            { emp_no: { $in: empIdentifiers }, date: selectedDate },
            { employeeNumber: { $in: empIdentifiers }, date: selectedDate },
          ],
        })
        .catch(() => null),

      hrmsDb
        .collection("attendancerawlogs")
        .find({
          $or: [
            { employeeNumber: { $in: empIdentifiers } },
            { emp_no: { $in: empIdentifiers } },
          ],
          $and: [
            {
              $or: [
                { timestamp: { $gte: startOfDay, $lte: endOfDay } },
                { timestamp: { $gte: `${selectedDate}T00:00:00`, $lte: `${selectedDate}T23:59:59` } },
                { date: { $gte: startOfDay, $lte: endOfDay } },
                { date: selectedDate },
              ],
            },
          ],
        })
        .sort({ timestamp: 1 })
        .toArray()
        .catch(() => []),

      hrmsDb
        .collection("leaves")
        .findOne({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              status: { $nin: ["rejected", "cancelled"] },
            },
            {
              $or: [
                { fromDate: { $lte: endOfDay }, toDate: { $gte: startOfDay } },
                { fromDate: { $lte: selectedDate }, toDate: { $gte: selectedDate } },
              ],
            },
          ],
        })
        .catch(() => null),

      hrmsDb
        .collection("ods")
        .findOne({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              status: { $nin: ["rejected", "cancelled"] },
            },
            {
              $or: [
                { fromDate: { $lte: endOfDay }, toDate: { $gte: startOfDay } },
                { fromDate: { $lte: selectedDate }, toDate: { $gte: selectedDate } },
              ],
            },
          ],
        })
        .catch(() => null),

      hrmsDb
        .collection("permissions")
        .findOne({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              status: { $nin: ["rejected", "cancelled"] },
            },
            {
              $or: [
                { date: { $gte: startOfDay, $lte: endOfDay } },
                { date: selectedDate },
                { permissionDate: { $gte: startOfDay, $lte: endOfDay } },
              ],
            },
          ],
        })
        .catch(() => null),

      // Recent 14 days
      hrmsDb
        .collection("attendancedailies")
        .find({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              $or: [
                { date: { $lte: selectedDate } },
                { date: { $lte: endOfDay } },
              ],
            },
          ],
        })
        .sort({ date: -1 })
        .limit(14)
        .toArray()
        .catch(() => []),
    ]);

    dailyDoc = dRes;
    rawPunches = pRes || [];
    leaveDoc = lRes;
    odDoc = oRes;
    permissionDoc = permRes;
    recentDailyDocs = recentRes || [];
  }

  // Format punch history
  const punches = rawPunches.map((p) => {
    const ts = p.timestamp || p.createdAt || p.date;
    return {
      time: formatISTTime(ts) || "—",
      timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
      device: p.deviceName || p.device || null,
      direction: p.direction || p.inOutMode || null,
    };
  });

  // Calculate In/Out times
  let checkInTime: string | null = null;
  let checkOutTime: string | null = null;
  const shift = dailyDoc?.shifts?.[0];
  if (shift?.inTime) checkInTime = formatISTTime(shift.inTime);
  if (shift?.outTime) checkOutTime = formatISTTime(shift.outTime);

  if (!checkInTime && punches.length > 0) checkInTime = punches[0].time;
  if (!checkOutTime && punches.length > 1) checkOutTime = punches[punches.length - 1].time;

  const lateMinutes = Number(shift?.lateInMinutes || dailyDoc?.totalLateInMinutes || 0);

  // Status determination
  let status: "present" | "late" | "leave" | "od" | "permission" | "absent" = "absent";
  let displayStatus = "Absent";
  let details = "No biometric punch recorded";

  const isLeave = Boolean(leaveDoc);
  const isOd = Boolean(odDoc) || Number(dailyDoc?.odHours || 0) > 0;
  const isPermission = Boolean(permissionDoc) || Number(dailyDoc?.permissionHours || 0) > 0;
  const rawDailyStatus = String(dailyDoc?.status || "").toUpperCase();
  const isPresentDaily = rawDailyStatus === "PRESENT" || rawDailyStatus === "P" || Boolean(shift?.inTime);
  const hasThumbPunch = punches.length > 0;

  let thumbStatus: "active" | "partial" | "full" | "none" = "none";
  if (punches.length >= 2) thumbStatus = "full";
  else if (punches.length === 1) thumbStatus = "partial";
  else if (checkInTime) thumbStatus = "active";

  if (isPresentDaily || hasThumbPunch) {
    if (lateMinutes > 0) {
      status = "late";
      displayStatus = `Late (${lateMinutes}m)`;
      details = `Punched in late by ${lateMinutes} mins`;
    } else {
      status = "present";
      displayStatus = "Present";
      details = punches.length > 0 ? `Biometric recorded (${punches.length} punches)` : "Marked Present";
    }
  } else if (isLeave) {
    status = "leave";
    const leaveType = leaveDoc?.leaveType || "CL";
    displayStatus = `Leave (${leaveType})`;
    details = leaveDoc?.purpose || leaveDoc?.remarks || "Approved leave";
  } else if (isOd) {
    status = "od";
    const odType = odDoc?.odType || "On Duty";
    displayStatus = `OD (${odType})`;
    details = odDoc?.placeVisited ? `OD: ${odDoc.placeVisited}` : (odDoc?.purpose || "Official Duty");
  } else if (isPermission) {
    status = "permission";
    displayStatus = "Permission";
    details = `${permissionDoc?.hours || dailyDoc?.permissionHours || 1} hr permission`;
  }

  // 4. Load today's schedule slots and all weekly timetable slots
  let todaySlots: StaffSlotDetail[] = [];
  let weeklyEntries: any[] = [];
  let distinctSubjects: any[] = [];

  if (staff.staffLinkId) {
    const [todaySessions, masterToday, allWeekEntries] = await Promise.all([
      queryAcademic<
        (RowDataPacket & {
          id: number;
          timing_slot_id: number;
          subject_name: string | null;
          subject_code: string | null;
          start_time: string | null;
          end_time: string | null;
          section_name: string | null;
          status: string;
          slot_label: string | null;
          slot_order: number | null;
          post_id: number | null;
        })[]
      >(
        `SELECT 
           cs.id,
           cs.timing_slot_id,
           cs.subject_name,
           cs.subject_code,
           cs.start_time,
           cs.end_time,
           cs.section_name,
           cs.status,
           ts.label as slot_label,
           ts.slot_order,
           ap.id as post_id
         FROM ap_class_sessions cs
         LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(cs.timing_slot_id, cs.period_slot_id)
         LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
         WHERE cs.session_date = ? AND cs.faculty_staff_link_id = ? AND cs.status != 'cancelled'
         ORDER BY COALESCE(ts.slot_order, 99), cs.start_time ASC, (ap.id IS NOT NULL) DESC`,
        [selectedDate, staff.staffLinkId],
      ).catch(() => []),

      dayCode !== "SUN"
        ? queryAcademic<
            (RowDataPacket & {
              id: number;
              subject_name: string | null;
              subject_code: string | null;
              section_name: string | null;
              slot_label: string | null;
              start_time: string | null;
              end_time: string | null;
              slot_order: number | null;
              room_label: string | null;
            })[]
          >(
            `SELECT
               te.id,
               te.subject_name,
               te.subject_code,
               p.section_name,
               ts.label as slot_label,
               ts.start_time,
               ts.end_time,
               ts.slot_order,
               te.room_label
             FROM ap_timetable_entries te
             JOIN ap_timetable_plans p ON p.id = te.plan_id AND p.status = 'published'
             LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
             WHERE te.day_of_week = ? AND te.faculty_staff_link_id = ?
             ORDER BY COALESCE(ts.slot_order, 99), ts.start_time ASC, te.id ASC`,
            [dayCode, staff.staffLinkId],
          ).catch(() => [])
        : Promise.resolve([]),

      queryAcademic<
        (RowDataPacket & {
          id: number;
          day_of_week: string;
          subject_name: string | null;
          subject_code: string | null;
          entry_type: string;
          room_label: string | null;
          section_name: string | null;
          batch: string | null;
          semester_number: number | null;
          slot_label: string | null;
          start_time: string | null;
          end_time: string | null;
          slot_order: number | null;
        })[]
      >(
        `SELECT
           te.id,
           te.day_of_week,
           te.subject_name,
           te.subject_code,
           COALESCE(te.entry_type, 'theory') as entry_type,
           te.room_label,
           p.section_name,
           p.batch,
           p.semester_number,
           ts.label as slot_label,
           ts.start_time,
           ts.end_time,
           ts.slot_order
         FROM ap_timetable_entries te
         JOIN ap_timetable_plans p ON p.id = te.plan_id AND p.status = 'published'
         LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
         WHERE te.faculty_staff_link_id = ?
         ORDER BY FIELD(te.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'), COALESCE(ts.slot_order, 99), ts.start_time ASC, te.id ASC`,
        [staff.staffLinkId],
      ).catch(() => []),
    ]);

    // Build todaySlots (deduplicating duplicate/superseded plan sessions)
    if (todaySessions.length > 0) {
      const dedupMap = new Map<string, any>();
      for (const s of todaySessions) {
        const key = `${s.slot_label || s.start_time}_${s.subject_code || ""}_${s.section_name || ""}`;
        if (!dedupMap.has(key)) {
          dedupMap.set(key, s);
        } else {
          const existing = dedupMap.get(key);
          if (s.post_id && !existing.post_id) {
            dedupMap.set(key, s);
          }
        }
      }
      todaySlots = Array.from(dedupMap.values()).map((s, idx) => ({
        id: s.id,
        timingSlotId: s.timing_slot_id,
        slotLabel: s.slot_label || `Slot ${idx + 1}`,
        startTime: s.start_time,
        endTime: s.end_time,
        subjectName: s.subject_name || "Unassigned",
        subjectCode: s.subject_code,
        sectionName: s.section_name,
        status: s.status,
        isPosted: Boolean(s.post_id),
      }));
    } else if (masterToday.length > 0) {
      todaySlots = masterToday.map((m, idx) => ({
        id: m.id,
        slotLabel: m.slot_label || `P${idx + 1}`,
        startTime: m.start_time,
        endTime: m.end_time,
        subjectName: m.subject_name || "Unassigned",
        subjectCode: m.subject_code,
        sectionName: m.section_name,
        status: "scheduled",
        isPosted: false,
        roomLabel: m.room_label,
      }));
    }

    weeklyEntries = allWeekEntries;
  }

  // 5. Build weekly timetable grid and workload summary
  const weeklyTimetable: Record<string, any[]> = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
    SAT: [],
  };

  let theoryPeriods = 0;
  let labPeriods = 0;
  const subjectsMap = new Map<string, { subjectName: string; subjectCode: string | null; sectionName: string | null; periodsPerWeek: number; entryType: string }>();

  for (const entry of weeklyEntries) {
    const day = (entry.day_of_week || "").toUpperCase();
    if (weeklyTimetable[day]) {
      weeklyTimetable[day].push({
        id: entry.id,
        slotLabel: entry.slot_label || "Period",
        startTime: entry.start_time,
        endTime: entry.end_time,
        subjectName: entry.subject_name || "Subject",
        subjectCode: entry.subject_code,
        sectionName: entry.section_name,
        roomLabel: entry.room_label,
        entryType: entry.entry_type || "theory",
      });
    }

    if (entry.entry_type === "lab") labPeriods++;
    else theoryPeriods++;

    const subKey = `${entry.subject_name || "Subject"}_${entry.subject_code || ""}_${entry.section_name || ""}`;
    const existing = subjectsMap.get(subKey);
    if (!existing) {
      subjectsMap.set(subKey, {
        subjectName: entry.subject_name || "Subject",
        subjectCode: entry.subject_code,
        sectionName: entry.section_name,
        periodsPerWeek: 1,
        entryType: entry.entry_type || "theory",
      });
    } else {
      existing.periodsPerWeek++;
    }
  }

  const distinctSections = new Set(weeklyEntries.map((e) => e.section_name).filter(Boolean)).size;
  const workloadSummary = {
    totalWeeklyPeriods: weeklyEntries.length,
    theoryPeriods,
    labPeriods,
    totalSubjects: new Set(weeklyEntries.map((e) => e.subject_name).filter(Boolean)).size,
    totalSections: distinctSections,
  };

  // 6. Recent attendance history formatting
  const recentAttendance = recentDailyDocs.map((doc) => {
    const dStr = doc.date instanceof Date ? doc.date.toISOString().split("T")[0] : String(doc.date || "").split("T")[0];
    const dayOfW = dayCodeForDate(dStr);
    let s = "absent";
    if (doc.status === "P" || doc.status === "present") s = "present";
    else if (doc.odHours > 0) s = "od";
    else if (doc.permissionHours > 0) s = "permission";

    const sh = doc.shifts?.[0];
    return {
      date: dStr,
      dayOfWeek: dayOfW,
      status: s,
      checkInTime: formatISTTime(sh?.inTime),
      checkOutTime: formatISTTime(sh?.outTime),
      lateMinutes: Number(sh?.lateInMinutes || doc.totalLateInMinutes || 0),
    };
  });

  return {
    staff: {
      ...staff,
      email,
      phone,
      gender,
      dateOfJoining,
      qualification,
      experience,
    },
    date: selectedDate,
    dayOfWeek: dayCode,
    attendance: {
      status,
      displayStatus,
      checkInTime,
      checkOutTime,
      lateMinutes,
      thumbStatus,
      punchCount: punches.length,
      details,
      leaveType: leaveDoc?.leaveType || null,
      leaveReason: leaveDoc?.purpose || leaveDoc?.remarks || null,
      odPlace: odDoc?.placeVisited || odDoc?.purpose || null,
      punches,
      leaveRecord: leaveDoc
        ? {
            leaveType: leaveDoc.leaveType,
            fromDate: leaveDoc.fromDate,
            toDate: leaveDoc.toDate,
            numberOfDays: leaveDoc.numberOfDays || 1,
            purpose: leaveDoc.purpose || leaveDoc.remarks || null,
            status: leaveDoc.status,
          }
        : null,
      odRecord: odDoc
        ? {
            odType: odDoc.odType || "On Duty",
            fromDate: odDoc.fromDate,
            toDate: odDoc.toDate,
            placeVisited: odDoc.placeVisited || null,
            purpose: odDoc.purpose || null,
            status: odDoc.status,
          }
        : null,
      permissionRecord: permissionDoc
        ? {
            hours: permissionDoc.hours || 1,
            reason: permissionDoc.reason || null,
            status: permissionDoc.status,
          }
        : null,
    },
    todaySlots,
    todaySlotsCount: todaySlots.length,
    todayPostedSlotsCount: todaySlots.filter((s) => s.isPosted).length,
    todayPendingSlotsCount: todaySlots.filter((s) => !s.isPosted).length,
    teachingSubjects: Array.from(subjectsMap.values()),
    weeklyTimetable,
    workloadSummary,
    recentAttendance,
  };
}

