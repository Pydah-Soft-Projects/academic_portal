"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/cn";

export type YearAccessOption = {
  id: string;
  label: string;
  badge: string;
};

export const YEAR_ACCESS_OPTIONS: YearAccessOption[] = [
  { id: "all", label: "All Years", badge: "All years" },
  { id: "1", label: "1st Year", badge: "1st Year" },
  { id: "2", label: "2nd Year", badge: "2nd Year" },
  { id: "3", label: "3rd Year", badge: "3rd Year" },
  { id: "4", label: "4th Year", badge: "4th Year" },
];

export type YearAccessControlProps = {
  selectedYears?: string[];
  onChange?: (years: string[]) => void;
  roleTitle?: string;
  className?: string;
  readOnly?: boolean;
};

export function YearAccessControl({
  selectedYears = ["all"],
  onChange,
  roleTitle = "HOD",
  className,
  readOnly = false,
}: YearAccessControlProps) {
  const isAll =
    !selectedYears ||
    selectedYears.length === 0 ||
    selectedYears.includes("all");

  const badgeText = isAll
    ? "All years"
    : selectedYears
        .map((y) => YEAR_ACCESS_OPTIONS.find((o) => o.id === y)?.badge || `${y} Year`)
        .join(", ");

  const helperText = isAll
    ? `This ${roleTitle} can access students in all years of the selected course/branch.`
    : `This ${roleTitle} can access students in ${badgeText} of the selected course/branch.`;

  const handleToggle = (id: string) => {
    if (readOnly || !onChange) return;

    if (id === "all") {
      onChange(["all"]);
      return;
    }

    if (isAll) {
      onChange([id]);
      return;
    }

    if (selectedYears.includes(id)) {
      const remaining = selectedYears.filter((y) => y !== id);
      if (remaining.length === 0) {
        onChange(["all"]);
      } else {
        onChange(remaining);
      }
    } else {
      const next = [...selectedYears.filter((y) => y !== "all"), id].sort();
      onChange(next);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Calendar className="h-4 w-4 text-[#f59e0b]" />
          <span>Year Access</span>
          <span className="text-rose-500 font-bold">*</span>
        </div>
        <span className="rounded-md bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {badgeText}
        </span>
      </div>

      {/* Dashed Selection Container */}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/40 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {YEAR_ACCESS_OPTIONS.map((opt) => {
            const isOptAll = opt.id === "all";
            const isSelected = isOptAll ? isAll : !isAll && selectedYears.includes(opt.id);

            let pillClasses = "";
            if (isOptAll && isSelected) {
              // Solid orange for active "All Years"
              pillClasses = "bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold shadow-xs border-transparent";
            } else if (!isOptAll && isSelected) {
              // Cream with amber border for active specific years
              pillClasses = "border border-[#fbbf24] bg-[#fefce8] text-[#78350f] font-semibold shadow-xs";
            } else {
              // Neutral white pill for inactive
              pillClasses = "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium";
            }

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggle(opt.id)}
                disabled={readOnly}
                className={cn(
                  "rounded-xl px-4 py-1.5 text-xs transition-colors select-none",
                  readOnly ? "cursor-default" : "cursor-pointer",
                  pillClasses
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 font-normal">
          {helperText}
        </p>
      </div>
    </div>
  );
}


export function getUserYearAccess(
  userId: number | string | undefined | null,
  fallbackYears: string[] = ["all"],
): string[] {
  if (!userId) return fallbackYears;
  if (typeof window === "undefined") return fallbackYears;
  try {
    const raw = localStorage.getItem(`academic_user_year_access_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return fallbackYears;
}

export function setUserYearAccess(
  userId: number | string | undefined | null,
  years: string[],
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`academic_user_year_access_${userId}`, JSON.stringify(years));
    window.dispatchEvent(new CustomEvent("academic_user_year_access_changed", { detail: { userId, years } }));
  } catch {}
}
