export interface ToolParameterProperty {
  type: string;
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

export const PORTAL_AI_TOOLS: ToolDefinition[] = [
  {
    name: "get_user_profile",
    description:
      "Fetch personal profile and identity of the currently logged-in user, including full name, username, email, HRMS employee ID, and assigned roles.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_command_center_summary",
    description:
      "Fetch high-level Academic Portal command center summary: total active students, faculty count, section count, timetables published, attendance percentages, students below threshold, open risk cases, active exams, and classes today.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID to filter stats.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID to filter stats.",
        },
      },
    },
  },
  {
    name: "get_attendance_analytics",
    description:
      "Fetch overall attendance statistics, risk band distribution, and count of students below attendance threshold.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
      },
    },
  },
  {
    name: "get_today_attendance_summary",
    description:
      "Fetch today's scheduled, posted, and pending attendance session counts.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
      },
    },
  },
  {
    name: "get_student_details",
    description:
      "Fetch detailed student profile and attendance record by student ID or roll number / admission number.",
    parameters: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Student ID or admission number (e.g. '1234' or '22PY1A0584').",
        },
      },
      required: ["student_id"],
    },
  },
  {
    name: "search_students",
    description:
      "Search or list students filtered by query (name or admission number), branch, semester, or college.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Student name or admission/pin number to search.",
        },
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        year: {
          type: "number",
          description: "Year of study (1, 2, 3, 4).",
        },
        semester: {
          type: "number",
          description: "Semester number (1, 2).",
        },
        limit: {
          type: "number",
          description: "Maximum students to return (default 15).",
        },
      },
    },
  },
  {
    name: "get_faculty_directory",
    description:
      "List faculty members with optional filters for department or keyword.",
    parameters: {
      type: "object",
      properties: {
        departmentKey: {
          type: "string",
          description: "Optional department key (e.g., 'cse', 'ece').",
        },
        search: {
          type: "string",
          description: "Optional faculty name or designation search query.",
        },
      },
    },
  },
  {
    name: "get_faculty_details",
    description:
      "Fetch detailed faculty profile, contact info, department, and assigned courses by HRMS employee ID.",
    parameters: {
      type: "object",
      properties: {
        hrms_employee_id: {
          type: "string",
          description: "HRMS employee ID of the faculty member (e.g. 'PYD0123').",
        },
      },
      required: ["hrms_employee_id"],
    },
  },
  {
    name: "get_pending_requests",
    description:
      "Fetch pending approval requests across the portal (leaves, faculty substitutions, timetable changes) awaiting administrative review.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_active_examinations",
    description:
      "Fetch active and upcoming examinations, exam schedules, and registration details.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
      },
    },
  },
  {
    name: "get_today_timetable",
    description:
      "Fetch today's scheduled class timetable, periods, room assignments, and substitutions.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        date: {
          type: "string",
          description: "Optional date in 'YYYY-MM-DD' format (defaults to today).",
        },
      },
    },
  },
  {
    name: "get_faculty_workload_summary",
    description:
      "Fetch faculty teaching workload metrics, weekly periods, contact hours, and identify overloaded, underloaded, and balanced faculty members across departments.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        department: {
          type: "string",
          description: "Optional department name or code (e.g. 'CSE', 'ECE', 'HBS').",
        },
        search: {
          type: "string",
          description: "Optional faculty name or employee code search query.",
        },
        status: {
          type: "string",
          description: "Filter by workload status: 'Overloaded', 'Underloaded', or 'Balanced'.",
        },
        limit: {
          type: "number",
          description: "Max number of faculty records to return (defaults to 20).",
        },
      },
    },
  },
  {
    name: "get_faculty_workload_detail",
    description:
      "Fetch detailed class timetable schedule and teaching load for an individual faculty member by HRMS employee ID or staff link ID, including subjects, sections, periods/week, and timing slots.",
    parameters: {
      type: "object",
      properties: {
        faculty_id: {
          type: "string",
          description: "HRMS employee ID (e.g. 'PYD0123' or '21533'), employee code, or staff link ID of the faculty member.",
        },
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
      },
      required: ["faculty_id"],
    },
  },
  {
    name: "get_student_academic_results",
    description:
      "Fetch university examination results, semester-wise SGPA, overall CGPA, grades per subject, credits earned, and backlog details for a student by roll number or admission number.",
    parameters: {
      type: "object",
      properties: {
        roll_number: {
          type: "string",
          description: "Student PIN / university roll number or admission number (e.g. '22PY1A0584').",
        },
      },
      required: ["roll_number"],
    },
  },
  {
    name: "get_internal_marks_submissions",
    description:
      "Fetch mid-term / internal marks submissions, approval status (Draft, Submitted to HOD, Approved by Principal), student counts, and submission timestamps across subjects and branches.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        courseId: {
          type: "number",
          description: "Optional Course ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        subjectId: {
          type: "number",
          description: "Optional Subject ID filter.",
        },
        status: {
          type: "string",
          description: "Optional status filter (e.g. 'draft', 'submitted_hod', 'submitted_principal', 'approved_principal').",
        },
      },
    },
  },
  {
    name: "get_mentoring_cases",
    description:
      "Fetch student mentoring dashboard, high/medium risk student counts, attendance concerns, open mentoring cases, follow-ups due, and mentor allocations.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        year: {
          type: "number",
          description: "Optional year of study (1, 2, 3, 4).",
        },
        riskLevel: {
          type: "string",
          description: "Filter by risk level: 'High', 'Medium', or 'Low'.",
        },
      },
    },
  },
  {
    name: "get_class_teacher_directory",
    description:
      "Fetch class teacher assignments, assigned mentors, section coordinators, and timetable readiness status across all sections and branches.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        courseId: {
          type: "number",
          description: "Optional Course ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        academicYear: {
          type: "string",
          description: "Optional academic year label (e.g. '2026-2027').",
        },
      },
    },
  },
  {
    name: "get_curriculum_subjects",
    description:
      "Fetch curriculum structure, syllabus, subject codes, subject names, course types (Theory, Lab, Project), and credits mapped for a course, branch, batch, and semester.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
        courseId: {
          type: "number",
          description: "Optional Course ID filter.",
        },
        branchId: {
          type: "number",
          description: "Optional Branch ID filter.",
        },
        batch: {
          type: "string",
          description: "Optional batch label (e.g. '2022-2026').",
        },
        year: {
          type: "number",
          description: "Year of study (1, 2, 3, 4).",
        },
        semester: {
          type: "number",
          description: "Semester number (1, 2).",
        },
      },
    },
  },
  {
    name: "get_academic_calendar",
    description:
      "Fetch academic calendar holidays, semester start/end dates, and scheduled non-instructional days.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date in 'YYYY-MM-DD' format (defaults to 1 month ago).",
        },
        endDate: {
          type: "string",
          description: "End date in 'YYYY-MM-DD' format (defaults to 6 months ahead).",
        },
        collegeId: {
          type: "number",
          description: "Optional College ID filter.",
        },
      },
    },
  },
  {
    name: "get_institutional_catalog",
    description:
      "Fetch the institutional organizational hierarchy: colleges, courses, departments/branches, academic years, and sections.",
    parameters: {
      type: "object",
      properties: {
        collegeId: {
          type: "number",
          description: "Optional College ID to filter departments/courses.",
        },
      },
    },
  },
];

// Alias for backward compatibility
export const SUPER_ADMIN_TOOLS = PORTAL_AI_TOOLS;

