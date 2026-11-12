"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ContentCardSkeleton } from "@/components/ui/CardSkeleton";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

type AttendanceThresholds = {
  eligibleThreshold: number;
  condonationMinThreshold: number;
};

type SettingsPayload = {
  collegeId: number | null;
  thresholds: AttendanceThresholds;
  usingDefaults: boolean;
  colleges: Array<{ id: number; name: string; hasOverride: boolean }>;
  description: string;
};

const DEFAULT_FORM: AttendanceThresholds = {
  eligibleThreshold: 75,
  condonationMinThreshold: 65,
};

export function AttendanceThresholdsSettingsView() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings.edit");

  const [collegeId, setCollegeId] = useState<string>("all");
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [form, setForm] = useState<AttendanceThresholds>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applySettings = useCallback((data: SettingsPayload) => {
    setSettings(data);
    setForm({ ...data.thresholds });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (collegeId !== "all") params.set("collegeId", collegeId);
      const res = await apiFetch(`/settings/attendance-thresholds?${params.toString()}`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : "Failed to load attendance thresholds",
        );
      }
      applySettings(body as SettingsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance thresholds");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [applySettings, collegeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savedKey = useMemo(
    () => (settings ? JSON.stringify(settings.thresholds) : ""),
    [settings],
  );
  const draftKey = useMemo(() => JSON.stringify(form), [form]);
  const dirty = settings != null && draftKey !== savedKey;

  function updateNumber(key: keyof AttendanceThresholds, value: string) {
    const parsed = Number(value);
    setForm((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  }

  async function save() {
    if (form.condonationMinThreshold >= form.eligibleThreshold) {
      setError("Condonation minimum threshold must be lower than the Eligible threshold.");
      return;
    }
    if (form.eligibleThreshold <= 0 || form.eligibleThreshold > 100) {
      setError("Eligible threshold must be between 1% and 100%.");
      return;
    }
    if (form.condonationMinThreshold <= 0 || form.condonationMinThreshold >= 100) {
      setError("Condonation minimum threshold must be between 1% and 99%.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/settings/attendance-thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId: collegeId === "all" ? null : Number(collegeId),
          eligibleThreshold: form.eligibleThreshold,
          condonationMinThreshold: form.condonationMinThreshold,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : "Failed to save attendance thresholds",
        );
      }
      applySettings(body as SettingsPayload);
      setMessage("Attendance thresholds saved successfully. Subject Attendance register and reports will use these rules.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attendance thresholds");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-navy-900 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-900/10";

  return (
    <div>
      <div className="mb-3.5 pb-2.5 border-b border-slate-200">
        <h2 className="text-base sm:text-lg font-bold text-navy-900 tracking-tight leading-tight">
          Attendance Percentage Setup &amp; Thresholds
        </h2>
        <p className="text-xs text-slate-500 font-normal mt-0.5">
          Configure dynamic eligibility percentage thresholds for exam eligibility, condonation, and detention.
        </p>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-critical">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {loading ? <ContentCardSkeleton contentHeight="h-56" /> : null}

      {!loading && settings ? (
        <>
          <Card className="mb-4">
            <p className="text-sm text-slate-600">{settings.description}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-navy-900">Scope</span>
                <select
                  className={fieldClass}
                  value={collegeId}
                  onChange={(event) => setCollegeId(event.target.value)}
                >
                  <option value="all">All colleges (global default)</option>
                  {settings.colleges.map((college) => (
                    <option key={college.id} value={String(college.id)}>
                      {college.name}
                      {college.hasOverride ? " · custom override" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end text-sm text-slate-600">
                {settings.usingDefaults ? (
                  <p>Using institutional defaults until you save custom values for this scope.</p>
                ) : (
                  <p className="text-emerald-700 font-medium">Custom thresholds are active for this scope.</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <h3 className="mb-3 text-sm font-semibold text-navy-900">Attendance Percentage Limits</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-700 font-medium">
                  Eligible Threshold (% and above)
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={fieldClass}
                  value={form.eligibleThreshold}
                  disabled={!canEdit}
                  onChange={(event) => updateNumber("eligibleThreshold", event.target.value)}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Students at or above this percentage are fully eligible for semester exams (Default: 75%).
                </span>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-700 font-medium">
                  Condonation Minimum Threshold (%)
                </span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, form.eligibleThreshold - 1)}
                  className={fieldClass}
                  value={form.condonationMinThreshold}
                  disabled={!canEdit}
                  onChange={(event) => updateNumber("condonationMinThreshold", event.target.value)}
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Minimum percentage required to apply for condonation. Below this is detained (Default: 65%).
                </span>
              </label>
            </div>
          </Card>

          {/* Dynamic Real-Time Preview Card */}
          <Card className="mb-4 bg-slate-50/50">
            <h3 className="mb-2 text-sm font-semibold text-navy-900">Rule Preview</h3>
            <p className="mb-3 text-xs text-slate-500">
              How student status and subject attendance metrics will be classified under these thresholds:
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Eligible
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-emerald-900">
                  ≥ {form.eligibleThreshold}%
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  Normal exam clearance. No penalty or fee required.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Condonation
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-amber-900">
                  {form.condonationMinThreshold}% – {Math.max(form.condonationMinThreshold, form.eligibleThreshold - 1)}%
                </div>
                <p className="mt-1 text-xs text-amber-700">
                  Requires medical / authorized condonation approval and fee.
                </p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                    Detained
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-rose-900">
                  &lt; {form.condonationMinThreshold}%
                </div>
                <p className="mt-1 text-xs text-rose-700">
                  At risk of semester detention / not permitted to sit for exams.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Link
              href="/settings"
              className="text-xs text-slate-500 hover:text-navy-900 underline underline-offset-4"
            >
              ← Back to Settings
            </Link>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    if (settings) setForm({ ...settings.thresholds });
                    setError(null);
                  }}
                >
                  Reset
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                disabled={!canEdit || !dirty || saving}
                onClick={() => void save()}
              >
                {saving ? "Saving..." : dirty ? "Save Thresholds" : "Saved"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

