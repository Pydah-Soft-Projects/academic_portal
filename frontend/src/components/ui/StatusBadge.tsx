import { cn } from "@/lib/cn";

type Props = {
  status: string;
};

const styles: Record<string, string> = {
  Active: "bg-info-light text-info",
  Inactive: "bg-background text-text-sub border border-border",
  Regular: "bg-success-light text-success",
  "Course Completed": "bg-background text-text-sub border border-border",
  "Admission Cancelled": "bg-danger-light text-danger",
  Detained: "bg-warning-light text-warning",
  Discontinued: "bg-danger-light text-danger",
  "Long Absent": "bg-warning-light text-warning",
  "Re-Joined": "bg-info-light text-info",
  Rejoined: "bg-info-light text-info",
  Published: "bg-success-light text-success",
  Draft: "bg-background text-text-sub border border-border",
  Balanced: "bg-success-light text-success",
  Overloaded: "bg-danger-light text-danger",
  Underloaded: "bg-warning-light text-warning",
  Critical: "bg-danger-light text-danger",
  High: "bg-warning-light text-warning",
  Medium: "bg-info-light text-info",
  Low: "bg-success-light text-success",
  Open: "bg-warning-light text-warning",
  Closed: "bg-success-light text-success",
  Pending: "bg-warning-light text-warning",
  Posted: "bg-success-light text-success",
  Paid: "bg-success-light text-success",
  Pass: "bg-success-light text-success",
  Fail: "bg-danger-light text-danger",
  Supply: "bg-warning-light text-warning",
  Submitted: "bg-info-light text-info",
  PendingApproval: "bg-warning-light text-warning",
  Approved: "bg-success-light text-success",
  Rejected: "bg-danger-light text-danger",
  Returned: "bg-warning-light text-warning",
  Cancelled: "bg-background text-text-sub border border-border",
  "Forwarded To Ems": "bg-success-light text-success font-semibold border border-success/25",
  "Ems Sync Failed": "bg-danger-light text-danger font-semibold border border-danger/25",
  Synced: "bg-success-light text-success font-semibold border border-success/25",
};

function titleCase(value: string) {
  if (!value) return value;
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status }: Props) {
  const label = titleCase(status);
  const style =
    styles[status] ??
    styles[label] ??
    Object.entries(styles).find(([key]) => key.toLowerCase() === status.toLowerCase())?.[1] ??
    "bg-background text-text-sub border border-border";

  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", style)}>
      {label || status}
    </span>
  );
}
