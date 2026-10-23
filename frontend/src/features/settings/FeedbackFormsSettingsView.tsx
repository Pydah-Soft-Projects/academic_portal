"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  Edit3,
  Sparkles,
  Send,
  Layers,
  Star,
  CheckSquare,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContentCardSkeleton } from "@/components/ui/CardSkeleton";
import { apiFetch } from "@/lib/api";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "rating_scale"
  | "yes_no"
  | "multiple_choice";

export type FeedbackQuestionDraft = {
  id?: number;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  orderIndex: number;
  minValue: number | null;
  maxValue: number | null;
  options: string[];
};

export type FeedbackFormItem = {
  id: number;
  name: string;
  description: string | null;
  questionCount: number;
  questions?: FeedbackQuestionDraft[];
  createdAt?: string;
  updatedAt?: string;
};

const QUESTION_TYPE_LABELS: Record<QuestionType, { title: string; subtitle: string; icon: typeof FileText }> = {
  short_text: {
    title: "Short Text",
    subtitle: "Single-line response",
    icon: MessageSquare,
  },
  long_text: {
    title: "Long Text",
    subtitle: "Detailed multi-line response",
    icon: FileText,
  },
  rating_scale: {
    title: "Rating Scale",
    subtitle: "Numeric rating (1-5, 1-10, etc.)",
    icon: Star,
  },
  yes_no: {
    title: "Yes/No",
    subtitle: "Binary confirmation choice",
    icon: CheckSquare,
  },
  multiple_choice: {
    title: "Multiple Choice",
    subtitle: "Select one from options",
    icon: Layers,
  },
};

export type FormEditorState = {
  name: string;
  description: string;
  questions: FeedbackQuestionDraft[];
};

const DEFAULT_FORM_STATE: FormEditorState = {
  name: "Acedemic Feedback Form",
  description:
    "Please submit your genuine feedback. Your response will remain anonymous. We are collecting your details only for validation purposes — no one will have access to your individual responses, and all information provided will be kept completely anonymous",
  questions: [
    {
      questionText: "Units Covered",
      questionType: "multiple_choice",
      isRequired: true,
      orderIndex: 1,
      minValue: null,
      maxValue: null,
      options: ["1", "2", "3", "4", "5"],
    },
    {
      questionText: "Rate Subject Faculty",
      questionType: "rating_scale",
      isRequired: true,
      orderIndex: 2,
      minValue: 1,
      maxValue: 5,
      options: [],
    },
    {
      questionText: "Unit Status",
      questionType: "multiple_choice",
      isRequired: true,
      orderIndex: 3,
      minValue: null,
      maxValue: null,
      options: ["Starting", "Middle", "Ending", "Completed"],
    },
  ],
};

export function FeedbackFormsSettingsView() {
  const [forms, setForms] = useState<FeedbackFormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Modal editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFormId, setEditingFormId] = useState<number | null>(null);
  const [editorData, setEditorData] = useState<FormEditorState>(DEFAULT_FORM_STATE);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Student preview modal state
  const [previewForm, setPreviewForm] = useState<FeedbackFormItem | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, string | number>>({});
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  async function loadForms() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/settings/feedback-forms");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load feedback forms");
      }
      const data = await res.json();
      setForms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading forms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadForms();
  }, []);

  const openCreateModal = () => {
    setEditingFormId(null);
    setEditorData(DEFAULT_FORM_STATE);
    setEditorError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = async (form: FeedbackFormItem) => {
    setEditingFormId(form.id);
    setEditorError(null);
    setIsEditorOpen(true);
    try {
      // Fetch fresh form with questions
      const res = await apiFetch(`/settings/feedback-forms/${form.id}`);
      if (!res.ok) throw new Error("Failed to load form details");
      const data: FeedbackFormItem = await res.json();
      setEditorData({
        name: data.name,
        description: data.description || "",
        questions: (data.questions || []).map((q, idx) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          isRequired: q.isRequired,
          orderIndex: q.orderIndex || idx + 1,
          minValue: q.minValue ?? (q.questionType === "rating_scale" ? 1 : null),
          maxValue: q.maxValue ?? (q.questionType === "rating_scale" ? 5 : null),
          options: q.options && q.options.length > 0 ? q.options : ["Option 1", "Option 2"],
        })),
      });
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Error fetching form details");
    }
  };

  const openPreview = async (form: FeedbackFormItem) => {
    try {
      const res = await apiFetch(`/settings/feedback-forms/${form.id}`);
      if (!res.ok) throw new Error("Failed to fetch full form");
      const full = await res.json();
      setPreviewForm(full);
      setPreviewAnswers({});
      setPreviewSubmitted(false);
    } catch {
      setPreviewForm(form);
      setPreviewAnswers({});
      setPreviewSubmitted(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/settings/feedback-forms/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete form");
      }
      setSuccessNotice(`Form "${name}" was deleted successfully.`);
      await loadForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Question editing handlers
  const addQuestion = (type: QuestionType) => {
    const newQ: FeedbackQuestionDraft = {
      questionText: "",
      questionType: type,
      isRequired: true,
      orderIndex: editorData.questions.length + 1,
      minValue: type === "rating_scale" ? 1 : null,
      maxValue: type === "rating_scale" ? 5 : null,
      options:
        type === "multiple_choice"
          ? ["Option 1", "Option 2", "Option 3"]
          : [],
    };
    setEditorData({
      ...editorData,
      questions: [...editorData.questions, newQ],
    });
  };

  const updateQuestion = (index: number, updates: Partial<FeedbackQuestionDraft>) => {
    const updated = [...editorData.questions];
    updated[index] = { ...updated[index], ...updates };
    setEditorData({ ...editorData, questions: updated });
  };

  const removeQuestion = (index: number) => {
    const updated = [...editorData.questions];
    updated.splice(index, 1);
    setEditorData({ ...editorData, questions: updated });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const updated = [...editorData.questions];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    // recalculate orderIndex
    updated.forEach((q, idx) => {
      q.orderIndex = idx + 1;
    });
    setEditorData({ ...editorData, questions: updated });
  };

  const handleAddOption = (qIndex: number) => {
    const updated = [...editorData.questions];
    const currentOptions = updated[qIndex].options || [];
    updated[qIndex].options = [...currentOptions, `Option ${currentOptions.length + 1}`];
    setEditorData({ ...editorData, questions: updated });
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...editorData.questions];
    const opts = [...(updated[qIndex].options || [])];
    opts[optIndex] = val;
    updated[qIndex].options = opts;
    setEditorData({ ...editorData, questions: updated });
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...editorData.questions];
    const opts = [...(updated[qIndex].options || [])];
    opts.splice(optIndex, 1);
    updated[qIndex].options = opts;
    setEditorData({ ...editorData, questions: updated });
  };

  const handleSaveForm = async () => {
    setEditorError(null);
    if (!editorData.name.trim()) {
      setEditorError("Form Name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editorData.name.trim(),
        description: editorData.description.trim() || null,
        questions: editorData.questions.map((q, idx) => ({
          questionText: q.questionText.trim(),
          questionType: q.questionType,
          isRequired: q.isRequired,
          orderIndex: idx + 1,
          minValue: q.minValue,
          maxValue: q.maxValue,
          options: q.options.filter((o) => o.trim() !== ""),
        })),
      };

      const url = editingFormId
        ? `/settings/feedback-forms/${editingFormId}`
        : `/settings/feedback-forms`;
      const method = editingFormId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save form");
      }

      setIsEditorOpen(false);
      setSuccessNotice(
        editingFormId
          ? `Feedback form "${editorData.name}" was updated successfully!`
          : `Feedback form "${editorData.name}" was created successfully!`,
      );
      await loadForms();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Error saving form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Academic Feedback Forms"
            description="Configure academic feedback forms and question templates. Set activation dates and target branches by publishing forms in Reports."
            className="mb-0"
          />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost">Back to settings</Button>
          </Link>
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Feedback Form
          </Button>
        </div>
      </div>

      {/* Notices */}
      {successNotice ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-xs text-emerald-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs text-rose-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Forms Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ContentCardSkeleton contentHeight="h-56" />
          <ContentCardSkeleton contentHeight="h-56" />
        </div>
      ) : forms.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileText className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-navy-900">
            No Feedback Forms Configured
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Create an academic feedback form or college-wide training survey for students to evaluate their coursework and faculties.
          </p>
          <Button onClick={openCreateModal} className="mt-5">
            + Create Form Now
          </Button>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {forms.map((form) => {
            return (
              <Card
                key={form.id}
                className="group relative flex flex-col justify-between border-slate-200/90 transition-all hover:border-navy-400/50 hover:shadow-md"
              >
                <div>
                  {/* Status & Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-800 border border-navy-200">
                        <FileText className="h-3 w-3 text-navy-600" />
                        Form Template
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-500">
                      {form.questionCount} {form.questionCount === 1 ? "question" : "questions"}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <h3 className="text-base font-semibold text-navy-900 group-hover:text-navy-700">
                      {form.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {form.description || "No description provided."}
                    </p>
                  </div>

                  {/* Anonymous guarantee badge */}
                  <div className="mt-3.5 flex items-center gap-2 rounded-md bg-navy-50/60 p-2 text-xs text-navy-800">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-navy-600" />
                    <span>Responses collected anonymously for validation</span>
                  </div>

                  {/* Publication Action Prompt */}
                  <div className="mt-4 rounded-md border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-navy-900">
                        <Sparkles className="h-3.5 w-3.5 text-navy-600" />
                        <span>Ready to Publish</span>
                      </div>
                      <Link
                        href={`/reports?tab=feedback-reports&publishFormId=${form.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-navy-700 hover:text-navy-900 hover:underline"
                      >
                        <span>Publish in Reports</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Activation date ranges, branch target, and semester scope are configured when publishing this form from Reports.
                    </p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void openPreview(form)}
                      className="flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-600" />
                      Student Preview
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void openEditModal(form)}
                      className="flex items-center gap-1.5"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Template
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(form.id, form.name)}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM BUILDER / EDITOR MODAL                                                */}
      {/* ========================================================================= */}
      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-navy-900">
                  {editingFormId ? "Update Feedback Form" : "Create Feedback Form"}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure form details, activation schedule, and student evaluation questions
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsEditorOpen(false)}>
                ✕ Close
              </Button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
              {editorError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {editorError}
                </div>
              ) : null}

              {/* 1. Form Information */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-navy-900">
                    Form Information
                  </h4>
                  <p className="text-xs text-slate-500">General settings and student anonymity guarantee</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Form Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editorData.name}
                    onChange={(e) => setEditorData({ ...editorData, name: e.target.value })}
                    placeholder="e.g. Acedemic Feedback Form"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editorData.description}
                    onChange={(e) => setEditorData({ ...editorData, description: e.target.value })}
                    placeholder="Please submit your genuine feedback. Your response will remain anonymous..."
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    Displayed at the top of the form for student guidance and anonymity assurance.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg bg-blue-50/80 p-3 text-xs text-blue-900 border border-blue-200/60">
                  <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                  <span>
                    Activation date ranges, branch target, and semester scope are configured when publishing this form in the Reports tab.
                  </span>
                </div>
              </div>

              {/* 2. Questions Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-navy-900">
                      Questions ({editorData.questions.length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Add, arrange, and configure evaluation questions
                    </p>
                  </div>

                  {/* Quick Add Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-600 mr-1">Add:</span>
                    <button
                      type="button"
                      onClick={() => addQuestion("short_text")}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:border-navy-400 hover:bg-slate-100"
                    >
                      + Short Text
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion("long_text")}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:border-navy-400 hover:bg-slate-100"
                    >
                      + Long Text
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion("rating_scale")}
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:border-amber-400 hover:bg-amber-100"
                    >
                      + Rating Scale
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion("yes_no")}
                      className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:border-blue-400 hover:bg-blue-100"
                    >
                      + Yes/No
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuestion("multiple_choice")}
                      className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 hover:border-indigo-400 hover:bg-indigo-100"
                    >
                      + Multiple Choice
                    </button>
                  </div>
                </div>

                {/* Questions List */}
                {editorData.questions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-600">
                    No questions added yet. Use the buttons above to add questions.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editorData.questions.map((q, qIndex) => {
                      const meta = QUESTION_TYPE_LABELS[q.questionType];
                      const Icon = meta.icon;

                      return (
                        <div
                          key={qIndex}
                          className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-slate-300"
                        >
                          {/* Question Card Top Bar */}
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                                {qIndex + 1}
                              </span>
                              <span className="text-sm font-semibold text-navy-900">
                                Question {qIndex + 1}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
                                <Icon className="h-3 w-3" />
                                {meta.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={qIndex === 0}
                                onClick={() => moveQuestion(qIndex, "up")}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                                title="Move up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={qIndex === editorData.questions.length - 1}
                                onClick={() => moveQuestion(qIndex, "down")}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                                title="Move down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeQuestion(qIndex)}
                                className="rounded p-1 text-rose-500 hover:bg-rose-100 hover:text-rose-700 ml-1"
                                title="Delete question"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Fields */}
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-700">
                                Question Text <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={q.questionText}
                                onChange={(e) =>
                                  updateQuestion(qIndex, { questionText: e.target.value })
                                }
                                placeholder="Enter question text (e.g. Units Covered, Rate Subject Faculty)"
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700">
                                Question Type <span className="text-rose-500">*</span>
                              </label>
                              <select
                                value={q.questionType}
                                onChange={(e) =>
                                  updateQuestion(qIndex, {
                                    questionType: e.target.value as QuestionType,
                                    options:
                                      e.target.value === "multiple_choice" && q.options.length === 0
                                        ? ["Option 1", "Option 2", "Option 3"]
                                        : q.options,
                                    minValue: e.target.value === "rating_scale" ? 1 : null,
                                    maxValue: e.target.value === "rating_scale" ? 5 : null,
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                              >
                                <option value="short_text">Short Text</option>
                                <option value="long_text">Long Text</option>
                                <option value="rating_scale">
                                  Rating Scale - Numeric rating (1-5, 1-10, etc.)
                                </option>
                                <option value="yes_no">Yes/No</option>
                                <option value="multiple_choice">
                                  Multiple Choice - Select one from options
                                </option>
                              </select>
                            </div>
                          </div>

                          {/* Rating Scale Configuration */}
                          {q.questionType === "rating_scale" ? (
                            <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/50 p-3">
                              <div className="mb-2 text-xs font-semibold text-amber-900">
                                Rating Scale Settings:
                              </div>
                              <div className="grid grid-cols-2 gap-3 max-w-xs">
                                <div>
                                  <label className="block text-xs text-amber-900">Minimum Value</label>
                                  <input
                                    type="number"
                                    value={q.minValue ?? 1}
                                    onChange={(e) =>
                                      updateQuestion(qIndex, { minValue: Number(e.target.value) || 1 })
                                    }
                                    className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-amber-900">Maximum Value</label>
                                  <input
                                    type="number"
                                    value={q.maxValue ?? 5}
                                    onChange={(e) =>
                                      updateQuestion(qIndex, { maxValue: Number(e.target.value) || 5 })
                                    }
                                    className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {/* Multiple Choice Options Configuration */}
                          {q.questionType === "multiple_choice" ? (
                            <div className="mt-3 rounded-md border border-indigo-200/80 bg-indigo-50/40 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-indigo-950">
                                  Options <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[11px] text-indigo-700">
                                  Leave empty options blank - they will be ignored
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {(q.options || []).map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-200 text-[10px] font-bold text-indigo-900">
                                      {optIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) =>
                                        handleUpdateOption(qIndex, optIdx, e.target.value)
                                      }
                                      placeholder={`Option ${optIdx + 1}`}
                                      className="flex-1 rounded border border-indigo-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOption(qIndex, optIdx)}
                                      className="text-slate-400 hover:text-rose-600 px-1 text-sm"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <div className="pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddOption(qIndex)}
                                  className="text-xs text-indigo-800 hover:bg-indigo-100/60"
                                >
                                  + Add Option
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {/* Required toggle */}
                          <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={q.isRequired}
                                onChange={(e) =>
                                  updateQuestion(qIndex, { isRequired: e.target.checked })
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                              />
                              This question is required
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-3.5">
              <Button
                variant="ghost"
                onClick={() => setIsEditorOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSaveForm()}
                disabled={saving}
                className="min-w-[130px]"
              >
                {saving ? "Saving..." : editingFormId ? "Update Form" : "Create Form"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* STUDENT LIVE PREVIEW MODAL                                                */}
      {/* ========================================================================= */}
      {previewForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-navy-900 px-6 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 text-navy-100">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Student Submission Preview</h3>
                  <p className="text-xs text-navy-200">
                    Live simulation of what students experience when submitting feedback
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewForm(null)}
                className="text-white hover:bg-navy-800"
              >
                ✕ Close Preview
              </Button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
              {/* Form Title & Anonymous Guarantee Banner */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-navy-900">{previewForm.name}</h2>
                </div>

                {previewForm.description ? (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {previewForm.description}
                  </p>
                ) : null}

                {/* Anonymous Banner */}
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-900">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-semibold block">100% Anonymous Feedback</span>
                    <span className="text-emerald-800 block">
                      Your identity will never be linked to your answers. Faculty and administrators will only see aggregated responses.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-navy-600" />
                  <span>
                    Form Template Preview • Responses are verified anonymously
                  </span>
                </div>
              </div>

              {previewSubmitted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-emerald-900">
                    Feedback Submitted Successfully!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Thank you for your valuable feedback. Your responses help maintain high academic standards.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPreviewAnswers({});
                      setPreviewSubmitted(false);
                    }}
                    className="mt-3"
                  >
                    Reset & Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-5 border-t border-slate-100 pt-5">
                  {(previewForm.questions || []).map((q, idx) => (
                    <div
                      key={q.id ?? idx}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <label className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {q.questionText}
                          {q.isRequired ? (
                            <span className="text-rose-500 ml-1">*</span>
                          ) : null}
                        </label>
                      </div>

                      {/* Multiple Choice Preview */}
                      {q.questionType === "multiple_choice" ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = previewAnswers[idx] === opt;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() =>
                                  setPreviewAnswers({ ...previewAnswers, [idx]: opt })
                                }
                                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                  isSelected
                                    ? "border-navy-600 bg-navy-50 text-navy-900 font-semibold"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                                    isSelected
                                      ? "border-navy-600 bg-navy-600 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isSelected ? "✓" : ""}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Rating Scale Preview */}
                      {q.questionType === "rating_scale" ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {Array.from(
                              {
                                length:
                                  (q.maxValue || 5) - (q.minValue || 1) + 1,
                              },
                              (_, i) => (q.minValue || 1) + i,
                            ).map((num) => {
                              const isSelected = previewAnswers[idx] === num;
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() =>
                                    setPreviewAnswers({ ...previewAnswers, [idx]: num })
                                  }
                                  className={`flex h-10 w-11 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition ${
                                    isSelected
                                      ? "border-navy-700 bg-navy-900 text-white shadow-sm"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-navy-300 hover:bg-slate-50"
                                  }`}
                                >
                                  <span>{num}</span>
                                  <Star
                                    className={`h-2.5 w-2.5 mt-0.5 ${
                                      isSelected
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-slate-300"
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-1.5 flex justify-between text-[11px] text-slate-600 max-w-xs">
                            <span>Poor ({q.minValue || 1})</span>
                            <span>Excellent ({q.maxValue || 5})</span>
                          </div>
                        </div>
                      ) : null}

                      {/* Yes/No Preview */}
                      {q.questionType === "yes_no" ? (
                        <div className="flex items-center gap-3">
                          {["Yes", "No"].map((choice) => {
                            const isSelected = previewAnswers[idx] === choice;
                            return (
                              <button
                                key={choice}
                                type="button"
                                onClick={() =>
                                  setPreviewAnswers({ ...previewAnswers, [idx]: choice })
                                }
                                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition ${
                                  isSelected
                                    ? "border-navy-600 bg-navy-50 text-navy-900"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                <span
                                  className={`h-3 w-3 rounded-full border ${
                                    isSelected ? "bg-navy-600 border-navy-600" : "border-slate-300"
                                  }`}
                                />
                                {choice}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Short Text Preview */}
                      {q.questionType === "short_text" ? (
                        <input
                          type="text"
                          value={(previewAnswers[idx] as string) || ""}
                          onChange={(e) =>
                            setPreviewAnswers({ ...previewAnswers, [idx]: e.target.value })
                          }
                          placeholder="Your answer..."
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-navy-500"
                        />
                      ) : null}

                      {/* Long Text Preview */}
                      {q.questionType === "long_text" ? (
                        <textarea
                          rows={2}
                          value={(previewAnswers[idx] as string) || ""}
                          onChange={(e) =>
                            setPreviewAnswers({ ...previewAnswers, [idx]: e.target.value })
                          }
                          placeholder="Your detailed feedback..."
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-navy-500"
                        />
                      ) : null}
                    </div>
                  ))}

                  <div className="pt-2">
                    <Button
                      onClick={() => setPreviewSubmitted(true)}
                      className="w-full justify-center"
                    >
                      Submit Feedback
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
