import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { requirePermission } from "../authz/require-permission.js";
import {
  getFacultyDisplaySettings,
  setFacultyEnabledGroups,
} from "../services/portal-settings.service.js";
import {
  getWorkloadThresholdSettings,
  saveWorkloadThresholdSettings,
} from "../services/workload-thresholds.service.js";
import {
  getComplaintTypes,
  saveComplaintTypes,
} from "../services/complaint-types.service.js";
import {
  listFeedbackForms,
  getFeedbackForm,
  createFeedbackForm,
  updateFeedbackForm,
  deleteFeedbackForm,
  listFeedbackPublications,
  createFeedbackPublication,
  updateFeedbackPublication,
  deleteFeedbackPublication,
  getFeedbackReportData,
  submitFeedbackResponse,
  getStaffSubjectsForScope,
} from "../services/feedback-forms.service.js";
import { writeAuditLog } from "../services/audit.service.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/faculty-display",
  requirePermission("settings.view"),
  async (_req, res, next) => {
    try {
      res.json(await getFacultyDisplaySettings());
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.put(
  "/faculty-display",
  requirePermission("settings.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      const raw = req.body?.enabledGroupIds;
      if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string")) {
        res.status(400).json({
          message: "enabledGroupIds (string[]) is required",
        });
        return;
      }
      const previous = await getFacultyDisplaySettings();
      const updated = await setFacultyEnabledGroups(raw);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.faculty_display_updated",
        entityType: "ap_portal_settings",
        entityId: null,
        oldValue: {
          enabledGroupIds: previous.groups.filter((g) => g.enabled).map((g) => g.id),
        },
        newValue: {
          enabledGroupIds: raw,
        },
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.get(
  "/workload-thresholds",
  requirePermission("settings.view"),
  async (req, res, next) => {
    try {
      const collegeId =
        req.query.collegeId == null || req.query.collegeId === ""
          ? null
          : Number(req.query.collegeId);
      res.json(
        await getWorkloadThresholdSettings(
          Number.isFinite(collegeId) && collegeId! > 0 ? collegeId : null,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.put(
  "/workload-thresholds",
  requirePermission("settings.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId =
        req.body?.collegeId == null || req.body?.collegeId === ""
          ? null
          : Number(req.body.collegeId);
      const previous = await getWorkloadThresholdSettings(
        Number.isFinite(collegeId) && collegeId! > 0 ? collegeId : null,
      );
      const updated = await saveWorkloadThresholdSettings({
        collegeId: Number.isFinite(collegeId) && collegeId! > 0 ? collegeId : null,
        minPeriodsPerWeek: Number(req.body?.minPeriodsPerWeek),
        maxPeriodsPerWeek: Number(req.body?.maxPeriodsPerWeek),
        maxPeriodsPerDay: Number(req.body?.maxPeriodsPerDay),
        minHoursPerWeek: req.body?.minHoursPerWeek,
        maxHoursPerWeek: req.body?.maxHoursPerWeek,
      });
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.workload_thresholds_updated",
        entityType: "ap_workload_thresholds",
        entityId: null,
        oldValue: previous.thresholds,
        newValue: updated.thresholds,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      const status = Number((error as { status?: number }).status);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  },
);

settingsRouter.get(
  "/complaint-types",
  requirePermission("settings.view"),
  async (_req, res, next) => {
    try {
      res.json(await getComplaintTypes());
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.put(
  "/complaint-types",
  requirePermission("settings.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      const types = Array.isArray(req.body?.types) ? req.body.types : [];
      const updated = await saveComplaintTypes(types);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.complaint_types_updated",
        entityType: "ap_complaint_types",
        entityId: null,
        oldValue: {},
        newValue: { types },
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.get(
  "/feedback-forms",
  requirePermission("settings.view", "reports.view"),
  async (_req, res, next) => {
    try {
      res.json(await listFeedbackForms());
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.get(
  "/feedback-publications",
  requirePermission("reports.view", "settings.view", "today_timetable.view"),
  async (_req, res, next) => {
    try {
      res.json(await listFeedbackPublications());
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.post(
  "/feedback-publications",
  requirePermission("settings.edit", "reports.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const created = await createFeedbackPublication(req.body, req.authUser?.id);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.feedback_publication_created",
        entityType: "ap_feedback_publications",
        entityId: created.id,
        oldValue: {},
        newValue: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error) {
      const status = Number((error as { status?: number }).status);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  },
);

settingsRouter.put(
  "/feedback-publications/:id",
  requirePermission("settings.edit", "reports.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid publication ID" });
        return;
      }
      const updated = await updateFeedbackPublication(id, req.body);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.feedback_publication_updated",
        entityType: "ap_feedback_publications",
        entityId: id,
        oldValue: {},
        newValue: updated,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.delete(
  "/feedback-publications/:id",
  requirePermission("settings.edit", "reports.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid publication ID" });
        return;
      }
      await deleteFeedbackPublication(id);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.feedback_publication_deleted",
        entityType: "ap_feedback_publications",
        entityId: id,
        oldValue: {},
        newValue: {},
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Publication deleted" });
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.post(
  "/feedback-publications/:id/submit",
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid publication ID" });
        return;
      }
      const result = await submitFeedbackResponse(id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.get(
  "/feedback-forms/staff-subjects",
  requirePermission("reports.view", "settings.view", "today_timetable.view"),
  async (req, res, next) => {
    try {
      const collegeId = req.query.collegeId ? Number(req.query.collegeId) : undefined;
      const collegeIds = typeof req.query.collegeIds === "string"
        ? req.query.collegeIds.split(",").map(Number).filter(Boolean)
        : undefined;
      const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
      const courseIds = typeof req.query.courseIds === "string"
        ? req.query.courseIds.split(",").map(Number).filter(Boolean)
        : undefined;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const branchIds = typeof req.query.branchIds === "string"
        ? req.query.branchIds.split(",").map(Number).filter(Boolean)
        : undefined;
      const semester = req.query.semester ? Number(req.query.semester) : undefined;
      const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
      const batch = typeof req.query.batch === "string" ? req.query.batch : undefined;
      const batches = typeof req.query.batches === "string"
        ? req.query.batches.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const section = typeof req.query.section === "string" ? req.query.section : undefined;
      const sections = typeof req.query.sections === "string"
        ? req.query.sections.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;

      const items = await getStaffSubjectsForScope({
        collegeId,
        collegeIds,
        courseId,
        courseIds,
        branchId,
        branchIds,
        semester,
        academicYear,
        batch,
        batches,
        section,
        sections,
      });
      res.json(items);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.get(
  "/feedback-forms/reports",
  requirePermission("reports.view", "settings.view", "today_timetable.view"),
  async (req, res, next) => {
    try {
      const rawPubId = req.query.publicationId || req.query.formId;
      const pubId = rawPubId ? Number(rawPubId) : undefined;
      const branch = typeof req.query.branch === "string" ? req.query.branch : undefined;
      const semester = req.query.semester ? Number(req.query.semester) : undefined;
      const report = await getFeedbackReportData(pubId, branch, semester);
      res.json(report);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.post(
  "/feedback-forms/:id/submit",
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid form ID" });
        return;
      }
      const result = await submitFeedbackResponse(id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.get(
  "/feedback-forms/:id",
  requirePermission("settings.view", "reports.view"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid form ID" });
        return;
      }
      const form = await getFeedbackForm(id);
      if (!form) {
        res.status(404).json({ message: "Feedback form not found" });
        return;
      }
      res.json(form);
    } catch (error) {
      next(error);
    }
  },
);

settingsRouter.post(
  "/feedback-forms",
  requirePermission("settings.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      const created = await createFeedbackForm(req.body);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.feedback_form_created",
        entityType: "ap_feedback_forms",
        entityId: created.id,
        oldValue: {},
        newValue: created,
        ipAddress: req.ip,
      });
      res.status(201).json(created);
    } catch (error) {
      const status = Number((error as { status?: number }).status);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  },
);

settingsRouter.put(
  "/feedback-forms/:id",
  requirePermission("settings.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid form ID" });
        return;
      }
      const previous = await getFeedbackForm(id);
      if (!previous) {
        res.status(404).json({ message: "Feedback form not found" });
        return;
      }
      const updated = await updateFeedbackForm(id, req.body);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.feedback_form_updated",
        entityType: "ap_feedback_forms",
        entityId: id,
        oldValue: previous,
        newValue: updated,
        ipAddress: req.ip,
      });
      res.json(updated);
    } catch (error) {
      const status = Number((error as { status?: number }).status);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message });
        return;
      }
      next(error);
    }
  },
);

settingsRouter.delete(
  "/feedback-forms/:id",
  requirePermission("settings.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        res.status(400).json({ message: "Invalid form ID" });
        return;
      }
      const previous = await getFeedbackForm(id);
      if (!previous) {
        res.status(404).json({ message: "Feedback form not found" });
        return;
      }
      await deleteFeedbackForm(id);
      await writeAuditLog({
        actorUserId: req.authUser!.id,
        action: "settings.feedback_form_deleted",
        entityType: "ap_feedback_forms",
        entityId: id,
        oldValue: previous,
        newValue: {},
        ipAddress: req.ip,
      });
      res.json({ success: true, message: "Feedback form deleted" });
    } catch (error) {
      next(error);
    }
  },
);

