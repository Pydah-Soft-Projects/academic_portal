export type FacultyLoad = {
  id: string;
  staffLinkId: number;
  hrmsEmployeeId: string;
  code: string;
  name: string;
  department: string;
  division: string;
  designation?: string;
  profilePhoto?: string | null;
  periodsPerWeek: number;
  hoursPerWeek: number;
  hoursByDay: {
    MON: number;
    TUE: number;
    WED: number;
    THUR: number;
    FRI: number;
    SAT: number;
    SUN: number;
  };
  periodsByDay: {
    MON: number;
    TUE: number;
    WED: number;
    THUR: number;
    FRI: number;
    SAT: number;
    SUN: number;
  };
  status: string;
};

export type WorkloadSummary = {
  kpis: {
    totalFaculty: number;
    averageLoad: number;
    averageHours?: number;
    overloaded: number;
    underloaded: number;
    balanced: number;
  };
  thresholds?: {
    minPeriodsPerWeek: number;
    maxPeriodsPerWeek: number;
    maxPeriodsPerDay: number;
    minHoursPerWeek: number | null;
    maxHoursPerWeek: number | null;
  };
  faculty: FacultyLoad[];
  filterOptions?: {
    divisions: string[];
    departments: string[];
  };
  source?: string;
};

export const DAY_COLUMNS = [
  { key: "MON", label: "Mon", full: "Monday" },
  { key: "TUE", label: "Tue", full: "Tuesday" },
  { key: "WED", label: "Wed", full: "Wednesday" },
  { key: "THUR", label: "Thu", full: "Thursday" },
  { key: "FRI", label: "Fri", full: "Friday" },
  { key: "SAT", label: "Sat", full: "Saturday" },
] as const;
