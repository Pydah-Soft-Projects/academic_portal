"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  headerActions?: React.ReactNode;
};

export function Modal({ title, children, onClose, wide, headerActions }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[94vh] sm:max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-text-main shadow-xl ${
          wide ? "max-w-3xl" : "max-w-2xl"
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
