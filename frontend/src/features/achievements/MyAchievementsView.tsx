"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  History,
  Layers,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X,
  AlertCircle,
  Building,
  CheckCircle,
} from "lucide-react";
import type {
  StaffAchievement,
  StaffApprovalHistoryItem,
} from "@/features/staff/staff-types";

export const ACHIEVEMENT_CATEGORIES = [
  "Educational Certifications",
  "Professional Certifications",
  "Journals Published",
  "Research Papers Published",
  "Books Published",
  "Patents Published / Registered",
  "Conference Participation",
  "Workshops Attended",
  "FDP (Faculty Development Programs)",
  "Awards & Recognitions",
  "Research Projects",
  "Other Academic Achievements",
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Educational Certifications": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Professional Certifications": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Journals Published": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Research Papers Published": { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  "Books Published": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "Patents Published / Registered": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Conference Participation": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Workshops Attended": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  "FDP (Faculty Development Programs)": { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
  "Awards & Recognitions": { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200" },
  "Research Projects": { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-200" },
  "Other Academic Achievements": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

type StaffInfo = {
  hrmsEmployeeId: string;
  name: string;
  code: string;
  department: string;
  designation: string;
  college: string;
  profilePhoto?: string | null;
};

export function MyAchievementsView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [achievements, setAchievements] = useState<StaffAchievement[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<StaffApprovalHistoryItem[]>([]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<StaffAchievement | null>(null);
  const [documentPreviewTarget, setDocumentPreviewTarget] = useState<{
    fileName: string;
    fileUrl: string;
    fileType: string;
  } | null>(null);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: "Research Papers Published",
    title: "",
    description: "",
    publication_name: "",
    issuing_organization: "",
    publication_date: "",
    certificate_number_or_doi: "",
    academic_year: "2026-2027",
    semester: "1",
    achievement_url: "",
    status: "submitted",
    docFileName: "",
    docFileUrl: "",
  });

  const effectiveIdentifier = useMemo(() => {
    return user?.hrmsEmployeeId || user?.username || "me";
  }, [user]);

  const loadAchievements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(effectiveIdentifier)}/achievements`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to load achievements (${res.status})`);
      }
      const data = await res.json();
      setStaffInfo(data.staff || null);
      setAchievements(data.achievements || []);
      setApprovalHistory(data.approvalHistory || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load achievements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAchievements();
  }, [effectiveIdentifier]);

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit. Please upload a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({
        ...prev,
        docFileName: file.name,
        docFileUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Submit achievement
  const handleSubmitAchievement = async (e: React.FormEvent, initialStatus: "draft" | "submitted") => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert("Achievement title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        publication_name: form.publication_name.trim() || null,
        issuing_organization: form.issuing_organization.trim() || null,
        publication_date: form.publication_date || null,
        certificate_number_or_doi: form.certificate_number_or_doi.trim() || null,
        academic_year: form.academic_year,
        semester: form.semester,
        achievement_url: form.achievement_url.trim() || null,
        status: initialStatus,
      };

      if (form.docFileUrl) {
        payload.documents = [
          {
            fileName: form.docFileName || "supporting_document.pdf",
            fileUrl: form.docFileUrl,
            fileSize: 1024,
            fileType: "application/pdf",
          },
        ];
      }

      const res = await apiFetch(`/staff/${encodeURIComponent(effectiveIdentifier)}/achievements`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to submit achievement");
      }

      setIsSubmitOpen(false);
      setForm({
        category: "Research Papers Published",
        title: "",
        description: "",
        publication_name: "",
        issuing_organization: "",
        publication_date: "",
        certificate_number_or_doi: "",
        academic_year: "2026-2027",
        semester: "1",
        achievement_url: "",
        status: "submitted",
        docFileName: "",
        docFileUrl: "",
      });

      await loadAchievements();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error submitting achievement");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete achievement
  const handleDeleteAchievement = async (achId: number) => {
    if (!confirm("Are you sure you want to delete this achievement record?")) return;
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(effectiveIdentifier)}/achievements/${achId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete record");
      await loadAchievements();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting achievement");
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = achievements.length;
    const approved = achievements.filter((a) => a.status === "approved").length;
    const pendingPrincipal = achievements.filter((a) => a.status === "pending_principal_approval").length;
    const pendingHod = achievements.filter((a) => a.status === "pending_hod_approval" || a.status === "submitted").length;
    const rejected = achievements.filter((a) => a.status === "rejected").length;
    const draft = achievements.filter((a) => a.status === "draft").length;
    return { total, approved, pendingPrincipal, pendingHod, rejected, draft };
  }, [achievements]);

  // Filtered List
  const filteredAchievements = useMemo(() => {
    return achievements.filter((ach) => {
      // Category filter
      if (categoryFilter !== "all" && ach.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter === "approved" && ach.status !== "approved") return false;
      if (statusFilter === "pending_hod" && ach.status !== "pending_hod_approval" && ach.status !== "submitted") return false;
      if (statusFilter === "pending_principal" && ach.status !== "pending_principal_approval") return false;
      if (statusFilter === "rejected" && ach.status !== "rejected") return false;
      if (statusFilter === "draft" && ach.status !== "draft") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ach.title.toLowerCase().includes(q);
        const matchesCategory = ach.category.toLowerCase().includes(q);
        const matchesPub = (ach.publicationName || "").toLowerCase().includes(q);
        const matchesOrg = (ach.issuingOrganization || "").toLowerCase().includes(q);
        const matchesDoi = (ach.certificateNumberOrDoi || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesPub && !matchesOrg && !matchesDoi) {
          return false;
        }
      }

      return true;
    });
  }, [achievements, categoryFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Hero Header & Identity Card ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-indigo-950 p-6 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 right-24 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300 border border-brand-400/30">
              <Sparkles className="h-3.5 w-3.5" />
              <span>HRMS Faculty Research &amp; Scholarly Achievements</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-white">
              My Academic Achievements
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Submit and manage your scholarly publications, certifications, patents, FDPs, and awards.
              Once recommended by your HOD and approved by the Principal, these achievements automatically showcase on your verified institutional Staff Profile.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {staffInfo && (
              <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-md border border-white/10">
                <FacultyAvatar
                  name={staffInfo.name}
                  photo={staffInfo.profilePhoto}
                  className="h-11 w-11 rounded-full border-2 border-brand-400 shadow-sm"
                />
                <div className="text-left">
                  <p className="text-xs font-bold text-white leading-tight">{staffInfo.name}</p>
                  <p className="text-[11px] text-slate-300">
                    EMP #{staffInfo.code || staffInfo.hrmsEmployeeId} · {staffInfo.department}
                  </p>
                  <p className="text-[10px] text-brand-300 font-medium">{staffInfo.designation}</p>
                </div>
              </div>
            )}

            <Button
              onClick={() => setIsSubmitOpen(true)}
              className="bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-lg shadow-brand-500/30 flex items-center justify-center gap-2 cursor-pointer h-11 px-5"
            >
              <Plus className="h-4 w-4" />
              <span>Submit Achievement</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── KPI Metrics Cards ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total */}
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition shadow-xs cursor-pointer",
            statusFilter === "all"
              ? "border-navy-600 bg-navy-50/50 ring-2 ring-navy-600/30"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Submitted</span>
            <Layers className="h-4 w-4 text-slate-600" />
          </div>
          <span className="mt-2 text-2xl font-black text-navy-950">{metrics.total}</span>
          <span className="text-[11px] text-slate-500 mt-0.5">All achievements</span>
        </button>

        {/* Approved */}
        <button
          type="button"
          onClick={() => setStatusFilter("approved")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition shadow-xs cursor-pointer",
            statusFilter === "approved"
              ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/30"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Verified &amp; Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="mt-2 text-2xl font-black text-emerald-800">{metrics.approved}</span>
          <span className="text-[11px] text-emerald-600 mt-0.5">Shown on profile</span>
        </button>

        {/* Pending Principal */}
        <button
          type="button"
          onClick={() => setStatusFilter("pending_principal")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition shadow-xs cursor-pointer",
            statusFilter === "pending_principal"
              ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/30"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between text-blue-700 text-xs font-semibold">
            <span>Under Principal Review</span>
            <Award className="h-4 w-4 text-blue-600" />
          </div>
          <span className="mt-2 text-2xl font-black text-blue-800">{metrics.pendingPrincipal}</span>
          <span className="text-[11px] text-blue-600 mt-0.5">HOD Recommended</span>
        </button>

        {/* Pending HOD */}
        <button
          type="button"
          onClick={() => setStatusFilter("pending_hod")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition shadow-xs cursor-pointer",
            statusFilter === "pending_hod"
              ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/30"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Under HOD Review</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <span className="mt-2 text-2xl font-black text-amber-800">{metrics.pendingHod}</span>
          <span className="text-[11px] text-amber-600 mt-0.5">Awaiting HOD sign-off</span>
        </button>

        {/* Rejected / Needs Action */}
        <button
          type="button"
          onClick={() => setStatusFilter("rejected")}
          className={cn(
            "flex flex-col rounded-xl border p-4 text-left transition shadow-xs cursor-pointer",
            statusFilter === "rejected"
              ? "border-rose-600 bg-rose-50/70 ring-2 ring-rose-600/30"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
            <span>Revisions / Rejected</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <span className="mt-2 text-2xl font-black text-rose-800">{metrics.rejected}</span>
          <span className="text-[11px] text-rose-600 mt-0.5">Feedback provided</span>
        </button>
      </div>

      {/* ─── Search & Category Filters Bar ─── */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, journal, DOI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
            >
              <option value="all">All Categories ({achievements.length})</option>
              {ACHIEVEMENT_CATEGORIES.map((cat) => {
                const count = achievements.filter((a) => a.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} {count > 0 ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* View on Verified Profile Link */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Link
            href={`/staff/${encodeURIComponent(effectiveIdentifier)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Open Staff View Profile</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ─── Achievements Listing ─── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-xs font-medium">Loading your achievements portfolio…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-xs text-rose-800 space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
          <p className="font-semibold">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadAchievements()}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : filteredAchievements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Award className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">
            {achievements.length === 0 ? "No Achievements Recorded Yet" : "No Matching Achievements Found"}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
            {achievements.length === 0
              ? "Start building your scholarly portfolio by submitting publications, certifications, patents, or FDPs."
              : "Try adjusting your search keywords, category, or status filters."}
          </p>
          {achievements.length === 0 && (
            <Button
              onClick={() => setIsSubmitOpen(true)}
              className="mt-5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Submit Your First Achievement
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAchievements.map((ach) => {
            const catStyle = CATEGORY_COLORS[ach.category] || {
              bg: "bg-slate-50",
              text: "text-slate-700",
              border: "border-slate-200",
            };

            const isApproved = ach.status === "approved";
            const isPendingPrincipal = ach.status === "pending_principal_approval";
            const isPendingHod = ach.status === "pending_hod_approval" || ach.status === "submitted";
            const isRejected = ach.status === "rejected";
            const isDraft = ach.status === "draft";

            return (
              <div
                key={ach.id}
                className={cn(
                  "flex flex-col justify-between rounded-xl border bg-white p-5 shadow-xs transition hover:shadow-md",
                  isApproved
                    ? "border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20"
                    : isRejected
                    ? "border-rose-200 bg-gradient-to-b from-white to-rose-50/20"
                    : "border-slate-200"
                )}
              >
                <div className="space-y-3">
                  {/* Top Header Badge Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        catStyle.bg,
                        catStyle.text,
                        catStyle.border
                      )}
                    >
                      {ach.category}
                    </span>

                    {/* Status Pill */}
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                        Verified &amp; Approved
                      </span>
                    ) : isPendingPrincipal ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                        <Award className="h-3 w-3 text-blue-600" />
                        Under Principal Review
                      </span>
                    ) : isPendingHod ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                        <Clock className="h-3 w-3 text-amber-600" />
                        Under HOD Review
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
                        <AlertCircle className="h-3 w-3 text-rose-600" />
                        Revisions Requested
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                        Draft
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{ach.title}</h3>
                    {ach.description && (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {ach.description}
                      </p>
                    )}
                  </div>

                  {/* Meta Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                    {ach.publicationName && (
                      <div className="flex items-center gap-1.5 truncate">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{ach.publicationName}</span>
                      </div>
                    )}
                    {ach.issuingOrganization && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{ach.issuingOrganization}</span>
                      </div>
                    )}
                    {ach.publicationDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{ach.publicationDate}</span>
                      </div>
                    )}
                    {ach.academicYear && (
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>
                          AY {ach.academicYear} {ach.semester ? `(Sem ${ach.semester})` : ""}
                        </span>
                      </div>
                    )}
                    {ach.certificateNumberOrDoi && (
                      <div className="flex items-center gap-1.5 sm:col-span-2 text-slate-700 font-mono text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
                        <span className="font-sans font-semibold text-slate-500">ID / DOI:</span>
                        <span className="truncate select-all">{ach.certificateNumberOrDoi}</span>
                      </div>
                    )}
                  </div>

                  {/* External URL */}
                  {ach.achievementUrl && (
                    <div className="pt-1">
                      <a
                        href={ach.achievementUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate max-w-xs">{ach.achievementUrl}</span>
                      </a>
                    </div>
                  )}

                  {/* Document Attachment */}
                  {ach.documents && ach.documents.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {ach.documents.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() =>
                            setDocumentPreviewTarget({
                              fileName: doc.fileName,
                              fileUrl: doc.fileUrl,
                              fileType: doc.fileType,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition cursor-pointer"
                        >
                          <FileCheck className="h-3.5 w-3.5 text-brand-600" />
                          <span className="truncate max-w-[180px]">{doc.fileName}</span>
                          <Eye className="h-3 w-3 text-brand-500" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reviewer Feedback Notes */}
                  {(ach.hodRemarks || ach.principalRemarks || ach.rejectionRemarks) && (
                    <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-2.5 text-xs text-amber-900 space-y-1">
                      {ach.hodRemarks && (
                        <p>
                          <span className="font-bold">HOD Remarks:</span> {ach.hodRemarks}
                        </p>
                      )}
                      {ach.principalRemarks && (
                        <p>
                          <span className="font-bold">Principal Remarks:</span> {ach.principalRemarks}
                        </p>
                      )}
                      {ach.rejectionRemarks && (
                        <p className="text-rose-700 font-medium">
                          <span className="font-bold text-rose-800">Revision Note:</span>{" "}
                          {ach.rejectionRemarks}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setHistoryTarget(ach)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-navy-900 transition cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    <span>Approval Trail</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {(isDraft || isRejected) && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteAchievement(ach.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete achievement"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal: Submit New Achievement ─── */}
      {isSubmitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Submit Scholarly Achievement</h2>
                  <p className="text-[11px] text-slate-500">Record will be submitted for HOD review and Principal verification.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={(e) => void handleSubmitAchievement(e, "submitted")} className="p-6 space-y-4 text-xs">
              {/* Category */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Achievement Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 font-medium focus:border-brand-600 focus:bg-white focus:outline-none"
                  required
                >
                  {ACHIEVEMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Title of Paper / Certification / Project <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Real-Time Deep Learning for Edge Computing..."
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  required
                />
              </div>

              {/* Description / Abstract */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Abstract</label>
                <textarea
                  rows={2}
                  placeholder="Summary of objectives, outcomes, or certification scope..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Two-column metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Journal / Conference / Publication Name</label>
                  <input
                    type="text"
                    placeholder="e.g. IEEE Transactions on Computers"
                    value={form.publication_name}
                    onChange={(e) => setForm((p) => ({ ...p, publication_name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Issuing Organization / University</label>
                  <input
                    type="text"
                    placeholder="e.g. NPTEL / AICTE / Coursera"
                    value={form.issuing_organization}
                    onChange={(e) => setForm((p) => ({ ...p, issuing_organization: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Publication / Issue Date</label>
                  <input
                    type="date"
                    value={form.publication_date}
                    onChange={(e) => setForm((p) => ({ ...p, publication_date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={form.academic_year}
                    onChange={(e) => setForm((p) => ({ ...p, academic_year: e.target.value }))}
                    placeholder="2026-2027"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Semester</label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">DOI / Certificate / Paper No.</label>
                  <input
                    type="text"
                    placeholder="10.1109/TC.2026.12345"
                    value={form.certificate_number_or_doi}
                    onChange={(e) => setForm((p) => ({ ...p, certificate_number_or_doi: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">External Link / Verification URL</label>
                  <input
                    type="url"
                    placeholder="https://doi.org/... or https://scopus.com/..."
                    value={form.achievement_url}
                    onChange={(e) => setForm((p) => ({ ...p, achievement_url: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* File Attachment */}
              <div className="rounded-xl border border-dashed border-slate-300 p-4 bg-slate-50/50 space-y-2">
                <label className="font-semibold text-slate-800 block">Supporting Document / Certificate (PDF, PNG, JPG)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs">
                    <Upload className="h-3.5 w-3.5 text-brand-600" />
                    <span>Choose Certificate File</span>
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {form.docFileName && (
                    <span className="text-xs text-brand-700 font-semibold flex items-center gap-1 truncate max-w-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      {form.docFileName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Max size 15MB. Scanned certificates, e-certificates, or paper copy accepted.</p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSubmitOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => void handleSubmitAchievement(e, "draft")}
                  disabled={submitting || !form.title.trim()}
                >
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !form.title.trim()}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
                >
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Approval Audit History ─── */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-600">{historyTarget.category}</span>
                <h3 className="text-sm font-bold text-slate-900">{historyTarget.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-brand-600" />
                <span>Approval Workflow Trail</span>
              </h4>

              {(() => {
                const targetHistory = approvalHistory.filter((h) => h.achievementId === historyTarget.id);
                if (targetHistory.length === 0) {
                  return (
                    <div className="p-4 rounded-xl bg-slate-50 text-xs text-slate-500 text-center">
                      Submitted on {historyTarget.createdAt ? new Date(historyTarget.createdAt).toLocaleDateString() : "recently"}. Awaiting initial HOD review.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 border-l-2 border-slate-200 pl-4 ml-1">
                    {targetHistory.map((hist) => (
                      <div key={hist.id} className="relative text-xs space-y-1">
                        <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 capitalize">
                            {hist.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {hist.createdAt ? new Date(hist.createdAt).toLocaleString() : ""}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">
                          By <span className="font-semibold text-slate-800">{hist.actorName}</span> ({hist.actorRole})
                        </p>
                        {hist.remarks && (
                          <div className="rounded bg-slate-50 p-2 text-slate-700 italic border border-slate-100 mt-1">
                            &ldquo;{hist.remarks}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setHistoryTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Document Preview ─── */}
      {documentPreviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex flex-col h-[90vh] w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 bg-slate-50">
              <div className="flex items-center gap-2 truncate">
                <FileCheck className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-bold text-slate-800 truncate">{documentPreviewTarget.fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={documentPreviewTarget.fileUrl}
                  download={documentPreviewTarget.fileName}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDocumentPreviewTarget(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center">
              {documentPreviewTarget.fileType?.startsWith("image/") ||
              documentPreviewTarget.fileUrl.startsWith("data:image/") ? (
                <img
                  src={documentPreviewTarget.fileUrl}
                  alt={documentPreviewTarget.fileName}
                  className="max-h-full max-w-full rounded object-contain shadow-md"
                />
              ) : (
                <iframe
                  src={documentPreviewTarget.fileUrl}
                  title={documentPreviewTarget.fileName}
                  className="h-full w-full rounded border-0 bg-white shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

