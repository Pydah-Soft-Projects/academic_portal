"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Layers,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

export type TimetableSlotChange = {
  dayOfWeek: string;
  dayLabel: string;
  slotLabel: string;
  timeRange?: string;
  changeType: "modified" | "added" | "removed";
  fromSubject: string;
  toSubject: string;
  fromFaculty: string;
  toFaculty: string;
  fromRoom?: string;
  toRoom?: string;
  subjectChanged: boolean;
  facultyChanged: boolean;
};

export type TimetableRequestItem = {
  id: number;
  requestId: number | null;
  planId: number;
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  branchCode?: string | null;
  batch: string | null;
  yearOfStudy: number | null;
  semesterNumber: number;
  sectionName: string | null;
  academicYearLabel: string;
  versionNo: number | null;
  requesterUserId: number;
  requesterName: string;
  requesterRoleKey: string;
  reasonCategory?: string | null;
  reason: string;
  changeRemarks?: string | null;
  proposedChangesSummary: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewedByUserId: number | null;
  reviewerName: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canApprove: boolean;
  changes?: TimetableSlotChange[];
};

const REASON_CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; badgeClass: string }
> = {
  syllabus_completed: {
    label: "Syllabus Completed",
    icon: "📚",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  timetable_mistake: {
    label: "Timetable Mistake / Entry Error",
    icon: "⚠️",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  faculty_change: {
    label: "Wantedly Changing Faculty / Reassignment",
    icon: "🔄",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  faculty_relieved: {
    label: "Faculty Relieved / Long Leave",
    icon: "🚪",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  workload_rebalance: {
    label: "Workload Rebalance",
    icon: "⚖️",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
  },
  other: {
    label: "Other Reason",
    icon: "📝",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

export function TimetableRequestsView() {
  const router = useRouter();
  const { hasPermission, authorization } = useAuth();

  const isPrincipal = authorization?.roles?.some((r) => r.roleKey === "principal");
  const isSuperAdmin = authorization?.roles?.some((r) => r.roleKey === "super_admin");
  const isVicePrincipal = authorization?.roles?.some((r) => r.roleKey === "vice_principal");
  const isHod = authorization?.roles?.some((r) => r.roleKey === "hod");

  const canApprove =
    isSuperAdmin ||
    isPrincipal ||
    isVicePrincipal ||
    hasPermission("timetable_requests.approve") ||
    hasPermission("request.approve");

  const [requests, setRequests] = useState<TimetableRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Approval / Rejection modal state
  const [actionModal, setActionModal] = useState<{
    type: "approve" | "reject";
    request: TimetableRequestItem;
  } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/timetable-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load timetable requests");
      setRequests(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        item.collegeName.toLowerCase().includes(s) ||
        item.courseName.toLowerCase().includes(s) ||
        item.branchName.toLowerCase().includes(s) ||
        (item.sectionName && item.sectionName.toLowerCase().includes(s)) ||
        item.requesterName.toLowerCase().includes(s) ||
        item.reason.toLowerCase().includes(s) ||
        (item.reviewerName && item.reviewerName.toLowerCase().includes(s))
      );
    });
  }, [requests, statusFilter, search]);

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const endpoint = `/timetable-requests/${actionModal.request.id}/${actionModal.type}`;
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: actionComment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Action failed`);

      setSuccessToast(
        actionModal.type === "approve"
          ? `Request #${actionModal.request.id} approved and published live successfully!`
          : `Request #${actionModal.request.id} rejected.`,
      );
      setTimeout(() => setSuccessToast(null), 6000);

      setActionModal(null);
      setActionComment("");
      await loadRequests(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Table Requests"
        description="Review, approve, and track master timetable change requests submitted by department HODs."
      />

      {successToast ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadRequests(true)}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <button
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "pending"
              ? "border-amber-400 bg-amber-50/70 ring-2 ring-amber-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Approval</span>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-950">{counts.pending}</div>
          <div className="mt-1 text-xs text-amber-800">Requires Principal / Admin review</div>
        </button>

        <button
          onClick={() => setStatusFilter("approved")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "approved"
              ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-950">{counts.approved}</div>
          <div className="mt-1 text-xs text-emerald-800">Published to live schedule</div>
        </button>

        <button
          onClick={() => setStatusFilter("rejected")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "rejected"
              ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Rejected</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-950">{counts.rejected}</div>
          <div className="mt-1 text-xs text-rose-800">Returned or declined</div>
        </button>

        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "all"
              ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Total Requests</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-950">{counts.all}</div>
          <div className="mt-1 text-xs text-indigo-800">All submissions</div>
        </button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by branch, course, college, requester name or reason..."
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-navy-600 focus:outline-none"
            >
              <option value="pending">Pending Approval ({counts.pending})</option>
              <option value="approved">Approved ({counts.approved})</option>
              <option value="rejected">Rejected ({counts.rejected})</option>
              <option value="all">All Statuses ({counts.all})</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          title={
            statusFilter === "pending"
              ? "No pending timetable requests"
              : "No timetable requests found"
          }
          description={
            statusFilter === "pending"
              ? "All master timetable requests have been reviewed or none have been submitted yet."
              : "Try adjusting your filters or search keywords."
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => { setStatusFilter("all"); setSearch(""); }}>
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === "pending";
            const isApproved = req.status === "approved";
            const isRejected = req.status === "rejected";
            const cleanSection = req.sectionName
              ? req.sectionName.replace(/^Section\s+/i, "").trim()
              : null;

            return (
              <Card
                key={req.id}
                className={cn(
                  "p-5 transition hover:shadow-md",
                  isPending && "border-amber-200 bg-amber-50/20",
                  isApproved && "border-slate-200 bg-white",
                  isRejected && "border-rose-100 bg-white",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left Column: Details */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    {/* Primary Line: Course, Branch, Section clearly in a single line with Semester, AY & Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        REQ-{String(req.id).padStart(4, "0")}
                      </span>

                      <h3 className="text-base font-bold text-navy-900 tracking-tight">
                        {req.courseName} — {req.branchName}
                        {cleanSection ? ` — Section ${cleanSection}` : ""}
                      </h3>

                      <span className="text-slate-300 font-light select-none">|</span>

                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        Semester {req.semesterNumber}
                      </span>

                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {req.academicYearLabel}
                        {req.batch ? ` (${req.batch})` : ""}
                      </span>

                      {req.versionNo != null ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                          v{req.versionNo}
                        </span>
                      ) : null}

                      {isPending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ml-auto sm:ml-0">
                          <Clock3 className="h-3 w-3" /> Pending Principal Approval
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ml-auto sm:ml-0">
                          <CheckCircle2 className="h-3 w-3" /> Approved & Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 ml-auto sm:ml-0">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
                    </div>

                    {/* Subline: College, Plan, Requester metadata in a single clean row */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{req.collegeName}</span>
                      <span>•</span>
                      <span>Plan #{req.planId}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        Submitted by <strong className="text-slate-700">{req.requesterName}</strong> ({req.requesterRoleKey.toUpperCase()})
                      </span>
                      <span>•</span>
                      <span>{new Date(req.createdAt).toLocaleString()}</span>

                      {req.reviewerName ? (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            Reviewed by <strong>{req.reviewerName}</strong>
                            {req.reviewedAt ? ` (${new Date(req.reviewedAt).toLocaleDateString()})` : null}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Reason block: rich, structured category badge & remarks */}
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 text-xs space-y-1.5 shadow-2xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold uppercase tracking-wider text-slate-500 text-[10.5px]">
                          Change Category:
                        </span>
                        {req.reasonCategory && REASON_CATEGORY_CONFIG[req.reasonCategory] ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs",
                              REASON_CATEGORY_CONFIG[req.reasonCategory].badgeClass,
                            )}
                          >
                            <span>{REASON_CATEGORY_CONFIG[req.reasonCategory].icon}</span>
                            {REASON_CATEGORY_CONFIG[req.reasonCategory].label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-700 border border-slate-300">
                            Master Timetable Modification
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-2 pt-0.5">
                        <span className="font-bold text-slate-600 text-xs shrink-0">Remarks:</span>
                        <span className="text-slate-900 font-medium whitespace-pre-line leading-relaxed">
                          {req.changeRemarks || req.reason}
                        </span>
                      </div>
                    </div>

                    {/* Proposed Changes Breakdown */}
                    {req.changes && req.changes.length > 0 ? (
                      <div className="rounded-lg border border-slate-200/90 bg-white p-3 text-xs shadow-2xs">
                        <div className="flex items-center justify-between font-bold text-slate-800 mb-2">
                          <span className="flex items-center gap-1.5 text-navy-950">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                            Proposed Timetable Modifications ({req.changes.length})
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">Period & Faculty Diff</span>
                        </div>
                        <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-slate-50/50">
                          {req.changes.map((ch, idx) => (
                            <div key={idx} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-navy-900 bg-white border border-slate-200/80 rounded px-2 py-0.5 text-[11px] shadow-2xs">
                                  {ch.dayLabel} • {ch.slotLabel}
                                </span>
                                {ch.timeRange ? (
                                  <span className="text-[10.5px] font-mono text-slate-500">({ch.timeRange})</span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <span className="text-slate-400 font-medium">Faculty:</span>
                                <span className="line-through text-slate-400">{ch.fromFaculty}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="font-bold text-amber-900 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200">
                                  {ch.toFaculty}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400 font-medium">Subject:</span>
                                {ch.subjectChanged ? (
                                  <>
                                    <span className="line-through text-slate-400">{ch.fromSubject}</span>
                                    <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="font-bold text-emerald-800 bg-emerald-50 rounded px-1.5 py-0.5 border border-emerald-200">
                                      {ch.toSubject}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-700 font-medium">{ch.toSubject}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {req.reviewComment ? (
                      <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs flex items-baseline gap-2">
                        <span className="font-bold uppercase tracking-wider text-indigo-700 text-[11px] shrink-0">
                          Reviewer Remarks:
                        </span>
                        <span className="text-indigo-900 font-medium">{req.reviewComment}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 pt-2 lg:pt-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        router.push(
                          `/timetables?collegeId=${req.collegeId}&courseId=${req.courseId}&branchId=${req.branchId}&semester=${req.semesterNumber}&section=${req.sectionName || "all"}&academicYear=${encodeURIComponent(req.academicYearLabel)}`,
                        )
                      }
                      title="Inspect the proposed timetable in the planner"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                      View Timetable
                    </Button>

                    {isPending && canApprove ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                          onClick={() => {
                            setActionModal({ type: "approve", request: req });
                            setActionComment("");
                            setActionError(null);
                          }}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Approve & Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-900 font-semibold"
                          onClick={() => {
                            setActionModal({ type: "reject", request: req });
                            setActionComment("");
                            setActionError(null);
                          }}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve / Reject Dialog */}
      {actionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-950">
                  {actionModal.type === "approve"
                    ? "Approve & Publish Master Timetable"
                    : "Reject Timetable Change Request"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Request REQ-{String(actionModal.request.id).padStart(4, "0")} for{" "}
                  <span className="font-semibold text-slate-700">
                    {actionModal.request.courseName} — {actionModal.request.branchName}
                    {actionModal.request.sectionName ? ` — Section ${actionModal.request.sectionName.replace(/^Section\s+/i, "")}` : ""}
                    {" "}(Sem {actionModal.request.semesterNumber})
                  </span>
                </p>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            {actionError ? (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                {actionError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                <div>
                  <span className="font-bold text-slate-700">Requester:</span>{" "}
                  {actionModal.request.requesterName} ({actionModal.request.requesterRoleKey.toUpperCase()})
                </div>
                {actionModal.request.reasonCategory && REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory] ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Change Category:</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs",
                        REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory].badgeClass,
                      )}
                    >
                      <span>{REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory].icon}</span>
                      {REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory].label}
                    </span>
                  </div>
                ) : null}
                <div>
                  <span className="font-bold text-slate-700">Remarks:</span>{" "}
                  <span className="text-slate-800 font-medium whitespace-pre-line">
                    {actionModal.request.changeRemarks || actionModal.request.reason}
                  </span>
                </div>
              </div>

              {/* Proposed Timetable Modifications Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-navy-950">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    <span>Proposed Timetable Modifications</span>
                    <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                      {actionModal.request.changes?.length ?? 0} {actionModal.request.changes?.length === 1 ? "change" : "changes"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Period & Faculty Diff</span>
                </div>

                {actionModal.request.changes && actionModal.request.changes.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {actionModal.request.changes.map((ch, idx) => (
                      <div key={idx} className="p-3 text-xs hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Day & Period Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center rounded-md bg-navy-50 px-2.5 py-1 font-bold text-navy-900 border border-navy-100 text-[11.5px]">
                            {ch.dayLabel} • {ch.slotLabel}
                          </span>
                          {ch.timeRange ? (
                            <span className="text-[11px] font-mono text-slate-500">
                              {ch.timeRange}
                            </span>
                          ) : null}
                        </div>

                        {/* Changes: Faculty and Subject */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Faculty: From -> To */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-slate-400 font-medium">Faculty:</span>
                            <span className="line-through text-slate-400 font-medium">{ch.fromFaculty}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {ch.toFaculty}
                            </span>
                          </div>

                          {/* Subject: From -> To (or Subject name) */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400 font-medium">Subject:</span>
                            {ch.subjectChanged ? (
                              <>
                                <span className="line-through text-slate-400 font-medium">{ch.fromSubject}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {ch.toSubject}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium text-slate-700">{ch.toSubject}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-xs text-slate-500 text-center italic">
                    {actionModal.request.proposedChangesSummary || "No slot-level period diffs detected."}
                  </div>
                )}
              </div>

              {actionModal.type === "approve" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                  Approving this request will immediately publish the modified draft timetable as the next live
                  version for faculty and student attendance.
                </div>
              ) : (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900">
                  Please provide remarks explaining why this request cannot be approved so the HOD can adjust the
                  schedule accordingly.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {actionModal.type === "approve" ? "Approval Remarks (Optional)" : "Rejection Reason / Comments *"}
                </label>
                <textarea
                  rows={3}
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder={
                    actionModal.type === "approve"
                      ? "Add any notes or instructions for the HOD..."
                      : "State the reason for rejection (e.g., period clashes, teacher workload imbalance)..."
                  }
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActionModal(null)}
                disabled={submittingAction}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className={cn(
                  actionModal.type === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : "bg-rose-600 hover:bg-rose-700 text-white font-semibold",
                )}
                onClick={() => void handleConfirmAction()}
                disabled={submittingAction || (actionModal.type === "reject" && !actionComment.trim())}
              >
                {submittingAction
                  ? "Processing..."
                  : actionModal.type === "approve"
                    ? "Confirm Approval & Publish"
                    : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

