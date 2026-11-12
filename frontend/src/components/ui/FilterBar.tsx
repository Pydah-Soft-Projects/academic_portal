import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: Props) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

export function FilterField({ label, children }: FieldProps) {
  return (
    <label className="flex w-full flex-col gap-1 text-xs font-medium text-text-sub sm:w-auto sm:min-w-[140px] flex-1">
      {label}
      {children}
    </label>
  );
}

/** Keep first occurrence; removes duplicate labels like multiple "CSE" branches. */
export function uniqueOptions(options: string[]) {
  return Array.from(new Set(options.filter(Boolean)));
}

export function SelectFilter({
  options,
  defaultValue,
}: {
  options: string[];
  defaultValue?: string;
}) {
  const unique = uniqueOptions(options);
  const selected =
    defaultValue && unique.includes(defaultValue) ? defaultValue : unique[0];

  return (
    <select
      defaultValue={selected}
      className="h-11 sm:h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary"
    >
      {unique.map((option, index) => (
        <option key={`${option}__${index}`} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({
  placeholder = "Search…",
}: {
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      className="h-11 sm:h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:min-w-[220px]"
    />
  );
}
