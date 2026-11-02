import { Router } from "express";
import type { Request, Response } from "express";
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
import { queryAcademic } from "../db/pools.js";
import { loadAuthzContext } from "../authz/authorization.service.js";
import type { RowDataPacket } from "mysql2";

export const aiRouter = Router();

function logAi(action: string, detail: string, data?: unknown) {
  const ts = new Date().toLocaleTimeString();
  if (data !== undefined) {
    console.log(`[NemoAI ${ts}] ${action}: ${detail}`, typeof data === "object" ? JSON.stringify(data) : data);
  } else {
    console.log(`[NemoAI ${ts}] ${action}: ${detail}`);
  }
}

const SUPER_ADMIN_TOOLS = [
  {
    name: "get_user_profile",
    description:
      "Fetch personal profile and identity of the currently logged-in user, including full name, username, email, HRMS employee ID, and assigned roles.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_command_center_summary",
    description:
      "Fetch high-level Academic Portal command center summary: total active students, faculty count, section count, timetables published, attendance percentages, students below threshold, open risk cases, active exams, and classes today.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID to filter stats.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID to filter stats.",
        },
      },
    },
  },
  {
    name: "get_attendance_analytics",
    description:
      "Fetch overall attendance statistics, risk band distribution, and count of students below attendance threshold.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
      },
    },
  },
  {
    name: "get_today_attendance_summary",
    description:
      "Fetch today's scheduled, posted, and pending attendance session counts.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
      },
    },
  },
  {
    name: "get_student_details",
    description:
      "Fetch detailed student profile and attendance record by student ID or roll number / admission number.",
    parameters: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Student ID or admission number (e.g. '1234' or '22PY1A0584').",
        },
      },
      required: ["student_id"],
    },
  },
  {
    name: "search_students",
    description:
      "Search or list students filtered by query (name or admission number), branch, semester, or college.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Student name or admission/pin number to search.",
        },
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        year: {
          type: "number",
          description: "Year of study (1, 2, 3, 4).",
        },
        semester: {
          type: "number",
          description: "Semester number (1, 2).",
        },
        limit: {
          type: "number",
          description: "Maximum students to return (default 15).",
        },
      },
    },
  },
  {
    name: "get_faculty_directory",
    description:
      "List faculty members with optional filters for department or keyword.",
    parameters: {
      type: "object",
      properties: {
        departmentKey: {
          type: "string",
          description: "Optional department key (e.g., 'cse', 'ece').",
        },
        search: {
          type: "string",
          description: "Optional faculty name or designation search query.",
        },
      },
    },
  },
  {
    name: "get_faculty_details",
    description:
      "Fetch detailed faculty profile, contact info, department, and assigned courses by HRMS employee ID.",
    parameters: {
      type: "object",
      properties: {
        hrms_employee_id: {
          type: "string",
          description: "HRMS employee ID of the faculty member (e.g. 'PYD0123').",
        },
      },
      required: ["hrms_employee_id"],
    },
  },
  {
    name: "get_pending_requests",
    description:
      "Fetch pending approval requests across the portal (leaves, faculty substitutions, timetable changes) awaiting administrative review.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_active_examinations",
    description:
      "Fetch active and upcoming examinations, exam schedules, and registration details.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
      },
    },
  },
  {
    name: "get_today_timetable",
    description:
      "Fetch today's scheduled class timetable, periods, room assignments, and substitutions.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        date: {
          type: "string",
          description: "Optional date in 'YYYY-MM-DD' format (defaults to today).",
        },
      },
    },
  },
];

function handleDiscovery(req: Request, res: Response) {
  const authedReq = req as AuthedRequest;
  const userName = authedReq.authUser?.name || "Anonymous";
  const userRole = authedReq.authz?.roles?.map((r) => r.label).join(", ") || "None";
  logAi("DISCOVERY", `GET /ai-tools from ${req.ip} | User: ${userName} | Roles: [${userRole}] | Offering ${SUPER_ADMIN_TOOLS.length} tools`);
  res.json({ tools: SUPER_ADMIN_TOOLS });
}

async function handleExecution(req: AuthedRequest, res: Response) {
  const startTime = Date.now();
  const rawToolName =
    (req.body?.tool_name as string) ||
    (req.body?.function_name as string) ||
    "";
  const toolName = rawToolName.includes(":") ? rawToolName.split(":").pop()!.trim() : rawToolName.trim();
  const args = (req.body?.arguments as Record<string, unknown>) || {};
  let user = req.authUser;
  let authz = req.authz;

  let devAuthError = "";
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
        user = {
          id: devUsers[0].id,
          name: devUsers[0].name,
          email: devUsers[0].email,
          username: devUsers[0].username,
          hrmsEmployeeId: devUsers[0].hrms_employee_id ?? undefined,
        };
        authz = await loadAuthzContext(user.id);
        logAi("DEV_AUTH", `Development fallback: resolved Super Admin '${user.name}' (ID: ${user.id})`);
      } else {
        devAuthError = "devUsers query returned 0 rows";
      }
    } catch (err) {
      devAuthError = (err as Error).message;
      logAi("DEV_AUTH_ERROR", "Failed to query dev super admin fallback", err);
    }
  }

  const userName = user?.name || "Unauthenticated";
  const userRole = authz?.roles?.map((r) => r.label).join(", ") || "None";

  logAi("EXECUTE", `POST /execute-tool -> Tool: '${toolName}' | User: ${userName} (${userRole}) | Args:`, args);

  try {
    if (!user) {
      logAi("UNAUTHORIZED", `Tool '${toolName}' rejected: No valid session token found`);
      res.status(401).json({ error: "Authentication required" });
      return;
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
        const profileData = {
          id: user.id,
          name: user.name,
          full_name: user.name,
          username: user.username,
          email: user.email,
          hrms_employee_id: user.hrmsEmployeeId,
          hrms_user_id: user.hrmsUserId,
          primary_role: authz?.roles?.[0]?.label || "Super Admin",
          role_key: authz?.roles?.[0]?.roleKey || "super_admin",
          all_roles: (authz?.roles || []).map((r) => r.label),
          is_super_admin: true,
          scope: authz?.scope,
        };
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`, { name: user.name });
        res.json(profileData);
        return;
      }

      case "get_command_center_summary": {
        const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
        const branchId = args.branchId != null ? Number(args.branchId) : undefined;
        const summary = await getCommandCenterSummary({
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
          branchId: Number.isFinite(branchId) ? branchId : undefined,
        });
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        res.json(summary);
        return;
      }

      case "get_attendance_analytics": {
        const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
        const branchId = args.branchId != null ? Number(args.branchId) : undefined;
        const analytics = await getAttendanceAnalytics({
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
          branchId: Number.isFinite(branchId) ? branchId : undefined,
        });
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        res.json(analytics);
        return;
      }

      case "get_today_attendance_summary": {
        const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
        const branchId = args.branchId != null ? Number(args.branchId) : undefined;
        const counts = await getTodaySessionCounts({
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
          branchId: Number.isFinite(branchId) ? branchId : undefined,
        });
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        res.json(counts);
        return;
      }

      case "get_student_details": {
        const studentId = String(args.student_id ?? "").trim();
        if (!studentId) {
          logAi("BAD_REQUEST", `Tool '${toolName}': student_id is required`);
          res.status(400).json({ error: "student_id is required" });
          return;
        }
        const profile = await getStudentById(studentId);
        if (!profile) {
          logAi("NOT_FOUND", `Tool '${toolName}': Student '${studentId}' not found`);
          res.status(404).json({ error: `Student '${studentId}' not found` });
          return;
        }
        let attendance = null;
        try {
          attendance = await getStudentAttendance(String(profile.id));
        } catch {
          // Graceful fallback
        }
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        res.json({ profile, attendance });
        return;
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
        res.json(results);
        return;
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
        res.json({ faculty: facultyList });
        return;
      }

      case "get_faculty_details": {
        const empId = String(args.hrms_employee_id ?? "").trim();
        if (!empId) {
          logAi("BAD_REQUEST", `Tool '${toolName}': hrms_employee_id is required`);
          res.status(400).json({ error: "hrms_employee_id is required" });
          return;
        }
        const faculty = await getFacultyDetail(empId);
        if (!faculty) {
          logAi("NOT_FOUND", `Tool '${toolName}': Faculty '${empId}' not found`);
          res.status(404).json({ error: `Faculty '${empId}' not found` });
          return;
        }
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        res.json(faculty);
        return;
      }

      case "get_pending_requests": {
        if (!authz) {
          logAi("FORBIDDEN", `Tool '${toolName}': Authorization context required`);
          res.status(403).json({ error: "Authorization context required" });
          return;
        }
        const pending = await listPendingRequests(authz);
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${pending.length} pending requests`);
        res.json({ pendingRequests: pending });
        return;
      }

      case "get_active_examinations": {
        const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
        const exams = await listExaminations({
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
        });
        const examCount = exams.count ?? exams.data?.length ?? 0;
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms -> ${examCount} exams`);
        res.json({ examinations: exams });
        return;
      }

      case "get_today_timetable": {
        const today = new Date().toISOString().slice(0, 10);
        const date = typeof args.date === "string" && args.date.trim() ? args.date.trim() : today;
        const collegeId = args.collegeId != null ? Number(args.collegeId) : undefined;
        const branchId = args.branchId != null ? Number(args.branchId) : undefined;
        const sessions = await listAttendanceSessions({
          date,
          collegeId: Number.isFinite(collegeId) ? collegeId : undefined,
          branchId: Number.isFinite(branchId) ? branchId : undefined,
        });
        logAi("SUCCESS", `Tool '${toolName}' finished in ${Date.now() - startTime}ms`);
        res.json(sessions);
        return;
      }

      default:
        logAi("NOT_IMPLEMENTED", `Tool '${toolName}' not found or unsupported`);
        res.status(404).json({ error: `Tool '${toolName}' not found or not supported` });
        return;
    }
  } catch (error) {
    logAi("ERROR", `Tool '${toolName}' failed with exception: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message || "Failed to execute tool" });
  }
}

aiRouter.get("/", handleDiscovery);
aiRouter.get("/ai-tools", handleDiscovery);
aiRouter.get("/tools", handleDiscovery);

aiRouter.post("/", handleExecution);
aiRouter.post("/execute-tool", handleExecution);
