"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
  maxWidth?: string;
  headerActions?: React.ReactNode;
  className?: string;
};

const sizeClasses: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
  "3xl": "max-w-4xl",
  "4xl": "max-w-5xl",
  "5xl": "max-w-6xl",
  "6xl": "max-w-7xl",
  full: "max-w-[96vw]",
};

export function Modal({ title, children, onClose, wide, size, maxWidth, headerActions, className }: Props) {
  const widthClass = maxWidth || (size ? sizeClasses[size] : wide ? "max-w-3xl" : "max-w-2xl");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[94vh] sm:max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-text-main shadow-xl ${widthClass} ${
          className || ""
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3.5 sm:px-5 py-2 sm:py-3">
          <h3 className="text-xs sm:text-sm md:text-base font-semibold text-primary leading-snug line-clamp-2">{title}</h3>
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {headerActions}
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 sm:h-8 px-2 sm:px-3 text-xs">
              Close
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4">{children}</div>
      </div>
    </div>
  );
}
