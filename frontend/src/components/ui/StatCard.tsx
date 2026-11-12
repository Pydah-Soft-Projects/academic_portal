import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "critical" | "info";
  onClickHref?: string;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
};

const toneBorderMap = {
  default: "border-border bg-surface",
  success: "border-success/30 bg-success-light",
  warning: "border-warning/30 bg-warning-light",
  critical: "border-danger/30 bg-danger-light",
  info: "border-info/30 bg-info-light",
};

const tonePillMap = {
  default: "bg-text-muted",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-danger",
  info: "bg-info",
};

const toneValueMap = {
  default: "text-text-main",
  success: "text-success",
  warning: "text-warning",
  critical: "text-danger",
  info: "text-info",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  onClickHref,
  onClick,
  selected = false,
  compact = false,
  size,
  icon,
  badge,
  className,
}: Props) {
  const isCompact = compact || size === "sm";
  const isClickable = Boolean(onClickHref || onClick);

  const cardContent = isCompact ? (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-2 sm:p-2.5 shadow-2xs transition-all hover:shadow-xs",
        toneBorderMap[tone],
        isClickable && "cursor-pointer active:scale-[0.98]",
        selected && "ring-2 ring-primary border-primary bg-primary-light/50 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {badge}
          <p className="truncate text-[9.5px] sm:text-[11px] font-bold uppercase tracking-wider text-text-sub">
            {label}
          </p>
        </div>
        {icon ? (
          <span className="text-text-muted shrink-0">{icon}</span>
        ) : tone !== "default" ? (
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tonePillMap[tone])} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-0.5 truncate text-base sm:text-xl font-black tracking-tight leading-tight text-text-main",
          tone !== "default" && toneValueMap[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[9px] sm:text-[10px] text-text-muted leading-none print:hidden">
          {hint}
        </p>
      ) : null}
    </div>
  ) : (
    <div
      className={cn(
        "group relative rounded-xl sm:rounded-lg border bg-surface p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-sm print:p-1.5 print:shadow-none",
        toneBorderMap[tone],
        isClickable && "cursor-pointer active:scale-[0.98]",
        selected && "ring-2 ring-primary border-primary bg-primary-light/50 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {badge}
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-text-sub print:text-[9.5px] truncate">
            {label}
          </p>
        </div>
        {icon ? (
          <span className="text-text-muted shrink-0">{icon}</span>
        ) : tone !== "default" ? (
          <span className={cn("h-2 w-2 rounded-full shrink-0", tonePillMap[tone])} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-0.5 sm:mt-1.5 text-lg sm:text-2xl font-bold text-text-main tracking-tight print:mt-0 print:text-sm truncate",
          tone !== "default" && toneValueMap[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-text-sub print:hidden truncate">
          {hint}
        </p>
      ) : null}
    </div>
  );

  if (onClickHref) {
    return (
      <Link href={onClickHref} className="block">
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left focus:outline-hidden"
      >
        {cardContent}
      </button>
    );
  }

  return cardContent;
}

