import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getHrmsDb, queryAcademic, executeAcademic } from "../db/pools.js";
import { getStaffMemberDetail } from "./staff.service.js";
import { getFacultyWorkloadDetail } from "./workload.service.js";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export type StaffPersonalDetailsInput = {
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  aadhaar_number?: string | null;
  pan_number?: string | null;
  uan_number?: string | null;
  pf_number?: string | null;
  personal_email?: string | null;
  official_email?: string | null;
  mobile_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  current_address?: string | null;
  permanent_address?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  highest_qualification?: string | null;
  specialization?: string | null;
  total_experience_years?: number | null;
  employment_status?: string | null;
  date_of_joining?: string | null;
  probation_end_date?: string | null;
  confirmation_date?: string | null;
  date_of_relieving?: string | null;
  relieving_reason?: string | null;
};

export type StaffAchievementInput = {
  category: string;
  title: string;
  description?: string | null;
  publication_name?: string | null;
  issuing_organization?: string | null;
  publication_date?: string | null;
  certificate_number_or_doi?: string | null;
  academic_year?: string | null;
  semester?: string | null;
  achievement_url?: string | null;
  status?: string;
  documents?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    fileType?: string;
  }>;
};

export type StaffSemesterRoleInput = {
  academic_year: string;
  semester: string;
  role_name: string;
  department?: string | null;
  college?: string | null;
  assigned_by?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  responsibilities?: string | null;
  status?: string;
  supporting_doc_url?: string | null;
};

export type StaffDocumentInput = {
  document_type: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
};

// ─── Profile Retrieval ─────────────────────────────────────────────────────────

export async function getStaffDetailedProfile(
  identifier: string,
  options?: { date?: string; collegeNames?: string[] },
) {
  // 1. Get base details from existing staff service
  const base = await getStaffMemberDetail({
    identifier,
    date: options?.date,
    collegeNames: options?.collegeNames,
  });

  if (!base) return null;

  const hrmsId = base.staff.hrmsEmployeeId;
  const staffLinkId = base.staff.staffLinkId;
  const staffName = base.staff.name;

  // 2. Fetch raw HRMS employee document from MongoDB directly (Single Source of Truth)
  const hrmsDb = await getHrmsDb().catch(() => null);
  let hrmsEmp: any = null;
  if (hrmsDb) {
    try {
      hrmsEmp = await hrmsDb.collection("employees").findOne({
        $or: [
          { employeeNumber: hrmsId },
          { emp_no: hrmsId },
          { employeeNumber: base.staff.code },
          { emp_no: base.staff.code },
          { employeeCode: hrmsId },
          { employeeCode: base.staff.code },
        ],
      });
    } catch (e) {
      console.warn("[getStaffDetailedProfile] Could not fetch HRMS employee doc:", e);
    }
  }

  // 3. Fetch Extended Personal & Employment details from DB
  const [personalRows, achievementRows, roleRows, careerRows, docRows, feedbackRows, semesterHistoryRows, facultySessionRows] =
    await Promise.all([
      queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM ap_staff_personal_details WHERE hrms_employee_id = ? LIMIT 1`,
        [hrmsId],
      ).catch(() => []),

      queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT a.*, 
           CONCAT('[', 
             COALESCE(
               GROUP_CONCAT(
                 JSON_OBJECT(
                   'id', d.id, 
                   'fileName', d.file_name, 
                   'fileUrl', d.file_url, 
                   'fileSize', d.file_size, 
                   'fileType', d.file_type
                 )
               ), ''
             ), 
           ']') AS documents_json
         FROM ap_staff_achievements a
         LEFT JOIN ap_staff_achievement_documents d ON d.achievement_id = a.id
         WHERE a.hrms_employee_id = ? AND a.deleted_at IS NULL
         GROUP BY a.id
         ORDER BY a.publication_date DESC, a.created_at DESC`,
        [hrmsId],
      ).catch(() => []),

      queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM ap_staff_semester_roles 
         WHERE hrms_employee_id = ? 
         ORDER BY academic_year DESC, semester DESC, start_date DESC`,
        [hrmsId],
      ).catch(() => []),

      queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM ap_staff_career_history 
         WHERE hrms_employee_id = ? 
         ORDER BY event_date DESC, created_at DESC`,
        [hrmsId],
      ).catch(() => []),

      queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT * FROM ap_staff_documents 
         WHERE hrms_employee_id = ? 
         ORDER BY created_at DESC`,
        [hrmsId],
      ).catch(() => []),

      // Student Feedback linked to this faculty name
      queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
        `SELECT 
           academic_year,
           semester,
           branch_name,
           section_name,
           subject_name,
           faculty_name,
           COUNT(*) as total_feedback_count,
           ROUND(AVG(faculty_rating), 1) as avg_rating,
           JSON_ARRAYAGG(
             JSON_OBJECT(
               'rating', faculty_rating,
               'submittedAt', submitted_at,
               'answers', answers_json
             )
           ) as feedback_details
         FROM ap_feedback_responses
         WHERE LOWER(faculty_name) LIKE CONCAT('%', LOWER(?), '%')
         GROUP BY academic_year, semester, branch_name, section_name, subject_name, faculty_name
         ORDER BY academic_year DESC, semester DESC`,
        [staffName],
      ).catch(() => []),

      // Semester-wise Academic Teaching History from timetable plans & semester calendar dates
      staffLinkId
        ? queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
            `SELECT 
               p.id as plan_id,
               p.academic_year_label,
               p.semester_number,
               p.batch,
               COALESCE(p.section_name, 'A') as section_name,
               p.course_id,
               p.branch_id,
               te.subject_code,
               te.subject_name,
               COALESCE(te.entry_type, 'theory') as subject_type,
               COUNT(DISTINCT te.id) as periods_allotted,
               MIN(s.start_date) as sem_start_date,
               MAX(s.end_date) as sem_end_date
             FROM ap_timetable_entries te
             JOIN ap_timetable_plans p ON p.id = te.plan_id AND p.status = 'published'
             LEFT JOIN student_database.academic_years ay ON ay.year_label COLLATE utf8mb4_unicode_ci = p.academic_year_label COLLATE utf8mb4_unicode_ci
             LEFT JOIN student_database.semesters s ON 
               (s.college_id = p.college_id OR s.college_id IS NULL)
               AND s.course_id = p.course_id
               AND s.batch COLLATE utf8mb4_unicode_ci = p.batch COLLATE utf8mb4_unicode_ci
               AND s.semester_number = p.semester_number
               AND s.academic_year_id = ay.id
             WHERE te.faculty_staff_link_id = ?
             GROUP BY p.id, p.academic_year_label, p.semester_number, p.batch, p.section_name, p.course_id, p.branch_id, te.subject_code, te.subject_name, te.entry_type
             ORDER BY p.academic_year_label DESC, p.semester_number DESC, te.subject_name ASC`,
            [staffLinkId],
          ).catch(() => [])
        : Promise.resolve([]),

      // All scheduled session occurrences for this faculty with attendance post & substitution markers
      staffLinkId
        ? queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
            `SELECT 
               cs.id,
               cs.plan_id,
               cs.subject_code,
               DATE_FORMAT(cs.session_date, '%Y-%m-%d') as session_date,
               ap.id as post_id,
               ap.posted_by_staff_link_id,
               sub.id as sub_id
             FROM ap_class_sessions cs
             LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
             LEFT JOIN ap_class_session_substitutions sub ON sub.class_session_id = cs.id AND sub.status = 'active'
             WHERE cs.faculty_staff_link_id = ? AND cs.status != 'cancelled'`,
            [staffLinkId],
          ).catch(() => [])
        : Promise.resolve([]),
    ]);

  // Parse achievements documents json
  const achievements = achievementRows.map((row) => {
    let docs = [];
    try {
      docs = typeof row.documents_json === "string" ? JSON.parse(row.documents_json) : [];
      docs = docs.filter((d: any) => d && d.id);
    } catch {
      docs = [];
    }
    return {
      id: Number(row.id),
      category: String(row.category || "Professional Certifications"),
      title: String(row.title || ""),
      description: row.description ? String(row.description) : null,
      publicationName: row.publication_name ? String(row.publication_name) : null,
      issuingOrganization: row.issuing_organization ? String(row.issuing_organization) : null,
      publicationDate: row.publication_date ? String(row.publication_date).split("T")[0] : null,
      certificateNumberOrDoi: row.certificate_number_or_doi ? String(row.certificate_number_or_doi) : null,
      academicYear: row.academic_year ? String(row.academic_year) : null,
      semester: row.semester ? String(row.semester) : null,
      achievementUrl: row.achievement_url ? String(row.achievement_url) : null,
      status: String(row.status || "draft"),
      hodRemarks: row.hod_remarks ? String(row.hod_remarks) : null,
      principalRemarks: row.principal_remarks ? String(row.principal_remarks) : null,
      rejectionRemarks: row.rejection_remarks ? String(row.rejection_remarks) : null,
      createdAt: String(row.created_at || ""),
      documents: docs,
    };
  });

  // Fetch full approval audit history for all achievements of this staff
  const achievementIds = achievements.map((a) => a.id);
  let approvalHistory: any[] = [];
  if (achievementIds.length > 0) {
    const approvalRows = await queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT h.*, a.title as achievement_title, a.category as achievement_category
       FROM ap_staff_achievement_approvals h
       JOIN ap_staff_achievements a ON a.id = h.achievement_id
       WHERE h.achievement_id IN (${achievementIds.join(",")})
       ORDER BY h.created_at DESC`,
    ).catch(() => []);

    approvalHistory = approvalRows.map((r) => ({
      id: Number(r.id),
      achievementId: Number(r.achievement_id),
      achievementTitle: String(r.achievement_title || ""),
      achievementCategory: String(r.achievement_category || ""),
      actorName: String(r.actor_name || "System Admin"),
      actorRole: String(r.actor_role || "staff"),
      action: String(r.action || "submitted"),
      remarks: r.remarks ? String(r.remarks) : null,
      createdAt: String(r.created_at || ""),
    }));
  }

  // Extract and merge personal details directly from HRMS Master (Single Source of Truth)
  const dynamic = (hrmsEmp?.dynamicFields && typeof hrmsEmp.dynamicFields === "object" ? hrmsEmp.dynamicFields : {}) as Record<string, unknown>;
  let allData: Record<string, unknown> = {};
  if (typeof dynamic.allData === "string") {
    try { allData = JSON.parse(dynamic.allData); } catch {}
  } else if (dynamic.allData && typeof dynamic.allData === "object") {
    allData = dynamic.allData as Record<string, unknown>;
  }

  const str = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s && s !== "null" && s !== "undefined" && s !== "—" ? s : null;
  };

  const formatDate = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().split("T")[0];
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString().split("T")[0];
  };

  const personalFallback = personalRows[0] || {};

  const email = str(hrmsEmp?.email) || str(hrmsEmp?.official_email) || str(hrmsEmp?.personal_email) || str(dynamic.email) || str(dynamic.official_email) || str(allData.email) || str(allData.official_email) || str(base.staff.email);
  const personalEmail = str(hrmsEmp?.personal_email) || str(dynamic.personal_email) || str(allData.personal_email) || email;
  const officialEmail = str(hrmsEmp?.official_email) || str(dynamic.official_email) || str(allData.official_email) || email;
  const mobile = str(hrmsEmp?.mobile) || str(hrmsEmp?.phone) || str(hrmsEmp?.contact_number) || str(dynamic.mobile) || str(dynamic.phone) || str(allData.mobile) || str(allData.phone) || str(base.staff.phone);

  const rawDoj = hrmsEmp?.dateOfJoining || hrmsEmp?.doj || hrmsEmp?.joiningDate || dynamic.dateOfJoining || dynamic.doj || allData.dateOfJoining || base.staff.dateOfJoining;
  const dateOfJoining = formatDate(rawDoj);

  const rawDob = hrmsEmp?.dob || hrmsEmp?.dateOfBirth || dynamic.dob || allData.dob || allData.dateOfBirth || personalFallback.dob;
  const dob = formatDate(rawDob);

  const gender = str(hrmsEmp?.gender) || str(dynamic.gender) || str(allData.gender) || str(base.staff.gender) || "—";
  const bloodGroup = str(hrmsEmp?.bloodGroup) || str(hrmsEmp?.blood_group) || str(dynamic.bloodGroup) || str(dynamic.blood_group) || str(allData.bloodGroup) || str(allData.blood_group) || str(personalFallback.blood_group) || "—";
  const maritalStatus = str(hrmsEmp?.maritalStatus) || str(hrmsEmp?.marital_status) || str(dynamic.maritalStatus) || str(allData.maritalStatus) || str(personalFallback.marital_status) || "—";
  const nationality = str(hrmsEmp?.nationality) || str(dynamic.nationality) || str(allData.nationality) || "Indian";

  const aadhaarNumber = str(hrmsEmp?.aadhaar) || str(hrmsEmp?.aadhaarNumber) || str(hrmsEmp?.aadhaar_number) || str(dynamic.aadhaar) || str(allData.aadhaar) || str(allData.aadhaarNumber) || str(personalFallback.aadhaar_number);
  const panNumber = str(hrmsEmp?.pan) || str(hrmsEmp?.panNumber) || str(hrmsEmp?.pan_number) || str(dynamic.pan) || str(allData.pan) || str(allData.panNumber) || str(personalFallback.pan_number);
  const uanNumber = str(hrmsEmp?.uan) || str(hrmsEmp?.uanNumber) || str(dynamic.uan) || str(allData.uan) || str(personalFallback.uan_number);
  const pfNumber = str(hrmsEmp?.pfNumber) || str(hrmsEmp?.pf_number) || str(dynamic.pfNumber) || str(allData.pfNumber) || str(personalFallback.pf_number);

  const emergencyContactName = str(hrmsEmp?.emergencyContactName) || str(dynamic.emergencyContactName) || str(allData.emergencyContactName) || str(allData.emergencyContactPerson) || str(personalFallback.emergency_contact_name);
  const emergencyContactPhone = str(hrmsEmp?.emergencyContactPhone) || str(hrmsEmp?.emergencyContact) || str(dynamic.emergencyContactPhone) || str(allData.emergencyContactPhone) || str(allData.emergencyContactNumber) || str(personalFallback.emergency_contact_phone);

  const currentAddress = str(hrmsEmp?.presentAddress) || str(hrmsEmp?.address) || str(dynamic.presentAddress) || str(dynamic.address) || str(allData.presentAddress) || str(allData.address) || str(personalFallback.current_address);
  const permanentAddress = str(hrmsEmp?.permanentAddress) || str(dynamic.permanentAddress) || str(allData.permanentAddress) || str(personalFallback.permanent_address) || currentAddress;

  const city = str(hrmsEmp?.city) || str(dynamic.city) || str(allData.city) || str(personalFallback.city) || "—";
  const district = str(hrmsEmp?.district) || str(dynamic.district) || str(allData.district) || str(personalFallback.district) || "—";
  const state = str(hrmsEmp?.state) || str(dynamic.state) || str(allData.state) || str(personalFallback.state) || "Andhra Pradesh";
  const pincode = str(hrmsEmp?.pincode) || str(dynamic.pincode) || str(allData.pincode) || str(personalFallback.pincode);

  const highestQualification = str(hrmsEmp?.qualification) || str(hrmsEmp?.highestQualification) || str(dynamic.qualification) || str(allData.qualification) || str(base.staff.qualification) || "—";
  const specialization = str(hrmsEmp?.specialization) || str(dynamic.specialization) || str(allData.specialization) || str(personalFallback.specialization);
  const experienceStr = str(hrmsEmp?.experience) || str(hrmsEmp?.totalExperience) || str(dynamic.experience) || str(allData.experience) || str(base.staff.experience);
  const totalExperienceYears = experienceStr ? (parseFloat(experienceStr) || 0) : 0;

  const rawRelieving = hrmsEmp?.dateOfRelieving || hrmsEmp?.relievingDate || dynamic.dateOfRelieving || allData.dateOfRelieving || personalFallback.date_of_relieving;
  const dateOfRelieving = formatDate(rawRelieving);
  const relievingReason = str(hrmsEmp?.relievingReason) || str(dynamic.relievingReason) || str(allData.relievingReason) || str(personalFallback.relieving_reason);

  const rawConfirmation = hrmsEmp?.confirmationDate || dynamic.confirmationDate || allData.confirmationDate || personalFallback.confirmation_date;
  const confirmationDate = formatDate(rawConfirmation);
  const rawProbation = hrmsEmp?.probationEndDate || dynamic.probationEndDate || allData.probationEndDate || personalFallback.probation_end_date;
  const probationEndDate = formatDate(rawProbation);

  const reportingOfficer = str(hrmsEmp?.reportingOfficer) || str(dynamic.reportingOfficer) || str(allData.reportingOfficer);

  const personalDetails = {
    dob,
    gender,
    bloodGroup,
    maritalStatus,
    nationality,
    aadhaarNumber,
    panNumber,
    uanNumber,
    pfNumber,
    personalEmail,
    officialEmail,
    mobileNumber: mobile,
    emergencyContactName,
    emergencyContactPhone,
    currentAddress,
    permanentAddress,
    city,
    district,
    state,
    pincode,
    highestQualification,
    specialization,
    totalExperienceYears,
    employmentStatus: base.staff.isActive ? "Active" : "Relieved",
    dateOfJoining,
    probationEndDate,
    confirmationDate,
    dateOfRelieving,
    relievingReason,
    reportingOfficer,
    isHrmsSynced: true,
    hrmsSource: "Pydah HRMS Master",
    profileCompletionPercent: 95,
  };

  // Calculate profile completion percentage based on filled fields
  let totalKeyFields = 10;
  let filledFields = 0;
  if (personalDetails.personalEmail) filledFields++;
  if (personalDetails.mobileNumber) filledFields++;
  if (personalDetails.dob) filledFields++;
  if (personalDetails.gender && personalDetails.gender !== "—") filledFields++;
  if (personalDetails.aadhaarNumber) filledFields++;
  if (personalDetails.panNumber) filledFields++;
  if (personalDetails.currentAddress) filledFields++;
  if (personalDetails.highestQualification && personalDetails.highestQualification !== "—") filledFields++;
  if (personalDetails.dateOfJoining) filledFields++;
  if (achievements.length > 0) filledFields++;
  const computedCompletion = Math.min(100, Math.max(50, Math.round((filledFields / totalKeyFields) * 100)));
  personalDetails.profileCompletionPercent = computedCompletion;

  // 4. Fetch faculty's physical presence dates from HRMS MongoDB
  const empIdentifiers = [base.staff.hrmsEmployeeId, base.staff.code].filter(Boolean);
  const presentDatesSet = new Set<string>();
  if (hrmsDb && empIdentifiers.length > 0) {
    const hrmsDailies = await hrmsDb
      .collection("attendancedailies")
      .find({
        $or: [
          { employeeNumber: { $in: empIdentifiers } },
          { emp_no: { $in: empIdentifiers } },
        ],
      })
      .project({ date: 1, status: 1, shifts: 1 })
      .toArray()
      .catch(() => []);

    for (const d of hrmsDailies) {
      const dStr = typeof d.date === "string" ? d.date.split("T")[0] : (d.date instanceof Date ? formatISTDateLocal(d.date) : "");
      const st = String(d.status || "").toUpperCase();
      if (st === "PRESENT" || st === "P" || d.shifts?.[0]?.inTime) {
        if (dStr) presentDatesSet.add(dStr);
      }
    }
  }

  // Index faculty sessions by plan_id + subject_code
  const sessionsByCourse = new Map<string, any[]>();
  for (const s of (facultySessionRows || [])) {
    const key = `${s.plan_id}_${s.subject_code}`;
    if (!sessionsByCourse.has(key)) sessionsByCourse.set(key, []);
    sessionsByCourse.get(key)!.push(s);
  }

  // Format semester academic history with accurate semester duration target, faculty presence & differences
  const semesterAcademicHistory = semesterHistoryRows.map((r) => {
    const key = `${r.plan_id}_${r.subject_code}`;
    const courseSessions = sessionsByCourse.get(key) || [];
    const scheduled = courseSessions.length;
    const taken = courseSessions.filter((s) => s.post_id != null).length;
    const pending = courseSessions.filter((s) => s.post_id == null).length;
    const present = courseSessions.filter((s) => presentDatesSet.has(String(s.session_date))).length;
    const substituted = courseSessions.filter((s) => s.sub_id != null || (s.posted_by_staff_link_id && s.posted_by_staff_link_id !== staffLinkId)).length;

    const start = r.sem_start_date ? new Date(r.sem_start_date) : null;
    const end = r.sem_end_date ? new Date(r.sem_end_date) : null;
    let weeks = 16;
    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
      weeks = Math.max(10, Math.min(24, Math.round(diffDays / 7)));
    }

    const periodsAllotted = Number(r.periods_allotted || 0);
    const totalSemesterSlots = periodsAllotted * weeks;
    const remainingSlots = Math.max(0, totalSemesterSlots - taken);
    const presenceVariance = Math.max(0, present - taken);
    const completionPercent = totalSemesterSlots > 0
      ? Math.min(100, Math.round((taken / totalSemesterSlots) * 100))
      : (scheduled > 0 ? Math.round((taken / scheduled) * 100) : 0);
    const compliancePercent = scheduled > 0
      ? Math.min(100, Math.round((taken / scheduled) * 100))
      : 100;

    const semDuration = start && end
      ? `${formatISTDateLocal(start)} to ${formatISTDateLocal(end)} (${weeks} wks)`
      : `${weeks} Wks Target`;

    return {
      academicYear: String(r.academic_year_label || "2026-2027"),
      semester: Number(r.semester_number || 1),
      batch: String(r.batch || "2026"),
      sectionName: String(r.section_name || "A"),
      subjectCode: String(r.subject_code || "—"),
      subjectName: String(r.subject_name || "Subject"),
      subjectType: String(r.subject_type || "theory"),
      periodsAllotted,
      totalSemesterSlots,
      semesterWeeks: weeks,
      semDuration,
      semStartDate: start ? formatISTDateLocal(start) : null,
      semEndDate: end ? formatISTDateLocal(end) : null,
      classesScheduled: scheduled,
      classesPresent: present,
      classesTaken: taken,
      classesPending: pending,
      classesSubstituted: substituted,
      remainingSlots,
      presenceVariance,
      completionPercent,
      compliancePercent,
    };
  });

  // Format feedback data
  const studentFeedbackHistory = feedbackRows.map((fb) => ({
    academicYear: String(fb.academic_year || ""),
    semester: Number(fb.semester || 1),
    branchName: String(fb.branch_name || ""),
    sectionName: String(fb.section_name || ""),
    subjectName: String(fb.subject_name || ""),
    facultyName: String(fb.faculty_name || ""),
    feedbackCount: Number(fb.total_feedback_count || 0),
    avgRating: Number(fb.avg_rating || 0),
    feedbackSummary: Number(fb.avg_rating || 0) >= 4.5 ? "Outstanding" : Number(fb.avg_rating || 0) >= 4.0 ? "Very Good" : Number(fb.avg_rating || 0) >= 3.0 ? "Good" : "Needs Improvement",
  }));

  // Format semester-wise roles
  const semesterRoles = roleRows.map((r) => ({
    id: Number(r.id),
    academicYear: String(r.academic_year || ""),
    semester: String(r.semester || ""),
    roleName: String(r.role_name || ""),
    department: String(r.department || base.staff.department),
    college: String(r.college || base.staff.college),
    assignedBy: r.assigned_by ? String(r.assigned_by) : "Principal",
    startDate: r.start_date ? String(r.start_date).split("T")[0] : null,
    endDate: r.end_date ? String(r.end_date).split("T")[0] : null,
    responsibilities: r.responsibilities ? String(r.responsibilities) : null,
    status: String(r.status || "active"),
    supportingDocUrl: r.supporting_doc_url ? String(r.supporting_doc_url) : null,
  }));

  // Format career history
  const careerHistory = careerRows.map((r) => ({
    id: Number(r.id),
    eventType: String(r.event_type || "joining"),
    eventDate: String(r.event_date || "").split("T")[0],
    designation: String(r.designation || ""),
    department: String(r.department || ""),
    college: String(r.college || ""),
    remarks: r.remarks ? String(r.remarks) : null,
    orderCopyUrl: r.order_copy_url ? String(r.order_copy_url) : null,
  }));

  // Format staff documents
  const documents = docRows.map((d) => ({
    id: Number(d.id),
    documentType: String(d.document_type || "other"),
    title: String(d.title || "Document"),
    fileUrl: String(d.file_url || ""),
    fileName: String(d.file_name || ""),
    fileSize: Number(d.file_size || 0),
    fileType: String(d.file_type || "application/pdf"),
    isVerified: Boolean(d.is_verified),
    verifiedBy: d.verified_by ? String(d.verified_by) : null,
    verifiedAt: d.verified_at ? String(d.verified_at) : null,
    createdAt: String(d.created_at || ""),
  }));

  // Fetch monthly calendar drilldown for the selected date's month
  const targetMonth = (options?.date || new Date().toISOString().split("T")[0]).slice(0, 7);
  const monthlyCalendar = await getStaffMonthlyCalendar(identifier, targetMonth, options?.collegeNames).catch(() => null);

  // Fetch full workload timetable matrix matching staff-workload UI
  const workloadTimetable = staffLinkId
    ? await getFacultyWorkloadDetail(String(staffLinkId)).then((w) => w?.timetable ?? null).catch(() => null)
    : null;

  return {
    ...base,
    personalDetails,
    achievements,
    semesterAcademicHistory,
    studentFeedbackHistory,
    semesterRoles,
    careerHistory,
    documents,
    approvalHistory,
    monthlyCalendar,
    workloadTimetable,
  };
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function updateStaffPersonalDetails(
  hrmsEmployeeId: string,
  input: StaffPersonalDetailsInput,
  actorUserId?: number,
) {
  const fields = [
    "dob",
    "gender",
    "blood_group",
    "marital_status",
    "nationality",
    "aadhaar_number",
    "pan_number",
    "uan_number",
    "pf_number",
    "personal_email",
    "official_email",
    "mobile_number",
    "emergency_contact_name",
    "emergency_contact_phone",
    "current_address",
    "permanent_address",
    "city",
    "district",
    "state",
    "pincode",
    "highest_qualification",
    "specialization",
    "total_experience_years",
    "employment_status",
    "date_of_joining",
    "probation_end_date",
    "confirmation_date",
    "date_of_relieving",
    "relieving_reason",
  ] as const;

  const sets: string[] = [];
  const vals: any[] = [];

  for (const f of fields) {
    if (f in input) {
      sets.push(`${f} = ?`);
      vals.push(input[f] ?? null);
    }
  }

  if (sets.length === 0) return;

  // Insert or update
  const insertCols = ["hrms_employee_id", ...fields.filter((f) => f in input)];
  const insertPlaceholders = insertCols.map(() => "?").join(", ");
  const insertVals = [hrmsEmployeeId, ...fields.filter((f) => f in input).map((f) => input[f] ?? null)];

  const sql = `
    INSERT INTO ap_staff_personal_details (${insertCols.join(", ")})
    VALUES (${insertPlaceholders})
    ON DUPLICATE KEY UPDATE ${sets.join(", ")}
  `;

  await executeAcademic(sql, [...insertVals, ...vals]);
}

export async function getStaffAchievements(identifier: string) {
  let canonicalHrmsId = identifier.trim();
  const base = await getStaffMemberDetail({ identifier: canonicalHrmsId }).catch(() => null);
  if (base?.staff?.hrmsEmployeeId) {
    canonicalHrmsId = base.staff.hrmsEmployeeId;
  }

  const achievementRows = await queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT a.*, 
       CONCAT('[', 
         COALESCE(
           GROUP_CONCAT(
             JSON_OBJECT(
               'id', d.id, 
               'fileName', d.file_name, 
               'fileUrl', d.file_url, 
               'fileSize', d.file_size, 
               'fileType', d.file_type
             )
           ), ''
         ), 
       ']') AS documents_json
     FROM ap_staff_achievements a
     LEFT JOIN ap_staff_achievement_documents d ON d.achievement_id = a.id
     WHERE a.hrms_employee_id = ? AND a.deleted_at IS NULL
     GROUP BY a.id
     ORDER BY a.publication_date DESC, a.created_at DESC`,
    [canonicalHrmsId],
  ).catch(() => []);

  const achievements = achievementRows.map((row) => {
    let docs = [];
    try {
      docs = typeof row.documents_json === "string" ? JSON.parse(row.documents_json) : [];
      docs = docs.filter((d: any) => d && d.id);
    } catch {
      docs = [];
    }
    return {
      id: Number(row.id),
      category: String(row.category || "Professional Certifications"),
      title: String(row.title || ""),
      description: row.description ? String(row.description) : null,
      publicationName: row.publication_name ? String(row.publication_name) : null,
      issuingOrganization: row.issuing_organization ? String(row.issuing_organization) : null,
      publicationDate: row.publication_date ? String(row.publication_date).split("T")[0] : null,
      certificateNumberOrDoi: row.certificate_number_or_doi ? String(row.certificate_number_or_doi) : null,
      academicYear: row.academic_year ? String(row.academic_year) : null,
      semester: row.semester ? String(row.semester) : null,
      achievementUrl: row.achievement_url ? String(row.achievement_url) : null,
      status: String(row.status || "draft"),
      hodRemarks: row.hod_remarks ? String(row.hod_remarks) : null,
      principalRemarks: row.principal_remarks ? String(row.principal_remarks) : null,
      rejectionRemarks: row.rejection_remarks ? String(row.rejection_remarks) : null,
      createdAt: String(row.created_at || ""),
      documents: docs,
    };
  });

  const achievementIds = achievements.map((a) => a.id);
  let approvalHistory: any[] = [];
  if (achievementIds.length > 0) {
    const approvalRows = await queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT h.*, a.title as achievement_title, a.category as achievement_category
       FROM ap_staff_achievement_approvals h
       JOIN ap_staff_achievements a ON a.id = h.achievement_id
       WHERE h.achievement_id IN (${achievementIds.join(",")})
       ORDER BY h.created_at DESC`,
    ).catch(() => []);

    approvalHistory = approvalRows.map((r) => ({
      id: Number(r.id),
      achievementId: Number(r.achievement_id),
      achievementTitle: String(r.achievement_title || ""),
      achievementCategory: String(r.achievement_category || ""),
      actorName: String(r.actor_name || "System Admin"),
      actorRole: String(r.actor_role || "staff"),
      action: String(r.action || ""),
      remarks: r.remarks ? String(r.remarks) : null,
      createdAt: String(r.created_at || ""),
    }));
  }

  return {
    staff: base?.staff ?? {
      hrmsEmployeeId: canonicalHrmsId,
      staffLinkId: null,
      name: base?.staff?.name || "Staff Member",
      code: canonicalHrmsId,
      department: base?.staff?.department || "—",
      designation: base?.staff?.designation || "Faculty",
      college: base?.staff?.college || "—",
      profilePhoto: base?.staff?.profilePhoto ?? null,
    },
    achievements,
    approvalHistory,
  };
}

export async function createStaffAchievement(
  identifier: string,
  input: StaffAchievementInput,
  actorUserId?: number,
  actorName?: string,
) {
  let canonicalHrmsId = identifier.trim();
  const base = await getStaffMemberDetail({ identifier: canonicalHrmsId }).catch(() => null);
  if (base?.staff?.hrmsEmployeeId) {
    canonicalHrmsId = base.staff.hrmsEmployeeId;
  }

  const status = input.status || "submitted";
  const initialStatus = status === "draft" ? "draft" : "pending_hod_approval";

  const res = (await executeAcademic(
    `INSERT INTO ap_staff_achievements 
     (hrms_employee_id, category, title, description, publication_name, issuing_organization, publication_date, certificate_number_or_doi, academic_year, semester, achievement_url, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      canonicalHrmsId,
      input.category,
      input.title,
      input.description || null,
      input.publication_name || null,
      input.issuing_organization || null,
      input.publication_date || null,
      input.certificate_number_or_doi || null,
      input.academic_year || null,
      input.semester || null,
      input.achievement_url || null,
      initialStatus,
      actorUserId || null,
    ],
  )) as ResultSetHeader;

  const achievementId = Number(res.insertId);

  // Attach documents if provided
  if (input.documents && input.documents.length > 0) {
    for (const doc of input.documents) {
      await executeAcademic(
        `INSERT INTO ap_staff_achievement_documents 
         (achievement_id, file_name, file_url, file_size, file_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          achievementId,
          doc.fileName,
          doc.fileUrl,
          doc.fileSize || 0,
          doc.fileType || "application/pdf",
          actorUserId || null,
        ],
      );
    }
  }

  // Record initial audit step
  await executeAcademic(
    `INSERT INTO ap_staff_achievement_approvals 
     (achievement_id, actor_user_id, actor_name, actor_role, action, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      achievementId,
      actorUserId || null,
      actorName || "Staff Member",
      "staff",
      initialStatus === "draft" ? "draft_saved" : "submitted",
      "Achievement submitted for HOD review",
    ],
  );

  return achievementId;
}

export async function reviewStaffAchievement(
  achievementId: number,
  input: { action: "hod_approve" | "hod_reject" | "principal_approve" | "principal_reject"; remarks?: string },
  actorUserId: number,
  actorName: string,
  actorRole: "hod" | "principal",
) {
  let newStatus = "pending_hod_approval";
  let actionLog = "hod_approved";

  if (input.action === "hod_approve") {
    newStatus = "pending_principal_approval";
    actionLog = "hod_approved";
    await executeAcademic(
      `UPDATE ap_staff_achievements 
       SET status = ?, hod_reviewed_by = ?, hod_reviewed_at = NOW(), hod_remarks = ?
       WHERE id = ?`,
      [newStatus, actorUserId, input.remarks || "Recommended to Principal", achievementId],
    );
  } else if (input.action === "hod_reject") {
    newStatus = "rejected";
    actionLog = "hod_rejected";
    await executeAcademic(
      `UPDATE ap_staff_achievements 
       SET status = ?, hod_reviewed_by = ?, hod_reviewed_at = NOW(), rejection_remarks = ?
       WHERE id = ?`,
      [newStatus, actorUserId, input.remarks || "Rejected by HOD", achievementId],
    );
  } else if (input.action === "principal_approve") {
    newStatus = "approved";
    actionLog = "principal_approved";
    await executeAcademic(
      `UPDATE ap_staff_achievements 
       SET status = ?, principal_approved_by = ?, principal_approved_at = NOW(), principal_remarks = ?
       WHERE id = ?`,
      [newStatus, actorUserId, input.remarks || "Approved by Principal", achievementId],
    );
  } else if (input.action === "principal_reject") {
    newStatus = "rejected";
    actionLog = "principal_rejected";
    await executeAcademic(
      `UPDATE ap_staff_achievements 
       SET status = ?, principal_approved_by = ?, principal_approved_at = NOW(), rejection_remarks = ?
       WHERE id = ?`,
      [newStatus, actorUserId, input.remarks || "Rejected by Principal", achievementId],
    );
  }

  // Audit log
  await executeAcademic(
    `INSERT INTO ap_staff_achievement_approvals 
     (achievement_id, actor_user_id, actor_name, actor_role, action, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      achievementId,
      actorUserId,
      actorName,
      actorRole,
      actionLog,
      input.remarks || (newStatus === "approved" ? "Approved" : "Rejected"),
    ],
  );
}

export async function deleteStaffAchievement(achievementId: number, actorUserId?: number) {
  await executeAcademic(
    `UPDATE ap_staff_achievements SET deleted_at = NOW(), updated_by = ? WHERE id = ?`,
    [actorUserId || null, achievementId],
  );
}

export async function createStaffSemesterRole(
  hrmsEmployeeId: string,
  input: StaffSemesterRoleInput,
  actorUserId?: number,
) {
  const res = (await executeAcademic(
    `INSERT INTO ap_staff_semester_roles 
     (hrms_employee_id, academic_year, semester, role_name, department, college, assigned_by, start_date, end_date, responsibilities, status, supporting_doc_url, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hrmsEmployeeId,
      input.academic_year,
      input.semester,
      input.role_name,
      input.department || null,
      input.college || null,
      input.assigned_by || "Principal",
      input.start_date || null,
      input.end_date || null,
      input.responsibilities || null,
      input.status || "active",
      input.supporting_doc_url || null,
      actorUserId || null,
    ],
  )) as ResultSetHeader;

  return Number(res.insertId);
}

export async function deleteStaffSemesterRole(roleId: number) {
  await executeAcademic(`DELETE FROM ap_staff_semester_roles WHERE id = ?`, [roleId]);
}

export async function uploadStaffDocument(
  hrmsEmployeeId: string,
  input: StaffDocumentInput,
  actorUserId?: number,
) {
  const res = (await executeAcademic(
    `INSERT INTO ap_staff_documents 
     (hrms_employee_id, document_type, title, file_url, file_name, file_size, file_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hrmsEmployeeId,
      input.document_type,
      input.title,
      input.file_url,
      input.file_name,
      input.file_size || 0,
      input.file_type || "application/pdf",
      actorUserId || null,
    ],
  )) as ResultSetHeader;

  return Number(res.insertId);
}

export async function verifyStaffDocument(
  docId: number,
  verifiedBy: string,
  actorUserId?: number,
) {
  await executeAcademic(
    `UPDATE ap_staff_documents 
     SET is_verified = TRUE, verified_by = ?, verified_at = NOW() 
     WHERE id = ?`,
    [verifiedBy, docId],
  );
}

export async function deleteStaffDocument(docId: number) {
  await executeAcademic(`DELETE FROM ap_staff_documents WHERE id = ?`, [docId]);
}

// ─── Monthly Attendance & Teaching Calendar Drilldown ────────────────────────

export type StaffCalendarDaySlot = {
  slotLabel: string;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
  subjectCode: string | null;
  sectionName: string | null;
  roomLabel?: string | null;
  entryType?: string;
  isPosted: boolean;
  status: string;
  postedAt?: string | null;
  isSubstituted?: boolean;
  substitutionType?: "self" | "taken_by_substitute" | "covered_as_substitute" | "assigned_substitute";
  postedByName?: string | null;
  postedByCode?: string | null;
  allottedFacultyName?: string | null;
  allottedFacultyCode?: string | null;
  substitutionRemark?: string | null;
};

export type StaffCalendarDay = {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  isWeekend: boolean;
  isFuture: boolean;
  attendance: {
    status: string;
    displayStatus: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    punchCount: number;
    lateMinutes: number;
    leaveReason?: string | null;
    punches?: Array<{ time: string; device?: string | null }>;
    leaveDetails?: {
      leaveType?: string | null;
      purpose?: string | null;
      reason?: string | null;
      status?: string | null;
    } | null;
    odDetails?: {
      odType?: string | null;
      placeVisited?: string | null;
      purpose?: string | null;
      remarks?: string | null;
    } | null;
    permissionDetails?: {
      hours?: number | null;
      reason?: string | null;
    } | null;
  };
  teaching: {
    allocatedCount: number;
    postedCount: number;
    pendingCount: number;
    slots: StaffCalendarDaySlot[];
  };
};

export type StaffMonthlyCalendarResponse = {
  month: string;
  staff: {
    hrmsEmployeeId: string;
    name: string;
    code: string;
    department: string;
    designation: string;
    college: string;
  };
  summary: {
    totalDays: number;
    workingDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    leaveDays: number;
    odDays: number;
    attendancePercent: number;
    totalSlotsAllocated: number;
    totalSlotsPosted: number;
    totalSlotsPending: number;
    postingComplianceRate: number;
  };
  days: StaffCalendarDay[];
  weeklyTimetable: Record<string, any[]>;
};

function formatISTDateLocal(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  const ist = new Date(dateObj.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function formatISTTimeLocal(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return null;
  return dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).toLowerCase();
}

export async function getStaffMonthlyCalendar(
  identifier: string,
  monthStr?: string,
  collegeNames?: string[],
): Promise<StaffMonthlyCalendarResponse | null> {
  const base = await getStaffMemberDetail({
    identifier,
    collegeNames,
  });
  if (!base) return null;

  // Resolve target month (default to current IST month YYYY-MM)
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const currentMonthStr = istNow.toISOString().slice(0, 7);
  const targetMonth = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : currentMonthStr;

  const [yearStr, mStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(mStr, 10) - 1;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-${String(daysInMonth).padStart(2, "0")}`;

  const staffLinkId = base.staff.staffLinkId;
  const hrmsId = base.staff.hrmsEmployeeId;
  const empIdentifiers = [hrmsId, base.staff.code].filter(Boolean);

  // 1. Fetch HRMS Mongo attendance documents for this entire month
  const hrmsDb = await getHrmsDb().catch(() => null);
  let dailyDocs: any[] = [];
  let punchDocs: any[] = [];
  let leaveDocs: any[] = [];
  let odDocs: any[] = [];
  let permDocs: any[] = [];

  const startIso = new Date(`${startDate}T00:00:00+05:30`);
  const endIso = new Date(`${endDate}T23:59:59.999+05:30`);
  const paddedStart = new Date(startIso.getTime() - 24 * 3600 * 1000);
  const paddedEnd = new Date(endIso.getTime() + 24 * 3600 * 1000);

  if (hrmsDb) {
    [dailyDocs, punchDocs, leaveDocs, odDocs, permDocs] = await Promise.all([
      hrmsDb
        .collection("attendancedailies")
        .find({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              $or: [
                { date: { $gte: startDate, $lte: endDate } },
                { date: { $gte: paddedStart, $lte: paddedEnd } },
              ],
            },
          ],
        })
        .toArray()
        .catch(() => []),

      hrmsDb
        .collection("attendancerawlogs")
        .find({
          $and: [
            {
              $or: [
                { employeeNumber: { $in: empIdentifiers } },
                { emp_no: { $in: empIdentifiers } },
              ],
            },
            {
              $or: [
                { date: { $gte: startDate, $lte: endDate } },
                { timestamp: { $gte: paddedStart, $lte: paddedEnd } },
              ],
            },
          ],
        })
        .toArray()
        .catch(() => []),

      hrmsDb
        .collection("leaves")
        .find({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              status: { $nin: ["rejected", "cancelled"] },
            },
            {
              $or: [
                { fromDate: { $lte: endDate }, toDate: { $gte: startDate } },
                { fromDate: { $lte: paddedEnd }, toDate: { $gte: paddedStart } },
              ],
            },
          ],
        })
        .toArray()
        .catch(() => []),

      hrmsDb
        .collection("ods")
        .find({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              status: { $nin: ["rejected", "cancelled"] },
            },
            {
              $or: [
                { fromDate: { $lte: endDate }, toDate: { $gte: startDate } },
                { fromDate: { $lte: paddedEnd }, toDate: { $gte: paddedStart } },
              ],
            },
          ],
        })
        .toArray()
        .catch(() => []),

      hrmsDb
        .collection("permissions")
        .find({
          $and: [
            {
              $or: [
                { emp_no: { $in: empIdentifiers } },
                { employeeNumber: { $in: empIdentifiers } },
              ],
            },
            {
              status: { $nin: ["rejected", "cancelled"] },
            },
            {
              $or: [
                { date: { $gte: paddedStart, $lte: paddedEnd } },
                { date: { $gte: startDate, $lte: endDate } },
                { permissionDate: { $gte: paddedStart, $lte: paddedEnd } },
              ],
            },
          ],
        })
        .toArray()
        .catch(() => []),
    ]);
  }

  // 2. Fetch MySQL class sessions and published master timetable entries
  const [monthSessions, weeklyMasterEntries] = await Promise.all([
    staffLinkId
      ? queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
          `SELECT 
             cs.id,
             cs.plan_id,
             DATE_FORMAT(cs.session_date, '%Y-%m-%d') as session_date,
             cs.start_time,
             cs.end_time,
             cs.subject_name,
             cs.subject_code,
             cs.section_name,
             cs.status,
             cs.faculty_staff_link_id,
             sl_allotted.display_name as allotted_faculty_name,
             sl_allotted.employee_code as allotted_faculty_code,
             ts.label as slot_label,
             ts.slot_order,
             ap.id as post_id,
             ap.posted_at,
             ap.posted_by_staff_link_id,
             sl_posted.display_name as posted_by_name,
             sl_posted.employee_code as posted_by_code,
             sub.replacement_faculty_staff_link_id as sub_replacement_id,
             sl_sub_rep.display_name as sub_replacement_name,
             sub.original_faculty_staff_link_id as sub_original_id,
             sl_sub_orig.display_name as sub_original_name
           FROM ap_class_sessions cs
           LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(cs.timing_slot_id, cs.period_slot_id)
           LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
           LEFT JOIN ap_staff_link sl_allotted ON sl_allotted.id = cs.faculty_staff_link_id
           LEFT JOIN ap_staff_link sl_posted ON sl_posted.id = ap.posted_by_staff_link_id
           LEFT JOIN ap_class_session_substitutions sub ON sub.class_session_id = cs.id AND sub.status = 'active'
           LEFT JOIN ap_staff_link sl_sub_rep ON sl_sub_rep.id = sub.replacement_faculty_staff_link_id
           LEFT JOIN ap_staff_link sl_sub_orig ON sl_sub_orig.id = sub.original_faculty_staff_link_id
           WHERE (cs.faculty_staff_link_id = ? OR ap.posted_by_staff_link_id = ?) 
             AND cs.session_date BETWEEN ? AND ? 
             AND cs.status != 'cancelled'
           ORDER BY cs.session_date ASC, COALESCE(ts.slot_order, 99), cs.start_time ASC, (ap.id IS NOT NULL) DESC`,
          [staffLinkId, staffLinkId, startDate, endDate],
        ).catch(() => [])
      : Promise.resolve([]),

    staffLinkId
      ? queryAcademic<(RowDataPacket & Record<string, unknown>)[]>(
          `SELECT 
             te.id,
             te.day_of_week,
             te.subject_name,
             te.subject_code,
             COALESCE(te.entry_type, 'theory') as entry_type,
             te.room_label,
             p.section_name,
             ts.label as slot_label,
             ts.start_time,
             ts.end_time,
             ts.slot_order
           FROM ap_timetable_entries te
           JOIN ap_timetable_plans p ON p.id = te.plan_id AND p.status = 'published'
           LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
           WHERE te.faculty_staff_link_id = ?
           ORDER BY FIELD(te.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'), COALESCE(ts.slot_order, 99), ts.start_time ASC`,
          [staffLinkId],
        ).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Index sessions by YYYY-MM-DD
  const sessionsByDate = new Map<string, any[]>();
  for (const s of monthSessions) {
    const d = String(s.session_date);
    if (!sessionsByDate.has(d)) sessionsByDate.set(d, []);
    sessionsByDate.get(d)!.push(s);
  }

  // Index master timetable entries by day of week ("MON", "TUE", ...)
  const masterByDay = new Map<string, any[]>();
  for (const m of weeklyMasterEntries) {
    const dow = String(m.day_of_week).toUpperCase();
    if (!masterByDay.has(dow)) masterByDay.set(dow, []);
    masterByDay.get(dow)!.push(m);
  }

  // Index daily attendance docs by YYYY-MM-DD
  const dailyDocByDate = new Map<string, any>();
  for (const doc of dailyDocs) {
    let dStr = "";
    if (typeof doc.date === "string") {
      dStr = doc.date.split("T")[0];
    } else if (doc.date instanceof Date) {
      dStr = formatISTDateLocal(doc.date) || "";
    }
    if (dStr) dailyDocByDate.set(dStr, doc);
  }

  // Index punches by date
  const punchesByDate = new Map<string, any[]>();
  for (const p of punchDocs) {
    const ts = p.timestamp || p.time;
    let d = "";
    if (ts) {
      d = formatISTDateLocal(ts) || "";
    } else if (p.date && typeof p.date === "string") {
      d = p.date.split("T")[0];
    }
    if (d) {
      if (!punchesByDate.has(d)) punchesByDate.set(d, []);
      punchesByDate.get(d)!.push({
        time: formatISTTimeLocal(ts) || "—",
        device: p.deviceName || p.device || p.rawData?.deviceName || "Biometric ADMS",
      });
    }
  }

  const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const todayStr = istNow.toISOString().split("T")[0];

  const days: StaffCalendarDay[] = [];
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let odDays = 0;
  let workingDays = 0;
  let totalSlotsAllocated = 0;
  let totalSlotsPosted = 0;
  let totalSlotsPending = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, monthIndex, d);
    const dayStr = `${targetMonth}-${String(d).padStart(2, "0")}`;
    const dayCode = DAY_CODES[dayDate.getDay()];
    const isWeekend = dayCode === "SUN";
    const isFuture = dayStr > todayStr;

    // 1. Resolve attendance status
    const dailyDoc = dailyDocByDate.get(dayStr);
    const punches = punchesByDate.get(dayStr) || [];

    // Find matching leave for this day (converted cleanly to IST date)
    const matchingLeave = leaveDocs.find((l: any) => {
      const f = formatISTDateLocal(l.fromDate);
      const t = formatISTDateLocal(l.toDate);
      return f && t && dayStr >= f && dayStr <= t;
    });

    // Find matching OD for this day (converted cleanly to IST date)
    const matchingOd = odDocs.find((o: any) => {
      const f = formatISTDateLocal(o.fromDate);
      const t = formatISTDateLocal(o.toDate);
      return f && t && dayStr >= f && dayStr <= t;
    });

    // Find matching permission (converted cleanly to IST date)
    const matchingPerm = permDocs.find((p: any) => {
      const d = formatISTDateLocal(p.date || p.permissionDate || p.createdAt);
      return d && d === dayStr;
    });

    let status = isWeekend ? "weekend" : "absent";
    let displayStatus = isWeekend ? "Sunday" : "Absent";
    let checkInTime: string | null = null;
    let checkOutTime: string | null = null;
    let lateMinutes = 0;
    let leaveReason: string | null = null;
    let leaveDetails: any = null;
    let odDetails: any = null;
    let permissionDetails: any = null;

    if (dailyDoc?.shifts?.[0]?.inTime) checkInTime = formatISTTimeLocal(dailyDoc.shifts[0].inTime);
    if (dailyDoc?.shifts?.[0]?.outTime) checkOutTime = formatISTTimeLocal(dailyDoc.shifts[0].outTime);
    if (!checkInTime && punches.length > 0) checkInTime = punches[0].time;
    if (!checkOutTime && punches.length > 1) checkOutTime = punches[punches.length - 1].time;
    lateMinutes = Number(dailyDoc?.shifts?.[0]?.lateInMinutes || dailyDoc?.totalLateInMinutes || 0);

    const rawDailyStatus = String(dailyDoc?.status || "").toUpperCase();
    const isPhysicallyPresent = (
      rawDailyStatus === "PRESENT" ||
      rawDailyStatus === "P" ||
      Boolean(checkInTime) ||
      punches.length > 0
    );

    if (isPhysicallyPresent) {
      if (lateMinutes > 0) {
        status = "late";
        displayStatus = `Late (${lateMinutes}m)`;
        lateDays++;
      } else {
        status = "present";
        displayStatus = "Present";
        presentDays++;
      }
    } else if (matchingLeave || rawDailyStatus === "LEAVE" || rawDailyStatus.includes("LEAVE") || dailyDoc?.leaveType) {
      status = "leave";
      const lType = String(matchingLeave?.leaveType || dailyDoc?.leaveType || "CL").toUpperCase();
      displayStatus = `Leave (${lType})`;
      leaveReason = matchingLeave?.purpose || matchingLeave?.reason || matchingLeave?.remarks || dailyDoc?.leaveReason || "Approved leave";
      leaveDetails = {
        leaveType: lType,
        purpose: matchingLeave?.purpose || null,
        reason: matchingLeave?.reason || matchingLeave?.remarks || dailyDoc?.leaveReason || null,
        status: matchingLeave?.status || "approved",
      };
      leaveDays++;
    } else if (matchingOd || rawDailyStatus === "OD" || Number(dailyDoc?.odHours || 0) > 0) {
      status = "od";
      const odType = matchingOd?.odType || "On Duty";
      displayStatus = `OD (${odType})`;
      leaveReason = matchingOd?.placeVisited ? `OD: ${matchingOd.placeVisited}` : (matchingOd?.purpose || "Official Duty");
      odDetails = {
        odType,
        placeVisited: matchingOd?.placeVisited || null,
        purpose: matchingOd?.purpose || null,
        remarks: matchingOd?.remarks || null,
      };
      odDays++;
    } else if (matchingPerm || rawDailyStatus === "PERMISSION" || Number(dailyDoc?.permissionHours || 0) > 0) {
      status = "permission";
      displayStatus = "Permission";
      leaveReason = `${matchingPerm?.hours || dailyDoc?.permissionHours || 1} hr permission: ${matchingPerm?.reason || "Approved"}`;
      permissionDetails = {
        hours: matchingPerm?.hours || dailyDoc?.permissionHours || 1,
        reason: matchingPerm?.reason || null,
      };
    } else if (rawDailyStatus === "WEEK_OFF" || rawDailyStatus === "WO" || isWeekend) {
      status = "weekend";
      displayStatus = isWeekend ? "Sunday" : "Week Off";
    } else if (rawDailyStatus === "HOLIDAY" || rawDailyStatus === "HDL") {
      status = "weekend";
      displayStatus = "Holiday";
    } else if (rawDailyStatus === "PARTIAL") {
      status = "late";
      displayStatus = "Partial";
      lateDays++;
    } else if (!isWeekend && !isFuture) {
      status = "absent";
      displayStatus = "Absent";
      absentDays++;
    } else if (isFuture && !isWeekend) {
      status = "scheduled";
      displayStatus = "Scheduled";
    }

    if (!isWeekend) workingDays++;

    // 2. Resolve teaching slots allocated & posted with deduplication
    const rawSessions = sessionsByDate.get(dayStr) || [];
    const dedupMap = new Map<string, any>();
    for (const s of rawSessions) {
      const key = `${s.slot_label || s.start_time}_${s.subject_code || ""}_${s.section_name || ""}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, s);
      } else {
        const existing = dedupMap.get(key);
        // Prioritize posted session over pending/scheduled ghost session
        if (s.post_id && !existing.post_id) {
          dedupMap.set(key, s);
        }
      }
    }
    const dateSessions = Array.from(dedupMap.values());
    const masterSlots = masterByDay.get(dayCode) || [];

    let daySlots: StaffCalendarDaySlot[] = [];

    if (dateSessions.length > 0) {
      daySlots = dateSessions.map((s, idx) => {
        const isPosted = Boolean(s.post_id);
        let isSubstituted = false;
        let substitutionType: "self" | "taken_by_substitute" | "covered_as_substitute" | "assigned_substitute" = "self";
        let substitutionRemark: string | null = null;

        const isAllottedToThisFaculty = s.faculty_staff_link_id === staffLinkId;
        const isPostedByThisFaculty = s.posted_by_staff_link_id === staffLinkId;

        if (isAllottedToThisFaculty) {
          if (s.posted_by_staff_link_id && s.posted_by_staff_link_id !== staffLinkId) {
            isSubstituted = true;
            substitutionType = "taken_by_substitute";
            substitutionRemark = `Taken by substitute: ${s.posted_by_name || "Substitute Faculty"}`;
          } else if (!isPosted && s.sub_replacement_id && s.sub_replacement_id !== staffLinkId) {
            isSubstituted = true;
            substitutionType = "assigned_substitute";
            substitutionRemark = `Substitute assigned: ${s.sub_replacement_name || "Substitute Faculty"}`;
          } else if (isPosted) {
            substitutionType = "self";
            substitutionRemark = "Posted by Self";
          }
        } else if (isPostedByThisFaculty) {
          isSubstituted = true;
          substitutionType = "covered_as_substitute";
          substitutionRemark = `Covered as substitute for ${s.allotted_faculty_name || "Faculty"}`;
        }

        return {
          slotLabel: s.slot_label || `P${idx + 1}`,
          startTime: s.start_time,
          endTime: s.end_time,
          subjectName: s.subject_name || "Unassigned",
          subjectCode: s.subject_code,
          sectionName: s.section_name,
          isPosted,
          status: s.status || (isPosted ? "posted" : "pending"),
          postedAt: s.posted_at ? String(s.posted_at) : null,
          isSubstituted,
          substitutionType,
          postedByName: s.posted_by_name || s.sub_replacement_name || null,
          postedByCode: s.posted_by_code || null,
          allottedFacultyName: s.allotted_faculty_name || s.sub_original_name || null,
          allottedFacultyCode: s.allotted_faculty_code || null,
          substitutionRemark,
        };
      });
    } else if (!isWeekend && masterSlots.length > 0) {
      daySlots = masterSlots.map((m, idx) => ({
        slotLabel: m.slot_label || `P${idx + 1}`,
        startTime: m.start_time,
        endTime: m.end_time,
        subjectName: m.subject_name || "Unassigned",
        subjectCode: m.subject_code,
        sectionName: m.section_name,
        roomLabel: m.room_label,
        entryType: m.entry_type,
        isPosted: false,
        status: isFuture ? "scheduled" : "pending",
        isSubstituted: false,
        substitutionType: "self" as const,
      }));
    }

    const allocatedCount = daySlots.length;
    const postedCount = daySlots.filter((s) => s.isPosted).length;
    const pendingCount = allocatedCount - postedCount;

    // Only classes physically conducted by this faculty count for presence verification
    const selfPostedCount = daySlots.filter((s) => s.isPosted && s.substitutionType !== "taken_by_substitute").length;
    if (selfPostedCount > 0 && (status === "absent" || status === "scheduled")) {
      status = "present";
      displayStatus = "Present";
      presentDays++;
      if (absentDays > 0) absentDays--;
    }

    if (!isFuture && !isWeekend) {
      totalSlotsAllocated += allocatedCount;
      totalSlotsPosted += postedCount;
      totalSlotsPending += pendingCount;
    }

    days.push({
      date: dayStr,
      dayNumber: d,
      dayOfWeek: dayCode,
      isWeekend,
      isFuture,
      attendance: {
        status,
        displayStatus,
        checkInTime,
        checkOutTime,
        punchCount: punches.length,
        lateMinutes,
        leaveReason,
        punches,
        leaveDetails,
        odDetails,
        permissionDetails,
      },
      teaching: {
        allocatedCount,
        postedCount,
        pendingCount,
        slots: daySlots,
      },
    });
  }

  const attendancePercent = workingDays > 0 ? Math.min(100, Math.round(((presentDays + lateDays) / workingDays) * 100)) : 100;
  const postingComplianceRate = totalSlotsAllocated > 0 ? Math.min(100, Math.round((totalSlotsPosted / totalSlotsAllocated) * 100)) : 100;

  return {
    month: targetMonth,
    staff: {
      hrmsEmployeeId: base.staff.hrmsEmployeeId,
      name: base.staff.name,
      code: base.staff.code,
      department: base.staff.department,
      designation: base.staff.designation,
      college: base.staff.college,
    },
    summary: {
      totalDays: daysInMonth,
      workingDays,
      presentDays,
      lateDays,
      absentDays,
      leaveDays,
      odDays,
      attendancePercent,
      totalSlotsAllocated,
      totalSlotsPosted,
      totalSlotsPending,
      postingComplianceRate,
    },
    days,
    weeklyTimetable: base.weeklyTimetable,
  };
}

