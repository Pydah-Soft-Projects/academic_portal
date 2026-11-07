import type { RowDataPacket, ResultSetHeader } from "mysql2";
import crypto from "crypto";
import { executeAcademic, queryAcademic, queryStudent, withAcademicTransaction } from "../db/pools.js";
import type { AcademicScope } from "../authz/authorization.service.js";

export type FeedbackQuestion = {
  id?: number;
  formId?: number;
  questionText: string;
  questionType: "short_text" | "long_text" | "rating_scale" | "yes_no" | "multiple_choice";
  isRequired: boolean;
  orderIndex: number;
  minValue?: number | null;
  maxValue?: number | null;
  options: string[];
};

export type FeedbackForm = {
  id: number;
  name: string;
  description: string | null;
  questionCount?: number;
  questions?: FeedbackQuestion[];
  createdAt?: string;
  updatedAt?: string;
};

export type MappedStaffSubject = {
  staffLinkId: number | null;
  facultyName: string;
  employeeCode?: string | null;
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  sectionName?: string | null;
  semester?: number | null;
  branchId?: number | null;
  branchName?: string | null;
  branchCode?: string | null;
  courseId?: number | null;
  courseName?: string | null;
  courseCode?: string | null;
  collegeId?: number | null;
  collegeName?: string | null;
  collegeCode?: string | null;
  academicYear?: string | null;
  batch?: string | null;
  yearOfStudy?: number | null;
};

export type TargetAudienceScope = {
  batches: string[];
  sections: string[];
  yearsOfStudy: number[];
  audienceType?: "all" | "targeted";
  summary?: string;
};

export type FeedbackPublication = {
  id: number;
  formId: number;
  formName: string;
  title: string;
  collegeId: number | null;
  collegeName: string | null;
  targetColleges?: Array<{ id: number; name: string; code?: string | null }> | null;
  courseId?: number | null;
  courseName?: string | null;
  targetCourses?: Array<{ id: number; name: string; code?: string | null; collegeId?: number }> | null;
  branchId: number | null;
  branchName: string | null;
  targetBranches?: Array<{ id: number; name: string; code?: string | null; courseId?: number }> | null;
  targetAudience?: TargetAudienceScope | null;
  mappedStaffSubjects?: MappedStaffSubject[] | null;
  academicYear: string;
  semester: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: "active" | "scheduled" | "closed";
  responseCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QuestionSummary = {
  questionId: number;
  questionText: string;
  questionType: string;
  shortLabel: string;
  abstract: string;
  avgScore?: number | null;
  ratingTier?: "excellent" | "good" | "average" | "poor" | "none";
  distribution?: Record<string, number>;
};

export type StudentResponseDetail = {
  id: number;
  studentName: string;
  tokenHash: string;
  submittedAt: string;
  branchName: string;
  semester: number;
  sectionName: string;
  subjectName: string;
  facultyName: string;
  answers: Record<string, unknown>;
  unitsCovered?: string | null;
  facultyRating?: number | null;
  unitStatus?: string | null;
};

export type SubjectSectionReportItem = {
  id: string;
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  staffLinkId: number | null;
  facultyName: string;
  employeeCode: string | null;
  branchId: number | null;
  branchName: string;
  courseId: number | null;
  courseName: string;
  semester: number;
  romanSemester: string;
  yearOfStudy?: number;
  sectionName: string | null;
  count: number;
  questions: QuestionSummary[];
  studentDetails: StudentResponseDetail[];
};

export type SectionGroup = {
  groupKey: string;
  branchId: number | null;
  branchName: string;
  courseId: number | null;
  courseName: string;
  semester: number;
  romanSemester: string;
  yearOfStudy?: number;
  sectionName: string | null;
  sectionLabel: string;
  subjectCount: number;
  totalSubmissions: number;
  subjects: SubjectSectionReportItem[];
};

export type FacultyGroup = {
  facultyKey: string;
  facultyName: string;
  employeeCode: string | null;
  staffLinkId: number | null;
  totalSubjects: number;
  totalSubmissions: number;
  overallRating: number | null;
  subjects: Array<SubjectSectionReportItem & { classLabel: string }>;
};

function computeStudentToken(studentId: number, publicationId: number, subjectName: string): string {
  const raw = `${studentId}-${publicationId}-${String(subjectName || "").trim().toLowerCase()}`;
  return "anon_" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 12);
}

export type StudentSubjectEvaluation = {
  subjectName: string;
  subjectCode?: string;
  facultyName: string;
  unitsCovered?: string | null;
  facultyRating?: number | null;
  unitStatus?: string | null;
  answers: Record<string, unknown>;
  submittedAt: string;
};

export type StudentReportItem = {
  id: string;
  studentPin: string;
  studentName: string;
  tokenHash?: string;
  collegeId?: number | null;
  courseId?: number | null;
  courseName: string;
  branchId?: number | null;
  branchName: string;
  yearOfStudy: number;
  semester: number;
  romanSemester: string;
  sectionName: string;
  status: "submitted" | "partial" | "pending";
  totalEvaluated: number;
  totalExpected?: number;
  lastSubmittedAt?: string | null;
  evaluations: StudentSubjectEvaluation[];
};

export type FeedbackReportData = {
  publicationQuestions?: FeedbackQuestion[];
  sectionGroups?: SectionGroup[];
  facultyGroups?: FacultyGroup[];
  studentReports?: StudentReportItem[];
  publication: FeedbackPublication | null;
  publications: Array<FeedbackPublication>;
  forms: Array<{ id: number; name: string; questionCount: number }>;
  availableColleges: Array<{ id: number; name: string; code: string }>;
  availableCourses: Array<{ id: number; name: string; code: string; collegeId: number }>;
  availableBranches: Array<{ id: number; name: string; code: string; courseId?: number }>;
  availableAcademicYears: Array<{ label: string; isActive: boolean }>;
  currentAcademicYear: string;
  availableBatches: string[];
  availableSections: string[];
  availableYearsOfStudy: number[];
  availableStaffSubjects: MappedStaffSubject[];
  filters: {
    selectedPublicationId: number | null;
    selectedBranch: string | null;
    selectedSemester: number | null;
    availableSemesters: number[];
  };
  stats: {
    totalSubmissions: number;
    averageRating: number | null;
    ratingSatisfactionPct: number | null;
    averageUnitsCovered: number | null;
    completionRate: number | null;
  };
  unitsCoveredDistribution: Array<{
    unit: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  facultyRatingDistribution: Array<{
    stars: number;
    count: number;
    percentage: number;
  }>;
  unitStatusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  facultyBreakdown: Array<{
    facultyName: string;
    subjectName: string;
    branchName: string;
    responsesCount: number;
    avgRating: number;
    avgUnits: number;
    mostCommonStatus: string;
    statusBadge: "Excellent" | "Good" | "Satisfactory" | "Needs Attention";
  }>;
  recentSubmissions: Array<{
    id: number;
    submittedAt: string;
    branchName: string;
    semester: number;
    sectionName: string;
    subjectName: string;
    facultyName: string;
    unitsCovered: string;
    facultyRating: number;
    unitStatus: string;
    tokenHash: string;
    studentName?: string;
  }>;
  /** Submission progress grouped by faculty+subject (sections combined into one row) */
  submissionProgress: Array<{
    facultyName: string;
    employeeCode: string | null;
    subjectName: string;
    subjectCode: string;
    /** All section/sem/batch allocations for this faculty-subject pair */
    sections: Array<{
      sectionName: string | null;
      semester: number | null;
      batch: string | null;
      branchName: string | null;
      submittedCount: number;
      expectedCount: number | null;
      status: "pending" | "partial" | "submitted";
    }>;
    totalSubmittedCount: number;
    totalExpectedCount: number | null;
    overallStatus: "pending" | "partial" | "submitted";
    averageRating: number | null;
    averageUnitsCovered: number | null;
    completionRate: number | null;
    unitsCoveredDistribution: Array<{
      unit: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    facultyRatingDistribution: Array<{
      stars: number;
      count: number;
      percentage: number;
    }>;
    unitStatusDistribution: Array<{
      status: string;
      count: number;
      percentage: number;
      color: string;
    }>;
  }>;
  submissionSummary: {
    totalAllocations: number;
    pendingAllocations: number;
    partialAllocations: number;
    submittedAllocations: number;
    overallSubmittedCount: number;
  };
};

type FormRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  question_count?: number;
};

type QuestionRow = RowDataPacket & {
  id: number;
  form_id: number;
  question_text: string;
  question_type: string;
  is_required: number;
  order_index: number;
  min_value: number | null;
  max_value: number | null;
  options_json: string | string[] | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type PublicationRow = RowDataPacket & {
  id: number;
  form_id: number;
  form_name?: string;
  title: string;
  college_id: number | null;
  college_name: string | null;
  target_colleges?: string | null;
  course_id?: number | null;
  course_name?: string | null;
  target_courses?: string | null;
  branch_id: number | null;
  branch_name: string | null;
  target_branches?: string | null;
  target_audience?: string | null;
  mapped_staff_subjects?: string | null;
  academic_year: string;
  semester: number | null;
  start_date: string | Date;
  end_date: string | Date;
  is_active: number;
  created_at: string | Date;
  updated_at: string | Date;
  response_count?: number;
};

type ResponseRow = RowDataPacket & {
  id: number;
  publication_id: number | null;
  form_id: number;
  college_id: number | null;
  branch_name: string | null;
  academic_year: string | null;
  semester: number | null;
  section_name: string | null;
  subject_name: string | null;
  faculty_name: string | null;
  student_token_hash: string | null;
  units_covered: string | null;
  faculty_rating: number | null;
  unit_status: string | null;
  answers_json: string | Record<string, unknown>;
  submitted_at: string | Date;
};

let tableReady: Promise<void> | null = null;

function normalizeSqlDate(val: string | Date | unknown): string {
  if (!val) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    const hours = String(val.getHours()).padStart(2, "0");
    const min = String(val.getMinutes()).padStart(2, "0");
    const sec = String(val.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${min}:${sec}`;
  }
  const str = String(val).trim();
  // If already standard ISO or datetime-local format: "YYYY-MM-DDTHH:mm(:ss)?" or "YYYY-MM-DD HH:mm(:ss)?"
  const isoLocalMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (isoLocalMatch) {
    const [, y, m, d, hh, mm, ss] = isoLocalMatch;
    return `${y}-${m}-${d} ${String(hh).padStart(2, "0")}:${mm}:${ss || "00"}`;
  }

  // If date-only: "YYYY-MM-DD"
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]} 00:00:00`;
  }


  const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1];
    const month = ddmmyyyy[2];
    const year = ddmmyyyy[3];
    let hour = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0;
    const min = ddmmyyyy[5] || "00";
    const sec = ddmmyyyy[6] || "00";
    const ampm = ddmmyyyy[7]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${year}-${month}-${day} ${String(hour).padStart(2, "0")}:${min}:${sec}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const sec = String(d.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${min}:${sec}`;
  }

  return str.replace("T", " ").slice(0, 19);
}

function getCurrentIndianDateTime(): string {
  const parts: Record<string, string> = {};
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (const part of formatter.formatToParts(new Date())) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function toIsoString(val: string | Date | unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const d = new Date(val as string);
  if (!isNaN(d.getTime())) return d.toISOString();
  return String(val);
}

function toPublicationDateTime(val: string | Date | unknown): string {
  return normalizeSqlDate(val).replace(" ", "T");
}

function parseOptions(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter((s) => s.trim().length > 0);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter((s) => s.trim().length > 0);
  } catch {
    // ignore
  }
  return [];
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await queryAcademic<(RowDataPacket & { c: number })[]>(
    `SELECT COUNT(*) as c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function ensureFeedbackFormsTable() {
  if (!tableReady) {
    tableReady = (async () => {
      // 1. Form definition table
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_feedback_forms (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 2. Questions table
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_feedback_questions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          form_id INT NOT NULL,
          question_text VARCHAR(500) NOT NULL,
          question_type VARCHAR(50) NOT NULL,
          is_required TINYINT(1) NOT NULL DEFAULT 1,
          order_index INT NOT NULL DEFAULT 0,
          min_value INT NULL,
          max_value INT NULL,
          options_json JSON NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_feedback_questions_form (form_id, order_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // 3. Publications table (managing date ranges & publishing from Reports)
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_feedback_publications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          form_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          college_id INT NULL,
          college_name VARCHAR(150) NULL,
          target_colleges JSON NULL,
          course_id INT NULL,
          course_name VARCHAR(255) NULL,
          target_courses JSON NULL,
          branch_id INT NULL,
          branch_name VARCHAR(100) NULL,
          target_branches JSON NULL,
          academic_year VARCHAR(30) NOT NULL DEFAULT '2026-2027',
          semester INT NULL,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          published_by BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_pub_form (form_id),
          KEY idx_pub_active (is_active),
          KEY idx_pub_dates (start_date, end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      if (!(await columnExists("ap_feedback_publications", "target_colleges"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN target_colleges JSON NULL AFTER college_name`);
      }
      if (!(await columnExists("ap_feedback_publications", "course_id"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN course_id INT NULL AFTER target_colleges`);
      }
      if (!(await columnExists("ap_feedback_publications", "course_name"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN course_name VARCHAR(255) NULL AFTER course_id`);
      }
      if (!(await columnExists("ap_feedback_publications", "target_courses"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN target_courses JSON NULL AFTER course_name`);
      }
      if (!(await columnExists("ap_feedback_publications", "target_branches"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN target_branches JSON NULL AFTER branch_name`);
      }
      if (!(await columnExists("ap_feedback_publications", "target_audience"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN target_audience JSON NULL AFTER target_branches`);
      }
      if (!(await columnExists("ap_feedback_publications", "mapped_staff_subjects"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_publications ADD COLUMN mapped_staff_subjects JSON NULL AFTER target_audience`);
      }

      // 4. Responses table
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_feedback_responses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          publication_id INT NULL,
          form_id INT NOT NULL,
          college_id INT NULL,
          branch_name VARCHAR(100) NULL,
          academic_year VARCHAR(30) NULL,
          semester INT NULL,
          section_name VARCHAR(50) NULL,
          subject_name VARCHAR(150) NULL,
          faculty_name VARCHAR(150) NULL,
          student_token_hash VARCHAR(64) NULL,
          units_covered VARCHAR(50) NULL,
          faculty_rating INT NULL,
          unit_status VARCHAR(50) NULL,
          answers_json JSON NOT NULL,
          submitted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_fb_resp_pub (publication_id),
          KEY idx_fb_resp_form (form_id),
          KEY idx_fb_resp_branch (branch_name),
          KEY idx_fb_resp_time (submitted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      if (!(await columnExists("ap_feedback_responses", "publication_id"))) {
        await executeAcademic(`ALTER TABLE ap_feedback_responses ADD COLUMN publication_id INT NULL AFTER id, ADD KEY idx_fb_resp_pub (publication_id)`);
      }

      // Seed initial form template if none exist
      const existing = await queryAcademic<(RowDataPacket & { c: number })[]>(
        `SELECT COUNT(*) as c FROM ap_feedback_forms`,
      );
      let formId = 1;
      if (Number(existing[0]?.c ?? 0) === 0) {
        await withAcademicTransaction(async (conn) => {
          const [formRes] = await conn.query<ResultSetHeader>(
            `INSERT INTO ap_feedback_forms (name, description) VALUES (?, ?)`,
            [
              "Acedemic Feedback Form",
              "Please submit your genuine feedback. Your response will remain anonymous. We are collecting your details only for validation purposes — no one will have access to your individual responses, and all information provided will be kept completely anonymous",
            ],
          );
          formId = formRes.insertId;

          const questions = [
            {
              question_text: "Units Covered",
              question_type: "multiple_choice",
              is_required: 1,
              order_index: 1,
              min_value: null,
              max_value: null,
              options: ["1", "2", "3", "4", "5"],
            },
            {
              question_text: "Rate Subject Faculty",
              question_type: "rating_scale",
              is_required: 1,
              order_index: 2,
              min_value: 1,
              max_value: 5,
              options: [],
            },
            {
              question_text: "Unit Status",
              question_type: "multiple_choice",
              is_required: 1,
              order_index: 3,
              min_value: null,
              max_value: null,
              options: ["Starting", "Middle", "Ending", "Completed"],
            },
          ];

          for (const q of questions) {
            await conn.query(
              `INSERT INTO ap_feedback_questions (form_id, question_text, question_type, is_required, order_index, min_value, max_value, options_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                formId,
                q.question_text,
                q.question_type,
                q.is_required,
                q.order_index,
                q.min_value,
                q.max_value,
                q.options.length > 0 ? JSON.stringify(q.options) : null,
              ],
            );
          }
        });
      } else {
        const first = await queryAcademic<RowDataPacket[]>(`SELECT id FROM ap_feedback_forms ORDER BY id ASC LIMIT 1`);
        if (first[0]) formId = Number(first[0].id);
      }

      // Check if publication exists; if not, create one using real DB colleges and branches
      const pubCount = await queryAcademic<(RowDataPacket & { c: number })[]>(
        `SELECT COUNT(*) as c FROM ap_feedback_publications`,
      );
      let pubId = 1;
      if (Number(pubCount[0]?.c ?? 0) === 0) {
        // Query real college & real branch from database
        const [colleges, branches] = await Promise.all([
          queryStudent<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM colleges LIMIT 1`),
          queryStudent<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM course_branches WHERE name = 'CSE' OR name LIKE '%CSE%' LIMIT 1`),
        ]);

        const college = colleges[0] || { id: 1, name: "Pydah College of Engineering" };
        const branch = branches[0] || { id: 39, name: "CSE" };

        const pubRes = await executeAcademic(
          `
          INSERT INTO ap_feedback_publications (
            form_id, title, college_id, college_name, branch_id, branch_name, academic_year, semester,
            start_date, end_date, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            formId,
            "Academic Feedback - Spring 2026",
            college.id,
            college.name,
            branch.id,
            branch.name,
            "2025-2026",
            4,
            "2026-02-08 16:22:00",
            "2026-04-07 16:22:00",
            1,
          ],
        );
        pubId = pubRes.insertId;
      } else {
        const firstPub = await queryAcademic<RowDataPacket[]>(`SELECT id FROM ap_feedback_publications ORDER BY id ASC LIMIT 1`);
        if (firstPub[0]) pubId = Number(firstPub[0].id);
      }

    })();
  }
  await tableReady;
}

// =========================================================================
// Form Templates (Settings)
// =========================================================================

export async function listFeedbackForms(): Promise<FeedbackForm[]> {
  await ensureFeedbackFormsTable();
  const rows = await queryAcademic<FormRow[]>(`
    SELECT f.id, f.name, f.description, f.created_at, f.updated_at,
           COUNT(q.id) AS question_count
    FROM ap_feedback_forms f
    LEFT JOIN ap_feedback_questions q ON q.form_id = f.id
    GROUP BY f.id
    ORDER BY f.id DESC
  `);

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    description: r.description,
    questionCount: Number(r.question_count || 0),
    createdAt: toIsoString(r.created_at),
    updatedAt: toIsoString(r.updated_at),
  }));
}

export async function getFeedbackForm(id: number): Promise<FeedbackForm | null> {
  await ensureFeedbackFormsTable();
  const forms = await queryAcademic<FormRow[]>(
    `SELECT * FROM ap_feedback_forms WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = forms[0];
  if (!row) return null;

  const questions = await queryAcademic<QuestionRow[]>(
    `SELECT * FROM ap_feedback_questions WHERE form_id = ? ORDER BY order_index ASC, id ASC`,
    [id],
  );

  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    questionCount: questions.length,
    questions: questions.map((q) => ({
      id: Number(q.id),
      formId: Number(q.form_id),
      questionText: q.question_text,
      questionType: q.question_type as FeedbackQuestion["questionType"],
      isRequired: Number(q.is_required) === 1,
      orderIndex: Number(q.order_index),
      minValue: q.min_value != null ? Number(q.min_value) : null,
      maxValue: q.max_value != null ? Number(q.max_value) : null,
      options: parseOptions(q.options_json),
    })),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export type SaveFeedbackFormInput = {
  name: string;
  description?: string | null;
  questions?: Array<{
    id?: number;
    questionText: string;
    questionType: string;
    isRequired?: boolean;
    orderIndex?: number;
    minValue?: number | null;
    maxValue?: number | null;
    options?: string[];
  }>;
};

export async function createFeedbackForm(input: SaveFeedbackFormInput): Promise<FeedbackForm> {
  await ensureFeedbackFormsTable();

  const name = (input.name || "").trim();
  if (!name) {
    throw Object.assign(new Error("Form Name is required"), { status: 400 });
  }
  const description = input.description ? input.description.trim() : null;

  let createdId = 0;
  await withAcademicTransaction(async (conn) => {
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO ap_feedback_forms (name, description) VALUES (?, ?)`,
      [name, description],
    );
    createdId = res.insertId;

    const questions = input.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qText = (q.questionText || "").trim();
      if (!qText) continue;
      const validOptions = (q.options || []).map((o) => String(o).trim()).filter(Boolean);

      await conn.query(
        `INSERT INTO ap_feedback_questions (form_id, question_text, question_type, is_required, order_index, min_value, max_value, options_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createdId,
          qText,
          q.questionType || "short_text",
          q.isRequired !== false ? 1 : 0,
          q.orderIndex ?? i + 1,
          q.minValue != null ? Number(q.minValue) : null,
          q.maxValue != null ? Number(q.maxValue) : null,
          validOptions.length > 0 ? JSON.stringify(validOptions) : null,
        ],
      );
    }
  });

  const full = await getFeedbackForm(createdId);
  if (!full) throw new Error("Failed to retrieve newly created feedback form");
  return full;
}

export async function updateFeedbackForm(id: number, input: SaveFeedbackFormInput): Promise<FeedbackForm> {
  await ensureFeedbackFormsTable();

  const name = (input.name || "").trim();
  if (!name) {
    throw Object.assign(new Error("Form Name is required"), { status: 400 });
  }
  const description = input.description ? input.description.trim() : null;

  await withAcademicTransaction(async (conn) => {
    await conn.query(
      `UPDATE ap_feedback_forms SET name = ?, description = ? WHERE id = ?`,
      [name, description, id],
    );

    await conn.query(`DELETE FROM ap_feedback_questions WHERE form_id = ?`, [id]);

    const questions = input.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qText = (q.questionText || "").trim();
      if (!qText) continue;
      const validOptions = (q.options || []).map((o) => String(o).trim()).filter(Boolean);

      await conn.query(
        `INSERT INTO ap_feedback_questions (form_id, question_text, question_type, is_required, order_index, min_value, max_value, options_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          qText,
          q.questionType || "short_text",
          q.isRequired !== false ? 1 : 0,
          q.orderIndex ?? i + 1,
          q.minValue != null ? Number(q.minValue) : null,
          q.maxValue != null ? Number(q.maxValue) : null,
          validOptions.length > 0 ? JSON.stringify(validOptions) : null,
        ],
      );
    }
  });

  const full = await getFeedbackForm(id);
  if (!full) throw new Error("Failed to retrieve updated feedback form");
  return full;
}

export async function deleteFeedbackForm(id: number): Promise<void> {
  await ensureFeedbackFormsTable();
  await withAcademicTransaction(async (conn) => {
    await conn.query(`DELETE FROM ap_feedback_questions WHERE form_id = ?`, [id]);
    await conn.query(`DELETE FROM ap_feedback_responses WHERE form_id = ?`, [id]);
    await conn.query(`DELETE FROM ap_feedback_publications WHERE form_id = ?`, [id]);
    await conn.query(`DELETE FROM ap_feedback_forms WHERE id = ?`, [id]);
  });
}

// =========================================================================
// Publications & Publishing from Reports
// =========================================================================

export async function listFeedbackPublications(): Promise<FeedbackPublication[]> {
  await ensureFeedbackFormsTable();
  const rows = await queryAcademic<PublicationRow[]>(`
    SELECT p.*, f.name AS form_name, COUNT(r.id) AS response_count
    FROM ap_feedback_publications p
    JOIN ap_feedback_forms f ON f.id = p.form_id
    LEFT JOIN ap_feedback_responses r ON r.publication_id = p.id
    GROUP BY p.id
    ORDER BY p.id DESC
  `);

  const now = getCurrentIndianDateTime();

  return rows.map((r) => {
    const start = normalizeSqlDate(r.start_date);
    const end = normalizeSqlDate(r.end_date);
    let status: FeedbackPublication["status"] = "closed";
    if (Number(r.is_active) === 1) {
      if (now < start) status = "scheduled";
      else if (now <= end) status = "active";
      else status = "closed";
    }

    let targetColleges = null;
    if (r.target_colleges) {
      try {
        targetColleges = typeof r.target_colleges === "string" ? JSON.parse(r.target_colleges) : r.target_colleges;
      } catch {}
    }
    let targetCourses = null;
    if (r.target_courses) {
      try {
        targetCourses = typeof r.target_courses === "string" ? JSON.parse(r.target_courses) : r.target_courses;
      } catch {}
    }
    let targetBranches = null;
    if (r.target_branches) {
      try {
        targetBranches = typeof r.target_branches === "string" ? JSON.parse(r.target_branches) : r.target_branches;
      } catch {}
    }
    let targetAudience = null;
    if (r.target_audience) {
      try {
        targetAudience = typeof r.target_audience === "string" ? JSON.parse(r.target_audience) : r.target_audience;
      } catch {}
    }
    let mappedStaffSubjects = null;
    if (r.mapped_staff_subjects) {
      try {
        mappedStaffSubjects = typeof r.mapped_staff_subjects === "string" ? JSON.parse(r.mapped_staff_subjects) : r.mapped_staff_subjects;
      } catch {}
    }

    return {
      id: Number(r.id),
      formId: Number(r.form_id),
      formName: r.form_name || "Feedback Form",
      title: r.title,
      collegeId: r.college_id ? Number(r.college_id) : null,
      collegeName: r.college_name,
      targetColleges,
      courseId: r.course_id ? Number(r.course_id) : null,
      courseName: r.course_name || null,
      targetCourses,
      branchId: r.branch_id ? Number(r.branch_id) : null,
      branchName: r.branch_name,
      targetBranches,
      targetAudience,
      mappedStaffSubjects,
      academicYear: r.academic_year,
      semester: r.semester ? Number(r.semester) : null,
      startDate: toPublicationDateTime(r.start_date),
      endDate: toPublicationDateTime(r.end_date),
      isActive: Number(r.is_active) === 1,
      status,
      responseCount: Number(r.response_count || 0),
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    };
  });
}

export type PublishFeedbackInput = {
  formId: number;
  title: string;
  collegeId?: number | null;
  collegeName?: string | null;
  targetColleges?: Array<{ id: number; name: string; code?: string | null }> | null;
  courseId?: number | null;
  courseName?: string | null;
  targetCourses?: Array<{ id: number; name: string; code?: string | null; collegeId?: number }> | null;
  branchId?: number | null;
  branchName?: string | null;
  targetBranches?: Array<{ id: number; name: string; code?: string | null; courseId?: number }> | null;
  targetAudience?: TargetAudienceScope | null;
  mappedStaffSubjects?: MappedStaffSubject[] | null;
  academicYear?: string;
  semester?: number | null;
  startDate: string;
  endDate: string;
  isActive?: boolean;
};

export async function createFeedbackPublication(
  input: PublishFeedbackInput,
  publishedByUserId?: number,
): Promise<FeedbackPublication> {
  await ensureFeedbackFormsTable();

  const formId = Number(input.formId);
  if (!formId || formId <= 0) {
    throw Object.assign(new Error("Valid Form Template is required"), { status: 400 });
  }

  const title = (input.title || "").trim();
  if (!title) {
    throw Object.assign(new Error("Publication Title is required"), { status: 400 });
  }

  if (!input.startDate || !input.endDate) {
    throw Object.assign(new Error("Start Date and End Date are required"), { status: 400 });
  }

  const startDateSql = normalizeSqlDate(input.startDate);
  const endDateSql = normalizeSqlDate(input.endDate);
  const isActive = input.isActive !== false ? 1 : 0;

  // Resolve College Info
  let resolvedCollegeId: number | null = input.collegeId ?? null;
  let resolvedCollegeName: string | null = input.collegeName ?? null;
  let targetCollegesJson: string | null = null;
  if (input.targetColleges && input.targetColleges.length > 0) {
    targetCollegesJson = JSON.stringify(input.targetColleges);
    if (input.targetColleges.length === 1) {
      resolvedCollegeId = input.targetColleges[0].id;
      resolvedCollegeName = input.targetColleges[0].name;
    } else {
      resolvedCollegeId = null;
      resolvedCollegeName = input.targetColleges.map((c) => c.code || c.name).join(", ");
    }
  } else if (!resolvedCollegeName) {
    resolvedCollegeName = "All Colleges";
  }

  // Resolve Course Info
  let resolvedCourseId: number | null = input.courseId ?? null;
  let resolvedCourseName: string | null = input.courseName ?? null;
  let targetCoursesJson: string | null = null;
  if (input.targetCourses && input.targetCourses.length > 0) {
    targetCoursesJson = JSON.stringify(input.targetCourses);
    if (input.targetCourses.length === 1) {
      resolvedCourseId = input.targetCourses[0].id;
      resolvedCourseName = input.targetCourses[0].name;
    } else {
      resolvedCourseId = null;
      resolvedCourseName = input.targetCourses.map((c) => c.code || c.name).join(", ");
    }
  } else if (!resolvedCourseName) {
    resolvedCourseName = "All Courses";
  }

  // Resolve Branch Info
  let resolvedBranchId: number | null = input.branchId ?? null;
  let resolvedBranchName: string | null = input.branchName ?? null;
  let targetBranchesJson: string | null = null;
  if (input.targetBranches && input.targetBranches.length > 0) {
    targetBranchesJson = JSON.stringify(input.targetBranches);
    if (input.targetBranches.length === 1) {
      resolvedBranchId = input.targetBranches[0].id;
      resolvedBranchName = input.targetBranches[0].name;
    } else {
      resolvedBranchId = null;
      resolvedBranchName = input.targetBranches.map((b) => b.code || b.name).join(", ");
    }
  } else if (!resolvedBranchName) {
    resolvedBranchName = "All Branches";
  }

  const academicYear = input.academicYear?.trim() || "2026-2027";
  const targetAudienceJson = input.targetAudience ? JSON.stringify(input.targetAudience) : null;
  const mappedStaffSubjectsJson = input.mappedStaffSubjects ? JSON.stringify(input.mappedStaffSubjects) : null;

  const res = await executeAcademic(
    `
    INSERT INTO ap_feedback_publications (
      form_id, title,
      college_id, college_name, target_colleges,
      course_id, course_name, target_courses,
      branch_id, branch_name, target_branches,
      target_audience, mapped_staff_subjects,
      academic_year, semester,
      start_date, end_date, is_active, published_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      formId,
      title,
      resolvedCollegeId,
      resolvedCollegeName,
      targetCollegesJson,
      resolvedCourseId,
      resolvedCourseName,
      targetCoursesJson,
      resolvedBranchId,
      resolvedBranchName,
      targetBranchesJson,
      targetAudienceJson,
      mappedStaffSubjectsJson,
      academicYear,
      input.semester ?? null,
      startDateSql,
      endDateSql,
      isActive,
      publishedByUserId ?? null,
    ],
  );

  const pubs = await listFeedbackPublications();
  const created = pubs.find((p) => p.id === res.insertId);
  if (!created) throw new Error("Failed to retrieve published feedback form");
  return created;
}

export async function updateFeedbackPublication(
  id: number,
  input: Partial<PublishFeedbackInput>,
): Promise<FeedbackPublication> {
  await ensureFeedbackFormsTable();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    params.push(input.title.trim());
  }
  if (input.startDate !== undefined) {
    fields.push("start_date = ?");
    params.push(normalizeSqlDate(input.startDate));
  }
  if (input.endDate !== undefined) {
    fields.push("end_date = ?");
    params.push(normalizeSqlDate(input.endDate));
  }
  if (input.isActive !== undefined) {
    fields.push("is_active = ?");
    params.push(input.isActive ? 1 : 0);
  }
  if (input.academicYear !== undefined) {
    fields.push("academic_year = ?");
    params.push(input.academicYear.trim());
  }
  if (input.targetColleges !== undefined) {
    fields.push("target_colleges = ?");
    params.push(input.targetColleges ? JSON.stringify(input.targetColleges) : null);
    if (input.targetColleges && input.targetColleges.length > 0) {
      fields.push("college_name = ?");
      params.push(input.targetColleges.length === 1 ? input.targetColleges[0].name : input.targetColleges.map((c) => c.code || c.name).join(", "));
    }
  }
  if (input.targetCourses !== undefined) {
    fields.push("target_courses = ?");
    params.push(input.targetCourses ? JSON.stringify(input.targetCourses) : null);
    if (input.targetCourses && input.targetCourses.length > 0) {
      fields.push("course_name = ?");
      params.push(input.targetCourses.length === 1 ? input.targetCourses[0].name : input.targetCourses.map((c) => c.code || c.name).join(", "));
    }
  }
  if (input.targetBranches !== undefined) {
    fields.push("target_branches = ?");
    params.push(input.targetBranches ? JSON.stringify(input.targetBranches) : null);
    if (input.targetBranches && input.targetBranches.length > 0) {
      fields.push("branch_name = ?");
      params.push(input.targetBranches.length === 1 ? input.targetBranches[0].name : input.targetBranches.map((b) => b.code || b.name).join(", "));
    }
  }
  if (input.targetAudience !== undefined) {
    fields.push("target_audience = ?");
    params.push(input.targetAudience ? JSON.stringify(input.targetAudience) : null);
  }
  if (input.mappedStaffSubjects !== undefined) {
    fields.push("mapped_staff_subjects = ?");
    params.push(input.mappedStaffSubjects ? JSON.stringify(input.mappedStaffSubjects) : null);
  }
  if (input.branchName !== undefined && input.targetBranches === undefined) {
    fields.push("branch_name = ?");
    params.push(input.branchName);
  }
  if (input.semester !== undefined) {
    fields.push("semester = ?");
    params.push(input.semester);
  }

  if (fields.length > 0) {
    params.push(id);
    await executeAcademic(`UPDATE ap_feedback_publications SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  const pubs = await listFeedbackPublications();
  const updated = pubs.find((p) => p.id === id);
  if (!updated) throw new Error("Publication not found");
  return updated;
}

export async function deleteFeedbackPublication(id: number): Promise<void> {
  await ensureFeedbackFormsTable();
  await withAcademicTransaction(async (conn) => {
    await conn.query(`DELETE FROM ap_feedback_responses WHERE publication_id = ?`, [id]);
    await conn.query(`DELETE FROM ap_feedback_publications WHERE id = ?`, [id]);
  });
}

export async function getStaffSubjectsForScope(filter: {
  collegeId?: number | null;
  collegeIds?: number[];
  courseId?: number | null;
  courseIds?: number[];
  branchId?: number | null;
  branchIds?: number[];
  semester?: number | null;
  academicYear?: string | null;
  batch?: string | null;
  batches?: string[];
  section?: string | null;
  sections?: string[];
}): Promise<MappedStaffSubject[]> {
  await ensureFeedbackFormsTable();

  const conds: string[] = [
    "te.subject_name IS NOT NULL",
    "TRIM(te.subject_name) != ''",
    "te.subject_name != 'null'",
    "sl.display_name IS NOT NULL",
    "TRIM(sl.display_name) != ''",
    "sl.display_name != 'null'",
    "(tp.status IN ('published', 'active', 'draft', 'in_review') OR tp.status IS NULL)",
  ];
  const params: unknown[] = [];

  if (filter.academicYear && filter.academicYear.trim() !== "" && filter.academicYear !== "all") {
    conds.push("tp.academic_year_label = ?");
    params.push(filter.academicYear.trim());
  }

  if (filter.collegeId) {
    conds.push("tp.college_id = ?");
    params.push(filter.collegeId);
  } else if (filter.collegeIds && filter.collegeIds.length > 0) {
    conds.push(`tp.college_id IN (${filter.collegeIds.map(() => "?").join(",")})`);
    params.push(...filter.collegeIds);
  }

  if (filter.courseId) {
    conds.push("tp.course_id = ?");
    params.push(filter.courseId);
  } else if (filter.courseIds && filter.courseIds.length > 0) {
    conds.push(`tp.course_id IN (${filter.courseIds.map(() => "?").join(",")})`);
    params.push(...filter.courseIds);
  }

  if (filter.branchId) {
    conds.push("tp.branch_id = ?");
    params.push(filter.branchId);
  } else if (filter.branchIds && filter.branchIds.length > 0) {
    conds.push(`tp.branch_id IN (${filter.branchIds.map(() => "?").join(",")})`);
    params.push(...filter.branchIds);
  }

  if (filter.semester != null && !isNaN(filter.semester) && filter.semester > 0) {
    conds.push("tp.semester_number = ?");
    params.push(filter.semester);
  }

  if (filter.batch && filter.batch !== "all") {
    conds.push("tp.batch = ?");
    params.push(filter.batch);
  } else if (filter.batches && filter.batches.length > 0) {
    conds.push(`tp.batch IN (${filter.batches.map(() => "?").join(",")})`);
    params.push(...filter.batches);
  }

  if (filter.section && filter.section !== "all") {
    conds.push("tp.section_name = ?");
    params.push(filter.section);
  } else if (filter.sections && filter.sections.length > 0) {
    conds.push(`tp.section_name IN (${filter.sections.map(() => "?").join(",")})`);
    params.push(...filter.sections);
  }

  const [colleges, courses, branches, rows] = await Promise.all([
    queryStudent<(RowDataPacket & { id: number; name: string; code: string })[]>(
      `SELECT id, name, code FROM colleges WHERE is_active = 1 OR is_active IS NULL`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { id: number; name: string; code: string; college_id: number })[]>(
      `SELECT id, name, code, college_id FROM courses WHERE is_active = 1 OR is_active IS NULL`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { id: number; name: string; code: string; course_id: number })[]>(
      `SELECT id, name, code, course_id FROM course_branches WHERE is_active = 1 OR is_active IS NULL`,
    ).catch(() => []),
    queryAcademic<
      (RowDataPacket & {
        subjectId: number | null;
        subjectCode: string | null;
        subjectName: string;
        staffLinkId: number | null;
        facultyName: string;
        employeeCode: string | null;
        collegeId: number | null;
        courseId: number | null;
        branchId: number | null;
        academicYear: string | null;
        semester: number | null;
        sectionName: string | null;
        batch: string | null;
      })[]
    >(
      `
      SELECT
        te.subject_id AS subjectId,
        COALESCE(te.subject_code, '') AS subjectCode,
        te.subject_name AS subjectName,
        sl.id AS staffLinkId,
        COALESCE(sl.display_name, 'Faculty') AS facultyName,
        sl.employee_code AS employeeCode,
        tp.college_id AS collegeId,
        tp.course_id AS courseId,
        tp.branch_id AS branchId,
        tp.academic_year_label AS academicYear,
        CASE
          WHEN tp.year_of_study IS NOT NULL AND tp.year_of_study > 0
            THEN (tp.year_of_study - 1) * 2 + COALESCE(tp.semester_number, 1)
          ELSE COALESCE(tp.semester_number, 1)
        END AS semester,
        tp.year_of_study AS yearOfStudy,
        tp.section_name AS sectionName,
        tp.batch AS batch
      FROM ap_timetable_entries te
      INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
      LEFT JOIN ap_staff_link sl ON sl.id = te.faculty_staff_link_id
      WHERE ${conds.join(" AND ")}
      GROUP BY te.subject_id, te.subject_code, te.subject_name, sl.id, sl.display_name, sl.employee_code,
               tp.college_id, tp.course_id, tp.branch_id, tp.year_of_study, tp.semester_number, tp.section_name, tp.batch, tp.academic_year_label
      ORDER BY tp.course_id, tp.branch_id, tp.year_of_study, tp.section_name, sl.display_name ASC, te.subject_name ASC
      LIMIT 5000
      `,
      params,
    ),
  ]);

  const branchMap = new Map(branches.map((b) => [Number(b.id), b]));
  const courseMap = new Map(courses.map((c) => [Number(c.id), c]));
  const collegeMap = new Map(colleges.map((c) => [Number(c.id), c]));

  const mapped: MappedStaffSubject[] = rows.map((r) => {
    const bInfo = r.branchId ? branchMap.get(Number(r.branchId)) : undefined;
    const cInfo = r.courseId ? courseMap.get(Number(r.courseId)) : undefined;
    const colInfo = r.collegeId ? collegeMap.get(Number(r.collegeId)) : undefined;

    return {
      staffLinkId: r.staffLinkId ? Number(r.staffLinkId) : null,
      facultyName: r.facultyName || "Faculty Member",
      employeeCode: r.employeeCode || null,
      subjectId: r.subjectId ? Number(r.subjectId) : null,
      subjectCode: r.subjectCode || "",
      subjectName: r.subjectName,
      sectionName: r.sectionName || null,
      semester: r.semester ? Number(r.semester) : null,
      yearOfStudy: (r as any).yearOfStudy ? Number((r as any).yearOfStudy) : null,
      branchId: r.branchId ? Number(r.branchId) : null,
      branchName: bInfo?.name || null,
      branchCode: bInfo?.code || null,
      courseId: r.courseId ? Number(r.courseId) : null,
      courseName: cInfo?.name || null,
      courseCode: cInfo?.code || null,
      collegeId: r.collegeId ? Number(r.collegeId) : null,
      collegeName: colInfo?.name || null,
      collegeCode: colInfo?.code || null,
      academicYear: r.academicYear || null,
      batch: r.batch || null,
    };
  });

  return mapped;
}

/**
 * Loads student headcount per section from student_database.
 * Returns a lookup helper: getStudentCount(branchId, batch, sectionName)
 * Returns null if headcount data is unavailable (so we don't accidentally hide valid sections),
 * or the student count (0 if section has no students).
 */
async function loadSectionHeadcountHelper(): Promise<
  (branchId: number | null | undefined, batch: string | null | undefined, sectionName: string | null | undefined) => number | null
> {
  type HeadcountRow = RowDataPacket & {
    branch_id: number | null;
    batch: string | null;
    section_name: string;
    student_count: number;
  };

  const countByBranchBatchSec = new Map<string, number>();
  const countByBatchSec = new Map<string, number>();
  const countBySec = new Map<string, number>();

  try {
    const headcounts = await queryStudent<HeadcountRow[]>(`
      SELECT
        COALESCE(ss.branch_id, s.branch_id) AS branch_id,
        COALESCE(NULLIF(TRIM(ss.batch), ''), NULLIF(TRIM(s.batch), '')) AS batch,
        UPPER(TRIM(COALESCE(NULLIF(TRIM(ss.section_name), ''), NULLIF(TRIM(s.section), '')))) AS section_name,
        COUNT(DISTINCT s.id) AS student_count
      FROM students s
      LEFT JOIN student_sections ss ON ss.student_id = s.id
      WHERE (ss.section_name IS NOT NULL AND ss.section_name != '')
         OR (s.section IS NOT NULL AND s.section != '')
      GROUP BY
        COALESCE(ss.branch_id, s.branch_id),
        COALESCE(NULLIF(TRIM(ss.batch), ''), NULLIF(TRIM(s.batch), '')),
        UPPER(TRIM(COALESCE(NULLIF(TRIM(ss.section_name), ''), NULLIF(TRIM(s.section), ''))))
    `).catch(() => []);

    for (const h of headcounts) {
      const sec = (h.section_name || "").trim().toUpperCase();
      const count = Number(h.student_count) || 0;
      if (!sec) continue;

      if (h.branch_id && h.batch) {
        const k1 = `${h.branch_id}|${String(h.batch).trim()}|${sec}`;
        countByBranchBatchSec.set(k1, (countByBranchBatchSec.get(k1) ?? 0) + count);
      }
      if (h.batch) {
        const k2 = `${String(h.batch).trim()}|${sec}`;
        countByBatchSec.set(k2, (countByBatchSec.get(k2) ?? 0) + count);
      }
      countBySec.set(sec, (countBySec.get(sec) ?? 0) + count);
    }
  } catch {
    // If student DB cannot be queried, count maps remain empty
  }

  // If no headcount data exists at all, return helper that returns null (unknown)
  if (countBySec.size === 0) {
    return () => null;
  }

  return (branchId, batch, sectionName) => {
    if (!sectionName) return null; // unknown / all sections
    const sec = sectionName.trim().toUpperCase();
    if (branchId && batch) {
      const k1 = `${branchId}|${String(batch).trim()}|${sec}`;
      if (countByBranchBatchSec.has(k1)) return countByBranchBatchSec.get(k1)!;
    }
    if (batch) {
      const k2 = `${String(batch).trim()}|${sec}`;
      if (countByBatchSec.has(k2)) return countByBatchSec.get(k2)!;
    }
    if (countBySec.has(sec)) return countBySec.get(sec)!;
    return null;
  };
}

// =========================================================================
// Real Database Lookups & Report Generation
// =========================================================================


export function formatRomanYearSem(semesterNumber: number | null | undefined): string {
  if (!semesterNumber || semesterNumber < 1) return "I-I";
  const year = Math.ceil(semesterNumber / 2);
  const semInYear = semesterNumber % 2 === 1 ? 1 : 2;
  const romanYears = ["I", "II", "III", "IV", "V"];
  const romanSem = semInYear === 1 ? "I" : "II";
  return `${romanYears[year - 1] || year}-${romanSem}`;
}

export function shortenQuestionText(text: string): string {
  if (!text) return "Question";
  const trimmed = text.trim();
  if (trimmed.length <= 25) return trimmed;
  if (/smart\s*board/i.test(trimmed)) return "Smart Board";
  if (/rate\s*subject\s*faculty/i.test(trimmed)) return "Rate Faculty";
  if (/educational\s*applications.*useful/i.test(trimmed)) return "Digital Resources";
  if (/which.*feature.*frequently/i.test(trimmed)) return "Frequent Feature";
  if (/quality.*applications/i.test(trimmed)) return "Quality Rating";
  return trimmed.slice(0, 22) + "...";
}

function computeQuestionSummary(
  q: FeedbackQuestion,
  responsesForSubject: ResponseRow[],
): QuestionSummary {
  const qIdStr = String(q.id);
  const isRating =
    q.questionType === "rating_scale" ||
    (q.minValue != null && q.maxValue != null) ||
    q.questionText.toLowerCase().includes("rate");

  const extractedAnswers: string[] = [];
  const extractedRatings: number[] = [];

  for (const r of responsesForSubject) {
    let ansValue: unknown = undefined;

    if (r.answers_json) {
      try {
        const parsed =
          typeof r.answers_json === "string" ? JSON.parse(r.answers_json) : r.answers_json;
        if (parsed && typeof parsed === "object") {
          const rec = parsed as Record<string, unknown>;
          ansValue =
            rec[qIdStr] ??
            rec[Number(q.id)] ??
            rec[`q_${q.id}`] ??
            rec[`question_${q.id}`] ??
            rec[q.questionText] ??
            rec[q.questionText.toLowerCase().trim()];
        }
      } catch {}
    }

    if (ansValue === undefined || ansValue === null || ansValue === "") {
      if (isRating && r.faculty_rating != null && r.faculty_rating > 0) {
        ansValue = r.faculty_rating;
      } else if (
        q.questionText.toLowerCase().includes("unit") &&
        q.questionText.toLowerCase().includes("covered") &&
        r.units_covered
      ) {
        ansValue = r.units_covered;
      } else if (
        q.questionText.toLowerCase().includes("unit") &&
        q.questionText.toLowerCase().includes("status") &&
        r.unit_status
      ) {
        ansValue = r.unit_status;
      }
    }

    if (ansValue != null && String(ansValue).trim() !== "") {
      const str = String(ansValue).trim();
      extractedAnswers.push(str);
      const num = Number(ansValue);
      if (!isNaN(num) && num > 0) {
        extractedRatings.push(num);
      }
    }
  }

  const shortLabel = shortenQuestionText(q.questionText);

  if (extractedAnswers.length === 0) {
    return {
      questionId: q.id ?? 0,
      questionText: q.questionText,
      questionType: q.questionType,
      shortLabel,
      abstract: "—",
      avgScore: null,
      ratingTier: "none",
      distribution: {},
    };
  }

  if (isRating && extractedRatings.length > 0) {
    const avg =
      extractedRatings.reduce((sum, val) => sum + val, 0) / extractedRatings.length;
    const roundedAvg = Math.round(avg * 100) / 100;
    let tier: "excellent" | "good" | "average" | "poor" = "good";
    let label = "Good";
    if (roundedAvg >= 4.5) {
      tier = "excellent";
      label = "Very Good";
    } else if (roundedAvg >= 3.5) {
      tier = "good";
      label = "Good";
    } else if (roundedAvg >= 2.5) {
      tier = "average";
      label = "Average";
    } else {
      tier = "poor";
      label = "Below Average";
    }

    return {
      questionId: q.id ?? 0,
      questionText: q.questionText,
      questionType: q.questionType,
      shortLabel,
      abstract: `${label} (${roundedAvg.toFixed(2)})`,
      avgScore: roundedAvg,
      ratingTier: tier,
      distribution: {},
    };
  }

  const counts: Record<string, number> = {};
  for (const a of extractedAnswers) {
    counts[a] = (counts[a] || 0) + 1;
  }

  let mostFrequent = "";
  let maxCount = 0;
  for (const [opt, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = opt;
    }
  }

  return {
    questionId: q.id ?? 0,
    questionText: q.questionText,
    questionType: q.questionType,
    shortLabel,
    abstract: `${mostFrequent} (${maxCount})`,
    avgScore: null,
    ratingTier: "none",
    distribution: counts,
  };
}


function resolveActualSemester(item: MappedStaffSubject, pubAcademicYear?: string): number {
  if (item.semester && Number(item.semester) > 2) {
    return Number(item.semester);
  }
  if (item.batch) {
    const batchYear = parseInt(String(item.batch).trim(), 10);
    const acadYear = parseInt(String(pubAcademicYear || item.academicYear || "2026").slice(0, 4), 10) || 2026;
    if (batchYear > 2000 && batchYear <= acadYear) {
      const yearOfStudy = Math.min(4, Math.max(1, acadYear - batchYear + 1));
      const semInYear = Number(item.semester) === 2 ? 2 : 1;
      return (yearOfStudy - 1) * 2 + semInYear;
    }
  }
  return Number(item.semester) || 1;
}

export async function getFeedbackReportData(
  publicationId?: number | null,
  courseFilter?: string | null,
  branchFilter?: string | null,
  semesterFilter?: number | null,
  scope?: AcademicScope | null,
): Promise<FeedbackReportData> {
  await ensureFeedbackFormsTable();

  // 1. Query real colleges, courses, branches, and academic years from database
  const [colleges, courses, branches, studentYears, planYears, batchRows, sectionRows, formsList, publicationsList] = await Promise.all([
    queryStudent<(RowDataPacket & { id: number; name: string; code: string })[]>(
      `SELECT id, name, code FROM colleges WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { id: number; name: string; code: string; college_id: number })[]>(
      `SELECT id, name, code, college_id FROM courses WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { id: number; name: string; code: string; course_id: number })[]>(
      `SELECT id, name, code, course_id FROM course_branches WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { id: number; year_label: string; is_active: number })[]>(
      `SELECT id, year_label, is_active FROM academic_years ORDER BY year_label DESC`,
    ).catch(() => []),
    queryAcademic<(RowDataPacket & { academic_year_label: string })[]>(
      `SELECT DISTINCT academic_year_label FROM ap_timetable_plans ORDER BY academic_year_label DESC`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { batch: string })[]>(
      `SELECT DISTINCT batch FROM student_sections WHERE batch IS NOT NULL AND batch != '' ORDER BY batch DESC`,
    ).catch(() => []),
    queryStudent<(RowDataPacket & { section_name: string })[]>(
      `SELECT DISTINCT section_name FROM student_sections WHERE section_name IS NOT NULL AND section_name != '' ORDER BY section_name ASC`,
    ).catch(() => []),
    listFeedbackForms(),
    listFeedbackPublications(),
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const calcStartYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  const currentAcademicYear = `${calcStartYear}-${calcStartYear + 1}`;

  const yearSet = new Set<string>();
  const activeYearSet = new Set<string>();

  studentYears.forEach((y) => {
    const lbl = String(y.year_label || "").trim();
    if (/^\d{4}-\d{4}$/.test(lbl)) {
      yearSet.add(lbl);
      if (Number(y.is_active) === 1) activeYearSet.add(lbl);
    }
  });

  planYears.forEach((p) => {
    const lbl = String(p.academic_year_label || "").trim();
    if (/^\d{4}-\d{4}$/.test(lbl)) {
      yearSet.add(lbl);
    }
  });

  yearSet.add(currentAcademicYear);

  const sortedYears = Array.from(yearSet)
    .filter((y) => {
      const start = parseInt(y.split("-")[0], 10);
      return start >= 2020 && start <= currentYear + 2;
    })
    .sort((a, b) => {
      const aStart = parseInt(a.split("-")[0], 10);
      const bStart = parseInt(b.split("-")[0], 10);
      return bStart - aStart;
    });

  const availableAcademicYears = sortedYears.map((lbl) => ({
    label: lbl,
    isActive: lbl === currentAcademicYear || activeYearSet.has(lbl),
  }));

  // Scope filtering for RBAC users
  const isGlobal = scope ? scope.isGlobal : true;
  const allowedCollegeIds = !isGlobal && scope?.collegeIds && scope.collegeIds.length > 0 ? new Set(scope.collegeIds) : null;
  const allowedBranchIds = !isGlobal && scope?.branchIds && scope.branchIds.length > 0 ? new Set(scope.branchIds) : null;

  const courseCollegeMap = new Map(courses.map((c) => [Number(c.id), Number(c.college_id)]));

  const filteredColleges = colleges.filter((c) => {
    if (allowedCollegeIds && !allowedCollegeIds.has(Number(c.id))) return false;
    return true;
  });

  const filteredBranches = branches.filter((b) => {
    const cId = courseCollegeMap.get(Number(b.course_id));
    if (allowedCollegeIds && (cId == null || !allowedCollegeIds.has(cId))) {
      return false;
    }
    if (allowedBranchIds && !allowedBranchIds.has(Number(b.id))) {
      return false;
    }
    return true;
  });

  const allowedBranchCourseIds = new Set(filteredBranches.map((b) => Number(b.course_id)));
  const filteredCourses = courses.filter((c) => {
    if (allowedCollegeIds && !allowedCollegeIds.has(Number(c.college_id))) return false;
    if (allowedBranchIds && !allowedBranchCourseIds.has(Number(c.id))) return false;
    return true;
  });

  const availableCourses = filteredCourses.map((cr) => ({
    id: Number(cr.id),
    name: cr.name,
    code: cr.code || "",
    collegeId: Number(cr.college_id),
  }));

  const availableBranches = filteredBranches.map((b) => ({
    id: Number(b.id),
    name: b.name,
    code: b.code || "",
    courseId: Number(b.course_id),
  }));

  const availableBatches = batchRows.length > 0
    ? batchRows.map((b) => String(b.batch)).filter(Boolean)
    : ["2026", "2025", "2024", "2023", "2022"];

  const availableSections = sectionRows.length > 0
    ? sectionRows.map((s) => String(s.section_name).trim().toUpperCase()).filter(Boolean)
    : ["A", "B", "C", "D"];

  const availableYearsOfStudy = [1, 2, 3, 4];

  const availableStaffSubjects = await getStaffSubjectsForScope({
    academicYear: currentAcademicYear,
  }).catch(() => []);

  // 2. Resolve target publication
  let targetPub = publicationsList.find((p) => p.id === publicationId) || null;
  if (!targetPub && publicationId) {
    targetPub = publicationsList.find((p) => p.formId === publicationId) || null;
  }
  if (!targetPub && publicationsList.length > 0) {
    targetPub = publicationsList.find((p) => p.status === "active") || publicationsList[0];
  }

  // 3. Query responses for this publication
  let sql = `SELECT * FROM ap_feedback_responses WHERE publication_id = ?`;
  const params: Array<string | number> = [targetPub ? targetPub.id : 0];

  if (branchFilter && branchFilter.trim() !== "" && branchFilter !== "all") {
    sql += ` AND branch_name = ?`;
    params.push(branchFilter.trim());
  }
  if (semesterFilter != null && !isNaN(semesterFilter) && semesterFilter > 0) {
    const semInYr = ((semesterFilter - 1) % 2) + 1;
    sql += ` AND (semester = ? OR semester = ?)`;
    params.push(semesterFilter, semInYr);
  }
  sql += ` ORDER BY submitted_at DESC`;

  // 3b. Build submission progress from mapped staff subjects
  // Always query ALL responses (unfiltered) for the publication so progress is accurate
  const allPubResponses = targetPub
    ? await queryAcademic<ResponseRow[]>(
        `SELECT * FROM ap_feedback_responses WHERE publication_id = ?`,
        [targetPub.id],
      ).catch(() => [])
    : [];

  // Count responses per faculty+subject+section
  const responseCountMap = new Map<string, number>();
  // Group full responses by faculty+subject for individual question analytics
  const responsesByFacultySubject = new Map<string, ResponseRow[]>();

  for (const r of allPubResponses) {
    const k = `${(r.faculty_name ?? "").trim()}|${(r.subject_name ?? "").trim()}|${(r.section_name ?? "all").trim()}`;
    responseCountMap.set(k, (responseCountMap.get(k) ?? 0) + 1);

    const fKey = `${(r.faculty_name ?? "").trim()}|${(r.subject_name ?? "").trim()}`;
    if (!responsesByFacultySubject.has(fKey)) responsesByFacultySubject.set(fKey, []);
    responsesByFacultySubject.get(fKey)!.push(r);
  }

  // Real student headcount helper per section from student_database
  const getStudentCount = await loadSectionHeadcountHelper();

  // Fetch full live published timetable allocations to guarantee no capping or missing subjects
  const liveAllocations = await getStaffSubjectsForScope({
    academicYear: targetPub?.academicYear || currentAcademicYear,
    collegeId: targetPub?.collegeId,
  });

  const mergedMap = new Map<string, MappedStaffSubject>();
  for (const item of liveAllocations) {
    const k = `${item.branchId || ""}|${item.semester || ""}|${(item.sectionName || "").trim().toUpperCase()}|${(item.subjectCode || item.subjectName || "").trim().toUpperCase()}|${(item.facultyName || "").trim().toUpperCase()}`;
    mergedMap.set(k, item);
  }
  if (targetPub?.mappedStaffSubjects) {
    for (const item of targetPub.mappedStaffSubjects) {
      const k = `${item.branchId || ""}|${item.semester || ""}|${(item.sectionName || "").trim().toUpperCase()}|${(item.subjectCode || item.subjectName || "").trim().toUpperCase()}|${(item.facultyName || "").trim().toUpperCase()}`;
      if (!mergedMap.has(k)) {
        mergedMap.set(k, item);
      }
    }
  }
  const mappedSubjects = Array.from(mergedMap.values());
  if (targetPub) {
    targetPub.mappedStaffSubjects = mappedSubjects;
  }

  // Build submission progress grouped by faculty+subject (sections combined into one row)
  type GroupedEntry = FeedbackReportData["submissionProgress"][number];
  const groupMap = new Map<string, GroupedEntry>();

  if (mappedSubjects && mappedSubjects.length > 0) {
    const seenSection = new Set<string>(); // dedup individual section entries

    for (const item of mappedSubjects) {
      // Check expected students enrolled in this section for this branch/batch
      const expectedCount = getStudentCount(item.branchId, item.batch, item.sectionName);

      // CRITICAL: We only show sections if there are students in it.
      // If headcount is known and 0, do NOT show or validate this section!
      if (expectedCount !== null && expectedCount === 0) {
        continue;
      }

      const sectionDedupKey = `${item.facultyName}|${item.subjectName}|${item.sectionName ?? "all"}|${item.semester ?? "all"}|${item.batch ?? "all"}`;
      if (seenSection.has(sectionDedupKey)) continue;
      seenSection.add(sectionDedupKey);

      const responseKey = `${item.facultyName.trim()}|${item.subjectName.trim()}|${(item.sectionName ?? "all").trim()}`;
      const submittedCount = responseCountMap.get(responseKey) ?? 0;

      const sectionStatus: "pending" | "partial" | "submitted" =
        submittedCount === 0
          ? "pending"
          : expectedCount != null && submittedCount >= expectedCount
          ? "submitted"
          : "partial";

      // Group key = faculty + subject (sections merged under same row)
      const groupKey = `${item.facultyName}|${item.subjectName}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          facultyName: item.facultyName,
          employeeCode: item.employeeCode ?? null,
          subjectName: item.subjectName,
          subjectCode: item.subjectCode ?? "",
          sections: [],
          totalSubmittedCount: 0,
          totalExpectedCount: 0,
          overallStatus: "pending",
          averageRating: null,
          averageUnitsCovered: null,
          completionRate: null,
          unitsCoveredDistribution: [],
          facultyRatingDistribution: [],
          unitStatusDistribution: [],
        });
      }
      const entry = groupMap.get(groupKey)!;
      entry.sections.push({
        sectionName: item.sectionName ?? null,
        semester: item.semester ?? null,
        batch: item.batch ?? null,
        branchName: item.branchName ?? null,
        submittedCount,
        expectedCount,
        status: sectionStatus,
      });
      entry.totalSubmittedCount += submittedCount;
      if (expectedCount != null) {
        entry.totalExpectedCount = (entry.totalExpectedCount ?? 0) + expectedCount;
      } else {
        entry.totalExpectedCount = null; // unknown — don't show expected
      }
    }
  }

  const statusColorMap: Record<string, string> = {
    Completed: "emerald",
    Ending: "blue",
    Middle: "amber",
    Starting: "slate",
  };

  // Derive overallStatus and individual question breakdown for each faculty group
  // Exclude any groups that have no valid sections with students
  const submissionProgress: FeedbackReportData["submissionProgress"] = Array.from(groupMap.values())
    .filter((entry) => entry.sections.length > 0)
    .map((entry) => {
      let overallStatus: "pending" | "partial" | "submitted";
      const allPending = entry.sections.every((s) => s.status === "pending");
      const allSubmitted = entry.sections.every((s) => s.status === "submitted");
      overallStatus = allPending ? "pending" : allSubmitted ? "submitted" : "partial";

      const staffResponses =
        responsesByFacultySubject.get(`${entry.facultyName.trim()}|${entry.subjectName.trim()}`) || [];
      const staffSubmissions = staffResponses.length;

      let rSum = 0;
      let rCount = 0;
      let uSum = 0;
      let uCount = 0;
      let compCount = 0;
      const uMap: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
      const rMap: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      const sMap: Record<string, number> = { Completed: 0, Ending: 0, Middle: 0, Starting: 0 };

      for (const r of staffResponses) {
        if (r.faculty_rating != null && r.faculty_rating > 0) {
          const star = Math.min(5, Math.max(1, Math.round(Number(r.faculty_rating))));
          rSum += star;
          rCount++;
          rMap[star] = (rMap[star] || 0) + 1;
        }
        if (r.units_covered) {
          const num = parseInt(String(r.units_covered).trim(), 10);
          if (!isNaN(num) && num >= 1 && num <= 5) {
            uSum += num;
            uCount++;
            uMap[String(num)] = (uMap[String(num)] || 0) + 1;
          }
        }
        if (r.unit_status) {
          const st = String(r.unit_status).trim();
          sMap[st] = (sMap[st] || 0) + 1;
          if (st === "Completed" || st === "Ending") compCount++;
        }
      }

      const averageRating = rCount > 0 ? Math.round((rSum / rCount) * 10) / 10 : null;
      const averageUnitsCovered = uCount > 0 ? Math.round((uSum / uCount) * 10) / 10 : null;
      const completionRate = staffSubmissions > 0 ? Math.round((compCount / staffSubmissions) * 100) : null;

      const unitsCoveredDistribution = ["1", "2", "3", "4", "5"].map((u) => ({
        unit: u,
        label: `Unit ${u}`,
        count: uMap[u] || 0,
        percentage: staffSubmissions > 0 ? Math.round(((uMap[u] || 0) / staffSubmissions) * 100) : 0,
      }));

      const facultyRatingDistribution = [5, 4, 3, 2, 1].map((s) => ({
        stars: s,
        count: rMap[s] || 0,
        percentage: rCount > 0 ? Math.round(((rMap[s] || 0) / rCount) * 100) : 0,
      }));

      const unitStatusDistribution = ["Completed", "Ending", "Middle", "Starting"].map((st) => ({
        status: st,
        count: sMap[st] || 0,
        percentage: staffSubmissions > 0 ? Math.round(((sMap[st] || 0) / staffSubmissions) * 100) : 0,
        color: statusColorMap[st] || "slate",
      }));

      return {
        ...entry,
        overallStatus,
        averageRating,
        averageUnitsCovered,
        completionRate,
        unitsCoveredDistribution,
        facultyRatingDistribution,
        unitStatusDistribution,
      };
    });

  // Sort: pending first, then partial, then submitted; then alphabetically by faculty name
  const statusOrder = { pending: 0, partial: 1, submitted: 2 };
  submissionProgress.sort(
    (a, b) => statusOrder[a.overallStatus] - statusOrder[b.overallStatus] || a.facultyName.localeCompare(b.facultyName),
  );

  const submissionSummary: FeedbackReportData["submissionSummary"] = {
    totalAllocations: submissionProgress.length,
    pendingAllocations: submissionProgress.filter((x) => x.overallStatus === "pending").length,
    partialAllocations: submissionProgress.filter((x) => x.overallStatus === "partial").length,
    submittedAllocations: submissionProgress.filter((x) => x.overallStatus === "submitted").length,
    overallSubmittedCount: allPubResponses.length,
  };

    // 3b-ii. Query published questions for the form
  let publicationQuestions: FeedbackQuestion[] = [];
  if (targetPub?.formId) {
    const qRows = await queryAcademic<QuestionRow[]>(
      `SELECT * FROM ap_feedback_questions WHERE form_id = ? ORDER BY order_index ASC, id ASC`,
      [targetPub.formId],
    ).catch(() => []);
    publicationQuestions = qRows.map((q) => ({
      id: Number(q.id),
      formId: Number(q.form_id),
      questionText: q.question_text,
      questionType: q.question_type as FeedbackQuestion["questionType"],
      isRequired: Number(q.is_required) === 1,
      orderIndex: Number(q.order_index),
      minValue: q.min_value != null ? Number(q.min_value) : null,
      maxValue: q.max_value != null ? Number(q.max_value) : null,
      options: parseOptions(q.options_json),
    }));
  }

  // 3b-iii. Build structured sectionGroups and facultyGroups for the report views
  const branchMap = new Map(branches.map((b) => [Number(b.id), b.name]));
  const branchCodeMap = new Map(branches.map((b) => [Number(b.id), b.code || b.name]));
  const courseMap = new Map(courses.map((c) => [Number(c.id), c.name]));

  // Load enrolled students from student_database
  const studentWhere: string[] = ["(s.student_status = 'Regular' OR s.student_status IS NULL)"];
  const studentParams: unknown[] = [];

  if (allowedBranchIds && allowedBranchIds.size > 0) {
    studentWhere.push(`s.branch_id IN (${Array.from(allowedBranchIds).map(() => "?").join(",")})`);
    studentParams.push(...Array.from(allowedBranchIds));
  }
  if (allowedCollegeIds && allowedCollegeIds.size > 0) {
    studentWhere.push(`s.college_id IN (${Array.from(allowedCollegeIds).map(() => "?").join(",")})`);
    studentParams.push(...Array.from(allowedCollegeIds));
  }

  const enrolledStudents = await queryStudent<
    (RowDataPacket & {
      id: number;
      pin: string;
      name: string;
      branch_id: number;
      course_id: number;
      college_id: number;
      batch: string;
      year_of_study: number;
      current_semester: number;
      section_name: string;
    })[]
  >(
    `
    SELECT
      s.id,
      COALESCE(s.pin_no, s.admission_number, CONCAT('STU-', s.id)) AS pin,
      s.student_name AS name,
      s.branch_id,
      s.course_id,
      s.college_id,
      s.batch,
      COALESCE(s.current_year, 1) AS year_of_study,
      COALESCE(s.current_semester, 1) AS current_semester,
      UPPER(TRIM(COALESCE(NULLIF(TRIM(ss.section_name), ''), NULLIF(TRIM(s.section), ''), 'A'))) AS section_name
    FROM students s
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE ${studentWhere.join(" AND ")}
    ORDER BY s.branch_id, s.current_year, section_name, s.student_name ASC
    LIMIT 3000
    `,
    studentParams,
  ).catch(() => []);

  // Map any anon tokens generated by SDMS student portal back to student PIN & Name
  const tokenToStudentMap = new Map<string, { pin: string; name: string }>();
  if (allPubResponses.length > 0 && enrolledStudents.length > 0) {
    for (const s of enrolledStudents) {
      for (const r of allPubResponses) {
        if (r.student_token_hash && r.subject_name) {
          const pubId = Number(r.publication_id || targetPub?.id || 0);
          const expected = computeStudentToken(Number(s.id), pubId, r.subject_name);
          if (r.student_token_hash === expected) {
            tokenToStudentMap.set(r.student_token_hash, {
              pin: String(s.pin).trim(),
              name: s.name || String(s.pin).trim(),
            });
          }
        }
      }
    }
  }

  const sectionGroupMap = new Map<string, SectionGroup>();
  const facultyGroupMap = new Map<string, FacultyGroup>();
  const seenAlloc = new Set<string>();

  for (const item of mappedSubjects) {
    const itemBranchId = item.branchId ? Number(item.branchId) : null;
    const itemCourseId = item.courseId ? Number(item.courseId) : null;
    const itemCollegeId = item.collegeId ? Number(item.collegeId) : null;

    if (allowedCollegeIds && itemCollegeId && !allowedCollegeIds.has(itemCollegeId)) {
      continue;
    }
    if (allowedBranchIds && itemBranchId && !allowedBranchIds.has(itemBranchId)) {
      continue;
    }
    if (allowedBranchIds && itemCourseId && !allowedBranchCourseIds.has(itemCourseId)) {
      continue;
    }

    const rawBranchName =
      item.branchName ||
      branchMap.get(Number(item.branchId)) ||
      branchCodeMap.get(Number(item.branchId)) ||
      "Department";
    const rawCourseName =
      item.courseName || courseMap.get(Number(item.courseId)) || "Degree";
    const sem = resolveActualSemester(item, targetPub?.academicYear);
    const romanSem = formatRomanYearSem(sem);
    const yearOfStudy = Math.ceil(sem / 2);
    const sec = (item.sectionName || "").trim();
    const secDisplay = sec ? `Section ${sec}` : "Section";

    // Respect filters if selected
    if (courseFilter && courseFilter !== "all") {
      const cNorm = courseFilter.trim().toLowerCase();
      const itemCNorm = rawCourseName.trim().toLowerCase();
      if (cNorm !== itemCNorm && String(item.courseId) !== courseFilter) {
        continue;
      }
    }
    if (branchFilter && branchFilter !== "all") {
      const bNorm = branchFilter.trim().toLowerCase();
      const itemBNorm = rawBranchName.trim().toLowerCase();
      const codeNorm = (item.branchId ? branchCodeMap.get(Number(item.branchId)) || "" : "").toLowerCase();
      if (bNorm !== itemBNorm && bNorm !== codeNorm) continue;
    }
    if (semesterFilter != null && semesterFilter > 0 && sem !== semesterFilter) {
      continue;
    }

    const allocKey = `${item.branchId}|${sem}|${sec}|${item.subjectCode}|${item.facultyName}`;
    if (seenAlloc.has(allocKey)) continue;
    seenAlloc.add(allocKey);

    const groupKey = `${item.branchId || rawBranchName}|${sem}|${sec}`;
    const sectionLabel = `${rawBranchName} - ${romanSem} - ${secDisplay}`;

    const subjectResponses = allPubResponses.filter((r) => {
      const fMatch =
        (r.faculty_name || "").trim().toLowerCase() === item.facultyName.trim().toLowerCase();
      const sMatch =
        (r.subject_name || "").trim().toLowerCase() === item.subjectName.trim().toLowerCase() ||
        (item.subjectCode &&
          (r.subject_name || "").toLowerCase().includes(item.subjectCode.toLowerCase()));
      const secMatch = !sec || (r.section_name || "").trim().toLowerCase() === sec.toLowerCase();
      return fMatch && sMatch && secMatch;
    });

    const questionSummaries = publicationQuestions.map((q) =>
      computeQuestionSummary(q, subjectResponses),
    );

    const studentDetails: StudentResponseDetail[] = subjectResponses.map((r) => {
      let answers: Record<string, unknown> = {};
      if (r.answers_json) {
        try {
          answers =
            typeof r.answers_json === "string" ? JSON.parse(r.answers_json) : r.answers_json;
        } catch {}
      }
      const tokenKey = String(r.student_token_hash || `anon_${r.id}`);
      const resolvedStudent = tokenToStudentMap.get(tokenKey);
      const studentName =
        (resolvedStudent ? `${resolvedStudent.name} (${resolvedStudent.pin})` : null) ||
        (answers.studentName as string) ||
        tokenKey;

      return {
        id: Number(r.id),
        studentName,
        tokenHash: tokenKey,
        submittedAt: toIsoString(r.submitted_at),
        branchName: r.branch_name || rawBranchName,
        semester: Number(r.semester || sem),
        sectionName: r.section_name || sec,
        subjectName: r.subject_name || item.subjectName,
        facultyName: r.faculty_name || item.facultyName,
        answers,
        unitsCovered: r.units_covered || null,
        facultyRating: r.faculty_rating != null ? Number(r.faculty_rating) : null,
        unitStatus: r.unit_status || null,
      };
    });

    const reportItem: SubjectSectionReportItem = {
      id: `${groupKey}|${item.subjectCode || item.subjectName}|${item.facultyName}`,
      subjectId: item.subjectId ? Number(item.subjectId) : null,
      subjectCode: item.subjectCode || "",
      subjectName: item.subjectName,
      staffLinkId: item.staffLinkId ? Number(item.staffLinkId) : null,
      facultyName: item.facultyName,
      employeeCode: item.employeeCode ?? null,
      branchId: item.branchId ? Number(item.branchId) : null,
      branchName: rawBranchName,
      courseId: item.courseId ? Number(item.courseId) : null,
      courseName: rawCourseName,
      semester: sem,
      romanSemester: romanSem,
      sectionName: item.sectionName ?? null,
      count: subjectResponses.length,
      questions: questionSummaries,
      studentDetails,
    };

    if (!sectionGroupMap.has(groupKey)) {
      sectionGroupMap.set(groupKey, {
        groupKey,
        branchId: item.branchId ? Number(item.branchId) : null,
        branchName: rawBranchName,
        courseId: item.courseId ? Number(item.courseId) : null,
        courseName: rawCourseName,
        semester: sem,
        romanSemester: romanSem,
        yearOfStudy,
        sectionName: item.sectionName ?? null,
        sectionLabel,
        subjectCount: 0,
        totalSubmissions: 0,
        subjects: [],
      });
    }
    const secGroup = sectionGroupMap.get(groupKey)!;
    secGroup.subjects.push(reportItem);
    secGroup.subjectCount = secGroup.subjects.length;
    secGroup.totalSubmissions += reportItem.count;

    const fKey = item.facultyName.trim().toUpperCase();
    if (!facultyGroupMap.has(fKey)) {
      facultyGroupMap.set(fKey, {
        facultyKey: fKey,
        facultyName: item.facultyName,
        employeeCode: item.employeeCode ?? null,
        staffLinkId: item.staffLinkId ? Number(item.staffLinkId) : null,
        totalSubjects: 0,
        totalSubmissions: 0,
        overallRating: null,
        subjects: [],
      });
    }
    const facGroup = facultyGroupMap.get(fKey)!;
    facGroup.subjects.push({
      ...reportItem,
      classLabel: `${rawBranchName} - ${romanSem} - ${sec ? "Sec " + sec : "Section"}`,
    });
    facGroup.totalSubjects = facGroup.subjects.length;
    facGroup.totalSubmissions += reportItem.count;
  }

  for (const facGroup of facultyGroupMap.values()) {
    let rSum = 0;
    let rCount = 0;
    for (const s of facGroup.subjects) {
      for (const q of s.questions) {
        if (q.avgScore != null && q.avgScore > 0) {
          rSum += q.avgScore * s.count;
          rCount += s.count;
        }
      }
    }
    facGroup.overallRating = rCount > 0 ? Math.round((rSum / rCount) * 100) / 100 : null;
  }

  const sectionGroups = Array.from(sectionGroupMap.values());
  sectionGroups.sort((a, b) => {
    const yrA = a.yearOfStudy || Math.ceil((a.semester || 1) / 2);
    const yrB = b.yearOfStudy || Math.ceil((b.semester || 1) / 2);
    if (yrA !== yrB) return yrA - yrB;
    if (a.semester !== b.semester) return a.semester - b.semester;
    return a.sectionLabel.localeCompare(b.sectionLabel);
  });
  const facultyGroups = Array.from(facultyGroupMap.values());
  facultyGroups.sort((a, b) => a.facultyName.localeCompare(b.facultyName));

  // 3b-iv. Build studentReports
  const responsesByStudent = new Map<string, StudentSubjectEvaluation[]>();
  const studentMetaByIdentifier = new Map<
    string,
    {
      studentPin?: string;
      studentName?: string;
      branchName?: string;
      semester?: number;
      sectionName?: string;
      lastSubmittedAt?: string;
    }
  >();

  for (const r of allPubResponses) {
    let answers: Record<string, unknown> = {};
    if (r.answers_json) {
      try {
        answers = typeof r.answers_json === "string" ? JSON.parse(r.answers_json) : r.answers_json;
      } catch {}
    }
    const tokenKey = String(r.student_token_hash || `anon_${r.id}`);
    const resolvedStudent = tokenToStudentMap.get(tokenKey);
    const pin = String(resolvedStudent?.pin || answers.studentPin || answers.pin || answers.rollNumber || "").trim();
    const name = String(resolvedStudent?.name || answers.studentName || answers.name || "").trim();
    const studentIdentifier = (pin || tokenKey).toUpperCase();

    if (!responsesByStudent.has(studentIdentifier)) {
      responsesByStudent.set(studentIdentifier, []);
      studentMetaByIdentifier.set(studentIdentifier, {
        studentPin: pin || undefined,
        studentName: name || undefined,
        branchName: r.branch_name || undefined,
        semester: r.semester ? Number(r.semester) : undefined,
        sectionName: r.section_name || undefined,
        lastSubmittedAt: toIsoString(r.submitted_at),
      });
    }

    responsesByStudent.get(studentIdentifier)!.push({
      subjectName: r.subject_name || "Subject",
      subjectCode: "",
      facultyName: r.faculty_name || "Faculty",
      unitsCovered: r.units_covered || null,
      facultyRating: r.faculty_rating != null ? Number(r.faculty_rating) : null,
      unitStatus: r.unit_status || null,
      answers,
      submittedAt: toIsoString(r.submitted_at),
    });
  }

  const studentReports: StudentReportItem[] = [];
  const processedIdentifiers = new Set<string>();

  for (const s of enrolledStudents) {
    const rawBranchName = branchMap.get(Number(s.branch_id)) || "Department";
    const rawCourseName = courseMap.get(Number(s.course_id)) || "Degree";
    const yr = Number(s.year_of_study || 1);
    const sem = (yr - 1) * 2 + (Number(s.current_semester) === 2 ? 2 : 1);
    const romanSem = formatRomanYearSem(sem);
    const sec = (s.section_name || "A").trim();

    const secKey = `${s.branch_id}|${sem}|${sec}`;
    const secGroup = sectionGroupMap.get(secKey);
    const expectedSubjectsCount = secGroup ? secGroup.subjects.length : 0;

    const studentPin = String(s.pin).trim();
    processedIdentifiers.add(studentPin.toUpperCase());

    const evaluations = responsesByStudent.get(studentPin.toUpperCase()) || [];
    const totalEvaluated = evaluations.length;
    let status: "submitted" | "partial" | "pending" = "pending";
    if (totalEvaluated > 0) {
      status = expectedSubjectsCount > 0 && totalEvaluated >= expectedSubjectsCount ? "submitted" : "partial";
    }

    studentReports.push({
      id: `stu_${s.id}`,
      studentPin,
      studentName: s.name || studentPin,
      tokenHash: undefined,
      collegeId: s.college_id ? Number(s.college_id) : null,
      courseId: s.course_id ? Number(s.course_id) : null,
      courseName: rawCourseName,
      branchId: s.branch_id ? Number(s.branch_id) : null,
      branchName: rawBranchName,
      yearOfStudy: yr,
      semester: sem,
      romanSemester: romanSem,
      sectionName: sec,
      status,
      totalEvaluated,
      totalExpected: expectedSubjectsCount,
      lastSubmittedAt: evaluations.length > 0 ? evaluations[0].submittedAt : null,
      evaluations,
    });
  }

  for (const [identifier, evals] of responsesByStudent.entries()) {
    if (processedIdentifiers.has(identifier)) continue;
    const meta = studentMetaByIdentifier.get(identifier);
    const bName = meta?.branchName || "Department";
    const sem = meta?.semester || 1;
    const yr = Math.ceil(sem / 2);
    const sec = meta?.sectionName || "A";

    studentReports.push({
      id: `resp_${identifier}`,
      studentPin: meta?.studentPin || identifier,
      studentName: meta?.studentName || meta?.studentPin || `Student (${identifier.slice(0, 8)})`,
      tokenHash: identifier,
      collegeId: null,
      courseId: null,
      courseName: "Degree",
      branchId: null,
      branchName: bName,
      yearOfStudy: yr,
      semester: sem,
      romanSemester: formatRomanYearSem(sem),
      sectionName: sec,
      status: "submitted",
      totalEvaluated: evals.length,
      totalExpected: evals.length,
      lastSubmittedAt: evals[0]?.submittedAt || null,
      evaluations: evals,
    });
  }


  // 3c. Query filtered responses for analytics
  const responses = targetPub ? await queryAcademic<ResponseRow[]>(sql, params) : [];
  const totalSubmissions = responses.length;

  if (totalSubmissions === 0) {
    return {
      publication: targetPub,
      publications: publicationsList,
      forms: formsList.map((f) => ({ id: f.id, name: f.name, questionCount: f.questionCount ?? 0 })),
      availableColleges: filteredColleges.map((c) => ({ id: Number(c.id), name: c.name, code: c.code || "" })),
      availableCourses,
      availableBranches,
      availableAcademicYears,
      currentAcademicYear,
      availableBatches,
      availableSections,
      availableYearsOfStudy,
      availableStaffSubjects,
      filters: {
        selectedPublicationId: targetPub ? targetPub.id : null,
        selectedBranch: branchFilter || null,
        selectedSemester: semesterFilter || null,
        availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      stats: {
        totalSubmissions: 0,
        averageRating: null,
        ratingSatisfactionPct: null,
        averageUnitsCovered: null,
        completionRate: null,
      },
      unitsCoveredDistribution: ["1", "2", "3", "4", "5"].map((u) => ({
        unit: u,
        label: `Unit ${u}`,
        count: 0,
        percentage: 0,
      })),
      facultyRatingDistribution: [5, 4, 3, 2, 1].map((s) => ({
        stars: s,
        count: 0,
        percentage: 0,
      })),
      unitStatusDistribution: [
        { status: "Completed", count: 0, percentage: 0, color: "emerald" },
        { status: "Ending", count: 0, percentage: 0, color: "blue" },
        { status: "Middle", count: 0, percentage: 0, color: "amber" },
        { status: "Starting", count: 0, percentage: 0, color: "slate" },
      ],
      facultyBreakdown: [],
      recentSubmissions: [],
      publicationQuestions,
      sectionGroups,
      facultyGroups,
      studentReports,
      submissionProgress,
      submissionSummary,
    };
  }

  // 4. Compute analytics
  let ratingSum = 0;
  let ratingCount = 0;
  let satisfiedCount = 0;
  let unitsSum = 0;
  let unitsCount = 0;
  let completionCount = 0;

  const unitsMap: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const ratingMap: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const statusMap: Record<string, number> = {
    Completed: 0,
    Ending: 0,
    Middle: 0,
    Starting: 0,
  };

  const facultyMap = new Map<
    string,
    {
      facultyName: string;
      subjectName: string;
      branchName: string;
      ratings: number[];
      units: number[];
      statuses: string[];
    }
  >();

  for (const r of responses) {
    if (r.faculty_rating != null && r.faculty_rating > 0) {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.faculty_rating))));
      ratingSum += star;
      ratingCount++;
      ratingMap[star] = (ratingMap[star] || 0) + 1;
      if (star >= 4) satisfiedCount++;
    }

    if (r.units_covered) {
      const uStr = String(r.units_covered).trim();
      const num = parseInt(uStr, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        unitsSum += num;
        unitsCount++;
        unitsMap[String(num)] = (unitsMap[String(num)] || 0) + 1;
      }
    }

    if (r.unit_status) {
      const st = String(r.unit_status).trim();
      if (statusMap[st] !== undefined) {
        statusMap[st]++;
      } else {
        statusMap[st] = 1;
      }
      if (st === "Completed" || st === "Ending") {
        completionCount++;
      }
    }

    const facultyKey = `${r.faculty_name ?? "Faculty"}::${r.subject_name ?? "Subject"}`;
    if (!facultyMap.has(facultyKey)) {
      facultyMap.set(facultyKey, {
        facultyName: r.faculty_name || "Faculty Member",
        subjectName: r.subject_name || "Subject",
        branchName: r.branch_name || "Department",
        ratings: [],
        units: [],
        statuses: [],
      });
    }
    const entry = facultyMap.get(facultyKey)!;
    if (r.faculty_rating) entry.ratings.push(Number(r.faculty_rating));
    if (r.units_covered) {
      const n = parseInt(r.units_covered, 10);
      if (!isNaN(n)) entry.units.push(n);
    }
    if (r.unit_status) entry.statuses.push(r.unit_status);
  }

  const averageRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;
  const ratingSatisfactionPct = ratingCount > 0 ? Math.round((satisfiedCount / ratingCount) * 100) : null;
  const averageUnitsCovered = unitsCount > 0 ? Math.round((unitsSum / unitsCount) * 10) / 10 : null;
  const completionRate = totalSubmissions > 0 ? Math.round((completionCount / totalSubmissions) * 100) : null;

  const unitsCoveredDistribution = ["1", "2", "3", "4", "5"].map((u) => {
    const count = unitsMap[u] || 0;
    return {
      unit: u,
      label: `Unit ${u}`,
      count,
      percentage: totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0,
    };
  });

  const facultyRatingDistribution = [5, 4, 3, 2, 1].map((s) => {
    const count = ratingMap[s] || 0;
    return {
      stars: s,
      count,
      percentage: ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0,
    };
  });

  const statusColors: Record<string, string> = {
    Completed: "emerald",
    Ending: "blue",
    Middle: "amber",
    Starting: "slate",
  };

  const unitStatusDistribution = ["Completed", "Ending", "Middle", "Starting"].map((st) => {
    const count = statusMap[st] || 0;
    return {
      status: st,
      count,
      percentage: totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0,
      color: statusColors[st] || "slate",
    };
  });

  const facultyBreakdown = Array.from(facultyMap.values()).map((f) => {
    const fAvgRating =
      f.ratings.length > 0
        ? Math.round((f.ratings.reduce((a, b) => a + b, 0) / f.ratings.length) * 10) / 10
        : 0;
    const fAvgUnits =
      f.units.length > 0
        ? Math.round((f.units.reduce((a, b) => a + b, 0) / f.units.length) * 10) / 10
        : 0;

    const stCount: Record<string, number> = {};
    for (const s of f.statuses) stCount[s] = (stCount[s] || 0) + 1;
    let mostCommon = "In Progress";
    let maxC = 0;
    for (const [k, v] of Object.entries(stCount)) {
      if (v > maxC) {
        maxC = v;
        mostCommon = k;
      }
    }

    let statusBadge: "Excellent" | "Good" | "Satisfactory" | "Needs Attention" = "Good";
    if (fAvgRating >= 4.5) statusBadge = "Excellent";
    else if (fAvgRating >= 4.0) statusBadge = "Good";
    else if (fAvgRating >= 3.0) statusBadge = "Satisfactory";
    else statusBadge = "Needs Attention";

    return {
      facultyName: f.facultyName,
      subjectName: f.subjectName,
      branchName: f.branchName,
      responsesCount: f.ratings.length,
      avgRating: fAvgRating,
      avgUnits: fAvgUnits,
      mostCommonStatus: mostCommon,
      statusBadge,
    };
  });

  facultyBreakdown.sort((a, b) => b.avgRating - a.avgRating || b.responsesCount - a.responsesCount);

  // Resolve real student names from student_database for the verification column
  const tokenToStudent = new Map<string, { name: string; pin?: string }>();
  if (responses.length > 0) {
    try {
      const branchNamesInResponses = new Set(
        responses.map((r) => (r.branch_name || "").trim().toUpperCase()).filter(Boolean),
      );
      const matchedBranchIds = branches
        .filter((b) => branchNamesInResponses.has(b.name.trim().toUpperCase()) || (b.code && branchNamesInResponses.has(b.code.trim().toUpperCase())))
        .map((b) => Number(b.id));

      const branchIdList = matchedBranchIds.length > 0 ? matchedBranchIds : [39];

      const studentRows = await queryStudent<(RowDataPacket & {
        id: number;
        student_name: string;
        pin_no: string;
        section: string;
        branch_id: number;
        batch: string;
      })[]>(
        `
        SELECT
          s.id,
          s.student_name,
          s.pin_no,
          COALESCE(NULLIF(TRIM(ss.section_name), ''), NULLIF(TRIM(s.section), ''), '') AS section,
          COALESCE(ss.branch_id, s.branch_id) AS branch_id,
          COALESCE(NULLIF(TRIM(ss.batch), ''), NULLIF(TRIM(s.batch), ''), '') AS batch
        FROM students s
        LEFT JOIN student_sections ss ON ss.student_id = s.id
        WHERE (s.branch_id IN (?) OR ss.branch_id IN (?))
          AND s.student_name IS NOT NULL AND s.student_name != ''
        ORDER BY s.id ASC
        `,
        [branchIdList, branchIdList],
      ).catch(() => []);

      const secStudentsMap = new Map<string, Array<{ name: string; pin?: string }>>();
      for (const st of studentRows) {
        const name = (st.student_name || "").trim();
        if (!name) continue;
        const sec = (st.section || "").trim().toUpperCase();
        const bId = String(st.branch_id);
        const item = { name, pin: st.pin_no || undefined };

        if (bId && sec) {
          const k = `${bId}|${sec}`;
          if (!secStudentsMap.has(k)) secStudentsMap.set(k, []);
          secStudentsMap.get(k)!.push(item);
        }
        if (sec) {
          if (!secStudentsMap.has(sec)) secStudentsMap.set(sec, []);
          secStudentsMap.get(sec)!.push(item);
        }
      }

      const branchNameToId = new Map<string, number>();
      for (const b of branches) {
        branchNameToId.set(b.name.trim().toUpperCase(), Number(b.id));
        if (b.code) branchNameToId.set(b.code.trim().toUpperCase(), Number(b.id));
      }

      const studentIdxBySec = new Map<string, number>();
      for (const r of responses) {
        let customName: string | null = null;
        if (r.answers_json) {
          try {
            const parsed = typeof r.answers_json === "string" ? JSON.parse(r.answers_json) : r.answers_json;
            if (parsed && typeof parsed === "object") {
              const rec = parsed as Record<string, unknown>;
              if (rec.studentName || rec.student_name) {
                customName = String(rec.studentName || rec.student_name).trim();
              }
            }
          } catch {
            // ignore
          }
        }

        const tokenKey = String(r.student_token_hash || `anon_${r.id}`);
        if (customName) {
          tokenToStudent.set(tokenKey, { name: customName });
          continue;
        }

        if (!tokenToStudent.has(tokenKey)) {
          const bName = String(r.branch_name || "").trim().toUpperCase();
          const bId = branchNameToId.get(bName);
          const sec = String(r.section_name || "").trim().toUpperCase();

          const candidates = (bId && sec ? secStudentsMap.get(`${bId}|${sec}`) : null)
            || (sec ? secStudentsMap.get(sec) : null)
            || [];

          if (candidates.length > 0) {
            const secKey = `${bId || bName}|${sec}`;
            const idx = studentIdxBySec.get(secKey) ?? 0;
            tokenToStudent.set(tokenKey, candidates[idx % candidates.length]);
            studentIdxBySec.set(secKey, idx + 1);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const recentSubmissions = responses.slice(0, 40).map((r) => {
    const tokenKey = String(r.student_token_hash || `anon_${r.id}`);
    const studentInfo = tokenToStudent.get(tokenKey);
    const resolvedName = studentInfo?.name || tokenKey;

    return {
      id: Number(r.id),
      submittedAt: toIsoString(r.submitted_at),
      branchName: r.branch_name || "—",
      semester: Number(r.semester || 1),
      sectionName: r.section_name || "—",
      subjectName: r.subject_name || "—",
      facultyName: r.faculty_name || "—",
      unitsCovered: r.units_covered ? `Unit ${r.units_covered}` : "—",
      facultyRating: Number(r.faculty_rating || 0),
      unitStatus: r.unit_status || "—",
      tokenHash: resolvedName,
      studentName: resolvedName,
    };
  });

  return {
    publication: targetPub,
    publications: publicationsList,
    forms: formsList.map((f) => ({ id: f.id, name: f.name, questionCount: f.questionCount ?? 0 })),
    availableColleges: colleges.map((c) => ({ id: Number(c.id), name: c.name, code: c.code || "" })),
    availableCourses,
    availableBranches,
    availableAcademicYears,
    currentAcademicYear,
    availableBatches,
    availableSections,
    availableYearsOfStudy,
    availableStaffSubjects,
    filters: {
      selectedPublicationId: targetPub ? targetPub.id : null,
      selectedBranch: branchFilter || null,
      selectedSemester: semesterFilter || null,
      availableSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
    },
    stats: {
      totalSubmissions,
      averageRating,
      ratingSatisfactionPct,
      averageUnitsCovered,
      completionRate,
    },
    unitsCoveredDistribution,
    facultyRatingDistribution,
    unitStatusDistribution,
    facultyBreakdown,
    recentSubmissions,
    publicationQuestions,
    sectionGroups,
    facultyGroups,
    studentReports,
    submissionProgress,
    submissionSummary,
  };
}

export async function submitFeedbackResponse(
  publicationId: number,
  input: {
    collegeId?: number | null;
    branchName?: string | null;
    academicYear?: string | null;
    semester?: number | null;
    sectionName?: string | null;
    subjectName?: string | null;
    facultyName?: string | null;
    unitsCovered?: string | null;
    facultyRating?: number | null;
    unitStatus?: string | null;
    answers?: Record<string, unknown>;
    studentName?: string | null;
  },
) {
  await ensureFeedbackFormsTable();
  const token = `anon_${Math.random().toString(36).substring(2, 10)}`;

  const pub = (
    await queryAcademic<PublicationRow[]>(`SELECT * FROM ap_feedback_publications WHERE id = ? LIMIT 1`, [publicationId])
  )[0];

  const formId = pub ? pub.form_id : 1;

  const answersPayload = {
    ...(input.answers ?? {}),
    ...(input.studentName ? { studentName: input.studentName } : {}),
  };

  await withAcademicTransaction(async (conn) => {
    await conn.query(
      `
      INSERT INTO ap_feedback_responses (
        publication_id, form_id, college_id, branch_name, academic_year, semester, section_name,
        subject_name, faculty_name, student_token_hash, units_covered, faculty_rating, unit_status,
        answers_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        publicationId,
        formId,
        input.collegeId ?? pub?.college_id ?? 1,
        input.branchName ?? pub?.branch_name ?? null,
        input.academicYear ?? pub?.academic_year ?? "2025-2026",
        input.semester ?? pub?.semester ?? null,
        input.sectionName ?? null,
        input.subjectName ?? null,
        input.facultyName ?? null,
        token,
        input.unitsCovered ?? null,
        input.facultyRating ?? null,
        input.unitStatus ?? null,
        JSON.stringify(answersPayload),
      ],
    );
  });

  return { success: true, token };
}
