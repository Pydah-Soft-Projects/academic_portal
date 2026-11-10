import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import {
  getAuthz,
  requirePermission,
  statusFromAuthzError,
} from "../authz/require-permission.js";
import {
  approveTimetableRequest,
  createTimetableRequest,
  listTimetableRequests,
  rejectTimetableRequest,
} from "../services/timetable-requests.service.js";

export const timetableRequestsRouter = Router();

function num(val: unknown) {
  if (typeof val !== "string" && typeof val !== "number") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function str(val: unknown) {
  if (typeof val !== "string" || !val.trim()) return undefined;
  return val.trim();
}

timetableRequestsRouter.get(
  "/",
  requirePermission("timetable_requests.view", "timetable.view", "request.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const filters = {
        status: str(req.query.status),
        collegeId: num(req.query.collegeId),
        branchId: num(req.query.branchId),
      };
      const list = await listTimetableRequests(getAuthz(req), filters);
      res.json({ data: list });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message || "Request failed" });
        return;
      }
      next(error);
    }
  },
);

timetableRequestsRouter.post(
  "/",
  requirePermission("timetable.edit", "request.create"),
  async (req: AuthedRequest, res, next) => {
    try {
      const body = req.body as {
        planId: number;
        reasonCategory?: string;
        remarks?: string;
        reason?: string;
        notes?: string;
        proposedChangesSummary?: string;
      };
      if (!body.planId) {
        res.status(400).json({ message: "planId is required" });
        return;
      }
      if (!body.reasonCategory?.trim() && !body.reason?.trim()) {
        res.status(400).json({ message: "Mandatory selection of reason for changing faculty is required." });
        return;
      }
      if (!body.remarks?.trim() && !body.reason?.trim()) {
        res.status(400).json({ message: "Mandatory detailed remarks for changing faculty are required." });
        return;
      }
      const created = await createTimetableRequest(getAuthz(req), body, req.ip);
      res.status(201).json(created);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message || "Request failed" });
        return;
      }
      next(error);
    }
  },
);

timetableRequestsRouter.post(
  "/:id/approve",
  requirePermission("timetable_requests.approve", "request.approve", "timetable.publish"),
  async (req: AuthedRequest, res, next) => {
    try {
      const requestId = Number(req.params.id);
      const comment = str(req.body?.comment);
      const result = await approveTimetableRequest(getAuthz(req), requestId, comment, req.ip);
      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message || "Approval failed" });
        return;
      }
      next(error);
    }
  },
);

timetableRequestsRouter.post(
  "/:id/reject",
  requirePermission("timetable_requests.approve", "request.approve"),
  async (req: AuthedRequest, res, next) => {
    try {
      const requestId = Number(req.params.id);
      const comment = str(req.body?.comment);
      const result = await rejectTimetableRequest(getAuthz(req), requestId, comment, req.ip);
      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status >= 400 && status < 500) {
        res.status(status).json({ message: (error as Error).message || "Rejection failed" });
        return;
      }
      next(error);
    }
  },
);

