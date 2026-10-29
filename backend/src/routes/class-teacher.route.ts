import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import {
  ensureEntityScope,
  getAuthz,
  requirePermission,
  scopedFilters,
} from "../authz/require-permission.js";
import {
  getClassTeacherDashboardData,
  getClassTeacherOverview,
  getClassTeacherForSection,
  assignClassTeacherToSection,
  unassignClassTeacherFromSection,
  listClassTeacherFacultyOptions,
} from "../services/class-teacher.service.js";

export const classTeacherRouter = Router();

function optionalNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  if (value === "" || value === "all") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "all") return undefined;
  return trimmed;
}

classTeacherRouter.get("/dashboard", requirePermission("dashboard.view"), async (req: AuthedRequest, res, next) => {
  try {
    const section = typeof req.query.section === "string" ? req.query.section : undefined;
    const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const branchId = optionalNumber(req.query.branchId);
    const collegeId = optionalNumber(req.query.collegeId);

    const data = await getClassTeacherDashboardData(getAuthz(req), {
      section,
      academicYear,
      date,
      branchId,
      collegeId,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

classTeacherRouter.get(
  "/assignments",
  requirePermission("timetable.view", "mentoring.view", "dashboard.view", "students.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const scoped = scopedFilters(req, {
        collegeId: optionalNumber(req.query.collegeId),
        branchId: optionalNumber(req.query.branchId),
      });

      const filters = {
        academicYear: optionalString(req.query.academicYear),
        collegeId: scoped.collegeId,
        collegeIds: scoped.collegeIds,
        courseId: optionalNumber(req.query.courseId),
        branchId: scoped.branchId,
        branchIds: scoped.branchIds,
        batch: optionalString(req.query.batch),
        year: optionalNumber(req.query.year),
        semester: optionalNumber(req.query.semester),
        section: optionalString(req.query.section),
        status: optionalString(req.query.status) as any,
        searchQuery: typeof req.query.q === "string" ? req.query.q : undefined,
      };

      const data = await getClassTeacherOverview(getAuthz(req), filters);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

classTeacherRouter.get(
  "/section",
  requirePermission("timetable.view", "mentoring.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const branchId = optionalNumber(req.query.branchId);
      const batch = optionalString(req.query.batch);
      const year = optionalNumber(req.query.year);
      const semester = optionalNumber(req.query.semester);
      const section = optionalString(req.query.section);
      const academicYear = optionalString(req.query.academicYear);

      const classTeacher = await getClassTeacherForSection({
        branchId,
        batch,
        year,
        semester,
        section,
        academicYear,
      });

      res.json({ data: classTeacher });
    } catch (error) {
      next(error);
    }
  },
);

classTeacherRouter.get(
  "/faculty-options",
  requirePermission("timetable.view", "mentoring.view", "dashboard.view"),
  async (_req: AuthedRequest, res, next) => {
    try {
      const data = await listClassTeacherFacultyOptions();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

classTeacherRouter.post(
  "/assign",
  requirePermission("timetable.edit", "mentoring.assign", "mentoring.manage"),
  async (req: AuthedRequest, res, next) => {
    try {
      const body = req.body || {};
      const collegeId = optionalNumber(body.collegeId);
      const branchId = optionalNumber(body.branchId);
      if (collegeId != null || branchId != null) {
        ensureEntityScope(req, { collegeId, branchId });
      }

      const result = await assignClassTeacherToSection(getAuthz(req), {
        facultyStaffLinkId: optionalNumber(body.facultyStaffLinkId),
        hrmsEmployeeId: typeof body.hrmsEmployeeId === "string" ? body.hrmsEmployeeId.trim() : undefined,
        facultyName: typeof body.facultyName === "string" ? body.facultyName.trim() : undefined,
        departmentName: typeof body.departmentName === "string" ? body.departmentName.trim() : undefined,
        collegeId: Number(body.collegeId),
        courseId: optionalNumber(body.courseId),
        branchId: Number(body.branchId),
        batch: String(body.batch || ""),
        year: optionalNumber(body.year),
        semester: optionalNumber(body.semester),
        sectionName: String(body.sectionName || "A"),
        academicYearLabel: typeof body.academicYearLabel === "string" ? body.academicYearLabel.trim() : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        ipAddress: req.ip,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

classTeacherRouter.post(
  "/unassign",
  requirePermission("timetable.edit", "mentoring.assign", "mentoring.manage"),
  async (req: AuthedRequest, res, next) => {
    try {
      const body = req.body || {};
      const collegeId = optionalNumber(body.collegeId);
      const branchId = optionalNumber(body.branchId);
      if (collegeId != null || branchId != null) {
        ensureEntityScope(req, { collegeId, branchId });
      }

      const result = await unassignClassTeacherFromSection(getAuthz(req), {
        collegeId: optionalNumber(body.collegeId),
        branchId: Number(body.branchId),
        batch: String(body.batch || ""),
        year: optionalNumber(body.year),
        semester: optionalNumber(body.semester),
        sectionName: String(body.sectionName || "A"),
        academicYearLabel: typeof body.academicYearLabel === "string" ? body.academicYearLabel.trim() : undefined,
        ipAddress: req.ip,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);
