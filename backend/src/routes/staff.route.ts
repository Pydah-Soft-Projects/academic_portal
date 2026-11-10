import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { allowedCollegeNames } from "../authz/academic-entity-scope.js";
import {
  getAuthz,
  requirePermission,
  statusFromAuthzError,
} from "../authz/require-permission.js";
import { getStaffOverview } from "../services/staff.service.js";
import {
  getStaffDetailedProfile,
  getStaffMonthlyCalendar,
  updateStaffPersonalDetails,
  getStaffAchievements,
  createStaffAchievement,
  reviewStaffAchievement,
  deleteStaffAchievement,
  createStaffSemesterRole,
  deleteStaffSemesterRole,
  uploadStaffDocument,
  verifyStaffDocument,
  deleteStaffDocument,
} from "../services/staff-profile.service.js";

export const staffRouter = Router();

function str(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value.trim();
}

function num(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  if (value === "" || value === "all") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function scopedCollegeNames(req: AuthedRequest): Promise<string[] | undefined> {
  const names = await allowedCollegeNames(getAuthz(req));
  return names == null ? undefined : names;
}

// GET /api/staff - Overview of all staff with designations, subjects teaching, daily slots, and attendance status
staffRouter.get(
  "/",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeNames = await scopedCollegeNames(req);
      const data = await getStaffOverview({
        date: str(req.query.date),
        search: str(req.query.search || req.query.q),
        department: str(req.query.department),
        division: str(req.query.division),
        designation: str(req.query.designation),
        status: str(req.query.status),
        hasSlots: (str(req.query.hasSlots) ?? "all") as "all" | "yes" | "no",
        collegeNames,
        page: num(req.query.page),
        pageSize: num(req.query.pageSize),
      });

      res.json(data);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  },
);

// GET /api/staff/:id - Full details for a single staff member
staffRouter.get(
  "/:id",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view", "my_timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeNames = await scopedCollegeNames(req);
      let id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (id === "me" || !id) {
        id = req.authUser?.hrmsEmployeeId || req.authUser?.username || String(req.authUser?.id);
      }
      const detail = await getStaffDetailedProfile(id, {
        date: str(req.query.date),
        collegeNames,
      });

      if (!detail) {
        res.status(404).json({ message: "Staff member not found" });
        return;
      }

      res.json(detail);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  },
);

// GET /api/staff/:id/calendar - Monthly attendance & teaching drilldown
staffRouter.get(
  "/:id/calendar",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view", "my_timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeNames = await scopedCollegeNames(req);
      let id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (id === "me" || !id) {
        id = req.authUser?.hrmsEmployeeId || req.authUser?.username || String(req.authUser?.id);
      }
      const month = str(req.query.month);
      const data = await getStaffMonthlyCalendar(id, month, collegeNames);
      if (!data) {
        res.status(404).json({ message: "Staff member not found" });
        return;
      }
      res.json(data);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  },
);

// PUT /api/staff/:id/personal-details - Update personal and employment details
staffRouter.put(
  "/:id/personal-details",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view", "my_timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      let id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (id === "me" || !id) {
        id = req.authUser?.hrmsEmployeeId || req.authUser?.username || String(req.authUser?.id);
      }
      await updateStaffPersonalDetails(id, req.body, req.authUser?.id);
      res.json({ success: true, message: "Personal details updated successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/staff/:id/achievements - Fetch staff achievements and approvals
staffRouter.get(
  "/:id/achievements",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view", "my_timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      let id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (id === "me" || !id) {
        id = req.authUser?.hrmsEmployeeId || req.authUser?.username || String(req.authUser?.id);
      }
      const data = await getStaffAchievements(id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/staff/:id/achievements - Add a certification or achievement
staffRouter.post(
  "/:id/achievements",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view", "my_timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      let id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (id === "me" || !id) {
        id = req.authUser?.hrmsEmployeeId || req.authUser?.username || String(req.authUser?.id);
      }
      const achievementId = await createStaffAchievement(
        id,
        req.body,
        req.authUser?.id,
        req.authUser?.name || "Staff Member",
      );
      res.status(201).json({ success: true, achievementId, message: "Achievement submitted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/staff/:id/achievements/:achievementId/review - HOD / Principal review
staffRouter.post(
  "/:id/achievements/:achievementId/review",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const achId = Number(req.params.achievementId);
      const isPrincipal = req.authz?.roleKeys?.includes("principal") || req.authz?.roleKeys?.includes("superadmin");
      const actorRole = isPrincipal ? "principal" : "hod";

      await reviewStaffAchievement(
        achId,
        req.body,
        req.authUser?.id || 1,
        req.authUser?.name || (isPrincipal ? "Principal" : "HOD"),
        actorRole,
      );
      res.json({ success: true, message: "Achievement review updated successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/staff/:id/achievements/:achievementId - Delete achievement
staffRouter.delete(
  "/:id/achievements/:achievementId",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view", "my_timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const achId = Number(req.params.achievementId);
      await deleteStaffAchievement(achId, req.authUser?.id);
      res.json({ success: true, message: "Achievement deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/staff/:id/roles - Assign semester-wise role
staffRouter.post(
  "/:id/roles",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const roleId = await createStaffSemesterRole(id, req.body, req.authUser?.id);
      res.status(201).json({ success: true, roleId, message: "Semester role assigned successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/staff/:id/roles/:roleId - Delete semester role
staffRouter.delete(
  "/:id/roles/:roleId",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const roleId = Number(req.params.roleId);
      await deleteStaffSemesterRole(roleId);
      res.json({ success: true, message: "Semester role removed successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/staff/:id/documents - Upload staff document
staffRouter.post(
  "/:id/documents",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const docId = await uploadStaffDocument(id, req.body, req.authUser?.id);
      res.status(201).json({ success: true, docId, message: "Document uploaded successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/staff/:id/documents/:docId/verify - Verify staff document
staffRouter.post(
  "/:id/documents/:docId/verify",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const docId = Number(req.params.docId);
      await verifyStaffDocument(docId, req.authUser?.name || "Verified Official", req.authUser?.id);
      res.json({ success: true, message: "Document marked as verified" });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/staff/:id/documents/:docId - Delete staff document
staffRouter.delete(
  "/:id/documents/:docId",
  requirePermission("faculty.view", "students.view", "workload.view", "dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const docId = Number(req.params.docId);
      await deleteStaffDocument(docId);
      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

