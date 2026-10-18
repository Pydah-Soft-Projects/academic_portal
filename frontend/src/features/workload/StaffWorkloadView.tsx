"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { apiFetch } from "@/lib/api";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { Calendar, Search } from "lucide-react";
import { FacultyTimetableModal } from "@/features/workload/FacultyTimetableModal";

const selectClassName =
  "h-9 w-full sm:w-auto rounded-md border border-border bg-white px-2.5 text-xs text-navy-900 outline-none focus:border-brand-600 sm:min-w-[150px]";

const searchClassName =
  "h-9 w-full sm:w-auto rounded-md border border-border bg-white px-2.5 text-xs text-navy-900 outline-none focus:border-brand-600 sm:min-w-[240px]";

import {
  type FacultyLoad,
  type WorkloadSummary,
  DAY_COLUMNS,
} from "./types";

export type { FacultyLoad, WorkloadSummary };
export { DAY_COLUMNS };

export function StaffWorkloadView({ embedded = false }: { embedded?: boolean }) {
  const [summary, setSummary] = useState<WorkloadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyLoad | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (divisionFilter !== "all") params.set("division", divisionFilter);
    if (deptFilter !== "all") params.set("department", deptFilter);
    if (search) params.set("search", search);
    return params.toString();
  }, [divisionFilter, deptFilter, search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/workload/summary${query ? `?${query}` : ""}`, {
          cache: "no-store",
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            typeof body === "object" && body && "message" in body
              ? String((body as { message: string }).message)
              : "Failed to load workload",
          );
        }

        if (!cancelled) {
          setSummary(body as WorkloadSummary);
        }
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setError(err instanceof Error ? err.message : "Failed to load workload");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const divisionOptions = summary?.filterOptions?.divisions ?? [];
  const deptOptions = summary?.filterOptions?.departments ?? [];
  const faculty = summary?.faculty ?? [];

  const kpis = summary?.kpis ?? {
    totalFaculty: 0,
    averageLoad: 0,
    averageHours: 0,
    overloaded: 0,
    underloaded: 0,
    balanced: 0,
  };

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title="Staff Workload"
          description={
            summary?.source ||
            "Weekly teaching workload, day-wise slot distribution, and published timetable schedules across faculty."
          }
        />
      ) : null}

      {/* FILTER CONTROLS BAR (Search, Divisions, Departments) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-card p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="search"
              placeholder="Search faculty name, ID, role, or department…"
              className={searchClassName}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

          <select
            className={selectClassName}
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
          >
            <option value="all">All divisions</option>
            {divisionOptions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>

          <select
            className={selectClassName}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All departments</option>
            {deptOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-semibold text-slate-500 shrink-0">
          Showing <strong className="text-navy-900">{faculty.length}</strong> faculty
        </span>
      </div>

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      {/* WORKLOAD KPI STAT CARDS (No Attendance) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4 sm:gap-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              compact
              label="Total Faculty"
              value={kpis.totalFaculty}
              hint="In active scope"
            />
            <StatCard
              compact
              label="Average Load"
              value={`${kpis.averageLoad} p/wk`}
              hint={kpis.averageHours ? `${kpis.averageHours} hrs/wk avg` : "Per faculty"}
              tone="info"
            />
            <StatCard
              compact
              label="Balanced Faculty"
              value={kpis.balanced}
              hint="Optimal weekly load"
              tone="success"
            />
            <StatCard
              compact
              label="Workload Alerts"
              value={`${kpis.overloaded} Over · ${kpis.underloaded} Under`}
              hint={kpis.overloaded > 0 ? "Requires rebalancing" : "Normal distribution"}
              tone={kpis.overloaded > 0 ? "warning" : "default"}
            />
          </>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={10} rows={7} />
      ) : (
        <>
          {/* MOBILE CARD VIEW FOR FACULTY WORKLOAD */}
          <div className="block md:hidden space-y-2.5">
            {faculty.length === 0 ? (
              <div className="rounded-xl border border-border bg-white p-6 text-center text-xs text-slate-500">
                No faculty match the current filters.
              </div>
            ) : (
              faculty.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-border/80 bg-white p-3 shadow-2xs space-y-2.5 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FacultyAvatar
                        name={row.name}
                        photo={row.profilePhoto}
                        hrmsEmployeeId={row.hrmsEmployeeId}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-navy-900 text-xs truncate">{row.name}</p>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                          <span className="font-mono font-semibold text-slate-600">
                            {row.hrmsEmployeeId || row.code}
                          </span>
                          {row.designation && row.designation !== "—" ? (
                            <>
                              <span>•</span>
                              <span className="truncate">{row.designation}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                      {row.department}
                    </span>
                  </div>

                  {/* Day-wise slot distribution cards */}
                  <div className="grid grid-cols-6 gap-1 rounded-lg bg-slate-50/80 p-1.5 text-center text-[10px] border border-slate-100">
                    {DAY_COLUMNS.map((d) => {
                      const count = row.periodsByDay?.[d.key] ?? 0;
                      return (
                        <div key={d.key} className="flex flex-col items-center">
                          <span className="text-[9px] font-semibold text-slate-400 uppercase">
                            {d.label}
                          </span>
                          <span
                            className={`font-bold mt-0.5 ${
                              count > 0 ? "text-indigo-950 font-extrabold" : "text-slate-300"
                            }`}
                          >
                            {count > 0 ? count : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom bar with load summary & View Grid button */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px]">
                        <strong className="text-navy-900 font-bold">{row.periodsPerWeek} p/wk</strong>{" "}
                        <span className="text-slate-400 text-[10px]">({row.hoursPerWeek}h)</span>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2.5 text-[11px] font-semibold text-indigo-900 bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                      onClick={() => setSelectedFaculty(row)}
                    >
                      <Calendar className="h-3 w-3 mr-1 text-indigo-600" />
                      View Grid
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP TABLE: Photo, Name, ID, Role, Department, Mon-Sat Slot Counts, Weekly Load & Grid Button */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-border">
                  <th className="px-3 py-3 w-[24%]">Faculty Member</th>
                  <th className="px-3 py-3 w-[10%]">Department</th>
                  <th className="px-2 py-3 text-center w-[6%]">Mon</th>
                  <th className="px-2 py-3 text-center w-[6%]">Tue</th>
                  <th className="px-2 py-3 text-center w-[6%]">Wed</th>
                  <th className="px-2 py-3 text-center w-[6%]">Thu</th>
                  <th className="px-2 py-3 text-center w-[6%]">Fri</th>
                  <th className="px-2 py-3 text-center w-[6%]">Sat</th>
                  <th className="px-3 py-3 w-[17%]">Weekly Load</th>
                  <th className="px-3 py-3 text-right w-[13%]">Timetable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {faculty.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                      No faculty match the current filters.
                    </td>
                  </tr>
                ) : (
                  faculty.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedFaculty(row)}
                    >
                      {/* Photo, Name, ID, Role */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <FacultyAvatar
                            name={row.name}
                            photo={row.profilePhoto}
                            hrmsEmployeeId={row.hrmsEmployeeId}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-navy-900 group-hover:text-indigo-600 transition-colors truncate">
                              {row.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-mono font-semibold text-slate-700">
                                {row.hrmsEmployeeId || row.code}
                              </span>
                              {row.designation && row.designation !== "—" ? (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span
                                    className="text-slate-500 font-medium truncate max-w-[140px]"
                                    title={row.designation}
                                  >
                                    {row.designation}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                          {row.department || "—"}
                        </span>
                      </td>

                      {/* Day slots counts: Mon - Sat */}
                      {DAY_COLUMNS.map((d) => {
                        const count = row.periodsByDay?.[d.key] ?? 0;
                        const hours = row.hoursByDay?.[d.key] ?? 0;
                        return (
                          <td key={d.key} className="px-2 py-3 text-center">
                            {count > 0 ? (
                              <div className="inline-flex flex-col items-center justify-center">
                                <span
                                  className="inline-flex min-w-[28px] h-6 px-1.5 items-center justify-center rounded-md bg-indigo-50 border border-indigo-200/80 text-xs font-bold text-indigo-900 shadow-2xs group-hover:bg-indigo-100 transition-colors"
                                  title={`${d.full}: ${count} slot${count === 1 ? "" : "s"} (${hours} hrs)`}
                                >
                                  {count}
                                </span>
                                {hours > 0 ? (
                                  <span className="text-[9.5px] text-slate-400 mt-0.5 font-medium">
                                    {hours}h
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-slate-300 font-medium text-xs">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Weekly Load */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-baseline gap-1">
                              <span className="font-extrabold text-navy-900 text-xs">
                                {row.periodsPerWeek}
                              </span>
                              <span className="text-[11px] text-slate-600 font-medium">
                                periods/wk
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">
                              ({row.hoursPerWeek} hrs/wk)
                            </span>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                      </td>

                      {/* Actions: Grid popup button */}
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7.5 px-3 text-xs font-semibold shadow-2xs border-slate-300 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer"
                          onClick={() => setSelectedFaculty(row)}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                          View Grid
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TIMETABLE GRID POPUP MODAL */}
      <FacultyTimetableModal
        open={Boolean(selectedFaculty)}
        faculty={selectedFaculty}
        onClose={() => setSelectedFaculty(null)}
      />
    </div>
  );
}
