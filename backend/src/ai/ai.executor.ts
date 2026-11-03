import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { getCommandCenterSummary } from "../services/command-center.service.js";
import {
  getAttendanceAnalytics,
  getTodaySessionCounts,
  listAttendanceSessions,
} from "../services/attendance.service.js";
import { getStudentById, getStudentAttendance, listStudents } from "../services/students.service.js";
import { listFaculty, getFacultyDetail } from "../services/faculty.service.js";
import { listPendingRequests } from "../services/request-workflow.service.js";
import { listExaminations } from "../services/examinations.service.js";
import { getWorkloadSummary, getFacultyWorkloadDetail } from "../services/workload.service.js";
import { getStudentResults } from "../services/results.service.js";
import { getInternalMarksSubmissions } from "../services/internal-marks.service.js";
import { getMentoringDashboard } from "../services/mentoring.service.js";
import { getClassTeacherOverview } from "../services/class-teacher.service.js";
import { listCurriculum } from "../services/catalog.service.js";
import { listCustomHolidays } from "../services/student-academic-dates.service.js";
import { getAcademicMasters } from "../services/masters.service.js";
import { queryAcademic } from "../db/pools.js";
import { loadAuthzContext } from "../authz/authorization.service.js";
import type { RowDataPacket } from "mysql2";

export function logAi(action: string, detail: string, data?: unknown) {
  const ts = new Date().toLocaleTimeString();
  if (data !== undefined) {
    console.log(`[NemoAI ${ts}] ${action}: ${detail}`, typeof data === "object" ? JSON.stringify(data) : data);
  } else {
    console.log(`[NemoAI ${ts}] ${action}: ${detail}`);
  }
}

export interface ToolExecutionResult {
  status: number;
  data: unknown;
}

export async function executeAiTool(
  toolName: string,
  args: Record<string, unknown>,
  req: AuthedRequest,
  startTime: number
): Promise<ToolExecutionResult> {
  let user = req.authUser;
  let authz = req.authz;

  // Development fallback authentication when running without an active browser session
  if (!user && process.env.NODE_ENV !== "production") {
    try {
      type DevUserRow = RowDataPacket & {
        id: number;
        name: string;
        email: string;
        username: string;
        hrms_employee_id: string | null;
      };
      const devUsers = await queryAcademic<DevUserRow[]>(
        `SELECT u.id, u.name, u.email, u.username, u.hrms_employee_id
         FROM ap_users u
         INNER JOIN ap_user_roles ur ON ur.user_id = u.id
         INNER JOIN ap_roles r ON r.id = ur.role_id
         WHERE r.role_key IN ('super_admin', 'superadmin') AND u.is_active = 1
         ORDER BY u.id DESC LIMIT 1`
      );
      if (devUsers[0]) {
        const devUser = devUsers[0];
        user = {
          id: devUser.id,
          name: devUser.name,
          email: devUser.email,
          username: devUser.username,
          hrmsEmployeeId: devUser.hrms_employee_id ?? null,
          hrmsUserId: "",
          isActive: true,
        };
        authz = await loadAuthzContext(devUser.id);
        logAi("DEV_AUTH", `Development fallback: resolved Super Admin '${devUser.name}' (ID: ${devUser.id})`);
      }
    } catch (err) {
      logAi("DEV_AUTH_ERROR", "Failed to query dev super admin fallback", err);
    }
  }

  const userName = user?.name || "Unauthenticated";
  const userRole = authz?.roles?.map((r) => r.label).join(", ") || "None";
  logAi("EXECUTE", `POST /execute-tool -> Tool: '${toolName}' | User: ${userName} (${userRole}) | Args:`, args);

  if (!user) {
    logAi("UNAUTHORIZED", `Tool '${toolName}' rejected: No valid session token found`);
    return { status: 401, data: { error: "Authentication required" } };
  }

  switch (toolName) {
    // User Profile & Identity Tools
    case "get_user_profile":
    case "get_student_profile":
    case "get_my_profile":
    case "get_profile":
    case "get_my_details":
    case "fetch_student_profile":
    case "student_profile": {
      const isSuperAdmin = Boolean(
        authz?.roles?.some((r) => r.roleKey === "super_admin" || r.roleKey === "superadmin") ||
          authz?.scope?.isGlobal
      );
      const profileData = {
        id: user.id,
        name: user.name,
        full_name: user.name,
        username: user.username,
        email: user.email,
        hrms_employee_id: user.hrmsEmployeeId,
        hrms_user_id: user.hrmsUserId,
        primary_role: authz?.roles?.[0]?.label || (isSuperAdmin ? "Super Admin" : "Staff"),
        role_key: authz?.roles?.[0]?.roleKey || (isSuperAdmin ? "super_admin" : "staff"),
        all_roles: (authz?.roles || []).map((r) => r.label),
        is_super_admin: isSuperAdmin,
        scope: authz?.scope,
      };
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`, { name: user.name });
      return { status: 200, data: profileData };
    }

    case "get_command_center_summary": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const summary = await getCommandCenterSummary({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
      });
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: summary };
    }

    case "get_attendance_analytics": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const analytics = await getAttendanceAnalytics({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
      });
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: analytics };
    }

    case "get_today_attendance_summary": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const counts = await getTodaySessionCounts({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
      });
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: counts };
    }

    case "get_student_details": {
      const studentId = String(args.student_id ?? "").trim();
      if (!studentId) {
        logAi("BAD_REQUEST", `Tool '${toolName}': student_id is required`);
        return { status: 400, data: { error: "student_id is required" } };
      }
      const profile = await getStudentById(studentId);
      if (!profile) {
        logAi("NOT_FOUND", `Tool '${toolName}': Student '${studentId}' not found`);
        return { status: 404, data: { error: `Student '${studentId}' not found` } };
      }
      let attendance = null;
      try {
        attendance = await getStudentAttendance(String(profile.id));
      } catch {
        // Graceful fallback
      }
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: { profile, attendance } };
    }

    case "search_students": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const year = args.year != null ? Number(args.year) : undefined;
      const semester = args.semester != null ? Number(args.semester) : undefined;
      const limit = args.limit != null ? Math.min(50, Math.max(1, Number(args.limit))) : 15;

      const results = await listStudents({
        q: query || undefined,
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
        year: Number.isFinite(year) ? year : undefined,
        semester: Number.isFinite(semester) ? semester : undefined,
        limit,
      });
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${results.data.length} students found`);
      return { status: 200, data: results };
    }

    case "get_faculty_directory": {
      const departmentKey = typeof args.departmentKey === "string" ? args.departmentKey.trim() : undefined;
      const search = typeof args.search === "string" ? args.search.trim() : undefined;
      const facultyList = await listFaculty({
        department: departmentKey,
        search,
      });
      const facultyCount = facultyList.data?.length ?? 0;
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${facultyCount} faculty found`);
      return { status: 200, data: { faculty: facultyList } };
    }

    case "get_faculty_details": {
      const empId = String(args.hrms_employee_id ?? "").trim();
      if (!empId) {
        logAi("BAD_REQUEST", `Tool '${toolName}': hrms_employee_id is required`);
        return { status: 400, data: { error: "hrms_employee_id is required" } };
      }
      const faculty = await getFacultyDetail(empId);
      if (!faculty) {
        logAi("NOT_FOUND", `Tool '${toolName}': Faculty '${empId}' not found`);
        return { status: 404, data: { error: `Faculty '${empId}' not found` } };
      }
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: faculty };
    }

    case "get_pending_requests": {
      if (!authz) {
        logAi("FORBIDDEN", `Tool '${toolName}': Authorization context required`);
        return { status: 403, data: { error: "Authorization context required" } };
      }
      const pending = await listPendingRequests(authz);
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${pending.length} pending requests`);
      return { status: 200, data: { pendingRequests: pending } };
    }

    case "get_active_examinations": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const exams = await listExaminations({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
      });
      const examCount = exams.count ?? exams.data?.length ?? 0;
      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${examCount} exams`);
      return { status: 200, data: { examinations: exams } };
    }

    case "get_today_timetable": {
      const today = new Date().toISOString().slice(0, 10);
      const date = typeof args.date === "string" && args.date.trim() ? args.date.trim() : today;
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      let sessions = await listAttendanceSessions({
        date,
        generate: false,
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
      });

      if ((!sessions.data || sessions.data.length === 0) && (collegeId || branchId)) {
        sessions = await listAttendanceSessions({
          date,
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
          branchId: Number.isFinite(branchId) ? branchId : undefined,
        });
      }

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: sessions };
    }

    case "get_faculty_workload_summary": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : (authz?.scope?.collegeIds?.[0] ?? undefined);
      const branchId = args.branchId != null ? Number(args.branchId) : (authz?.scope?.branchIds?.[0] ?? undefined);
      const department = typeof args.department === "string" ? args.department.trim() : undefined;
      const search = typeof args.search === "string" ? args.search.trim() : undefined;
      const statusFilter = typeof args.status === "string" ? args.status.trim().toLowerCase() : undefined;
      const limit = args.limit != null ? Math.min(50, Math.max(1, Number(args.limit))) : 20;

      const summary = await getWorkloadSummary({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
        department,
        search,
      });

      let facultyList = summary.faculty;
      if (statusFilter) {
        facultyList = facultyList.filter((f) => f.status.toLowerCase() === statusFilter);
      }

      const totalMatched = facultyList.length;
      const topFaculty = facultyList.slice(0, limit);

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${totalMatched} matched`);
      return {
        status: 200,
        data: {
          kpis: summary.kpis,
          thresholds: summary.thresholds,
          totalFacultyMatched: totalMatched,
          faculty: topFaculty,
        },
      };
    }

    case "get_faculty_workload_detail": {
      const rawFacultyId = String(args.faculty_id ?? "").trim();
      if (!rawFacultyId) {
        logAi("BAD_REQUEST", `Tool '${toolName}': faculty_id is required`);
        return { status: 400, data: { error: "faculty_id is required" } };
      }

      let resolvedStaffLinkId: number | null = Number.isFinite(Number(rawFacultyId)) ? Number(rawFacultyId) : null;

      // Look up staff link if it's an HRMS employee ID or code or name
      const staffRows = await queryAcademic<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM ap_staff_link 
         WHERE id = ? OR hrms_employee_id = ? OR employee_code = ? OR display_name LIKE ?
         LIMIT 1`,
        [rawFacultyId, rawFacultyId, rawFacultyId, `%${rawFacultyId}%`]
      );
      if (staffRows[0]) {
        resolvedStaffLinkId = staffRows[0].id;
      }

      if (!resolvedStaffLinkId) {
        logAi("NOT_FOUND", `Tool '${toolName}': Faculty '${rawFacultyId}' not found`);
        return { status: 404, data: { error: `Faculty '${rawFacultyId}' not found` } };
      }

      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const detail = await getFacultyWorkloadDetail(String(resolvedStaffLinkId), {
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
      });

      if (!detail) {
        logAi("NOT_FOUND", `Tool '${toolName}': Workload schedule for faculty '${rawFacultyId}' not found`);
        return { status: 404, data: { error: `Workload schedule for faculty '${rawFacultyId}' not found` } };
      }

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: detail };
    }

    case "get_student_academic_results": {
      const rollNumber = String(args.roll_number ?? args.student_id ?? "").trim();
      if (!rollNumber) {
        logAi("BAD_REQUEST", `Tool '${toolName}': roll_number is required`);
        return { status: 400, data: { error: "roll_number is required" } };
      }

      const results = await getStudentResults(rollNumber);
      if (!results) {
        logAi("NOT_FOUND", `Tool '${toolName}': No exam results found for student '${rollNumber}'`);
        return { status: 404, data: { error: `No exam results found for student '${rollNumber}'` } };
      }

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return { status: 200, data: results };
    }

    case "get_internal_marks_submissions": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const courseId = args.courseId != null ? Number(args.courseId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const subjectId = args.subjectId != null ? Number(args.subjectId) : undefined;
      const status = typeof args.status === "string" ? (args.status as any) : undefined;

      const submissions = await getInternalMarksSubmissions({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        courseId: Number.isFinite(courseId) ? courseId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
        subjectId: Number.isFinite(subjectId) ? subjectId : undefined,
        status,
      });

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${submissions.length} submissions`);
      return {
        status: 200,
        data: {
          totalCount: submissions.length,
          submissions: submissions.slice(0, 30),
        },
      };
    }

    case "get_mentoring_cases": {
      if (!authz) {
        return { status: 403, data: { error: "Authorization context required" } };
      }
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const year = args.year != null ? Number(args.year) : undefined;
      const risk = typeof args.riskLevel === "string" ? (args.riskLevel as "High" | "Medium" | "Low") : undefined;

      try {
        const mentoring = await getMentoringDashboard(authz, {
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
          branchId: Number.isFinite(branchId) ? branchId : undefined,
          year: Number.isFinite(year) ? year : undefined,
          risk: risk || "all",
          limit: 30,
        });

        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        return { status: 200, data: mentoring };
      } catch (err: any) {
        logAi("ERROR", `Tool '${toolName}' error`, err?.message);
        return { status: 200, data: { summary: null, message: err?.message || "Mentoring access restricted" } };
      }
    }

    case "get_class_teacher_directory": {
      if (!authz) {
        return { status: 403, data: { error: "Authorization context required" } };
      }
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const courseId = args.courseId != null ? Number(args.courseId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const academicYear = typeof args.academicYear === "string" ? args.academicYear.trim() : undefined;

      const overview = await getClassTeacherOverview(authz, {
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        courseId: Number.isFinite(courseId) ? courseId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
        academicYear,
      });

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return {
        status: 200,
        data: {
          academicYear: overview.academicYear,
          summary: overview.summary,
          colleges: overview.colleges,
          sections: overview.sections.slice(0, 50),
        },
      };
    }

    case "get_curriculum_subjects": {
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
      const courseId = args.courseId != null ? Number(args.courseId) : undefined;
      const branchId = args.branchId != null ? Number(args.branchId) : undefined;
      const batch = typeof args.batch === "string" ? args.batch.trim() : undefined;
      const year = args.year != null ? Number(args.year) : undefined;
      const semester = args.semester != null ? Number(args.semester) : undefined;

      const curriculum = await listCurriculum({
        collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        courseId: Number.isFinite(courseId) ? courseId : undefined,
        branchId: Number.isFinite(branchId) ? branchId : undefined,
        batch,
        year: Number.isFinite(year) ? year : undefined,
        semester: Number.isFinite(semester) ? semester : undefined,
      });

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${curriculum.total} subjects`);
      return {
        status: 200,
        data: {
          totalSubjects: curriculum.total,
          subjects: curriculum.rows,
        },
      };
    }

    case "get_academic_calendar": {
      const today = new Date();
      const defaultStart = new Date(today);
      defaultStart.setMonth(defaultStart.getMonth() - 1);
      const defaultEnd = new Date(today);
      defaultEnd.setMonth(defaultEnd.getMonth() + 6);

      const startDate = typeof args.startDate === "string" && args.startDate.trim() ? args.startDate.trim() : defaultStart.toISOString().slice(0, 10);
      const endDate = typeof args.endDate === "string" && args.endDate.trim() ? args.endDate.trim() : defaultEnd.toISOString().slice(0, 10);

      const holidays = await listCustomHolidays({
        startDate,
        endDate,
      });

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${holidays.length} holidays`);
      return {
        status: 200,
        data: {
          startDate,
          endDate,
          holidaysCount: holidays.length,
          holidays,
        },
      };
    }

    case "get_institutional_catalog": {
      const masters = await getAcademicMasters();
      const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;

      const filteredColleges = Number.isFinite(collegeId)
        ? masters.colleges.filter((c) => c.id === collegeId)
        : masters.colleges;

      const filteredCourses = Number.isFinite(collegeId)
        ? masters.courses.filter((cr) => cr.collegeId === collegeId)
        : masters.courses;

      const courseIds = new Set(filteredCourses.map((cr) => cr.id));
      const filteredBranches = Number.isFinite(collegeId)
        ? masters.branches.filter((b) => courseIds.has(b.courseId))
        : masters.branches;

      logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
      return {
        status: 200,
        data: {
          colleges: filteredColleges,
          academicYears: masters.academicYears,
          courses: filteredCourses,
          branches: filteredBranches,
        },
      };
    }

    default:
      logAi("NOT_IMPLEMENTED", `Tool '${toolName}' not found or unsupported`);
      return { status: 404, data: { error: `Tool '${toolName}' not found or not supported` } };
  }
}
