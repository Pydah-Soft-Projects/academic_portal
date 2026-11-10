import type { FacultyTimetable } from "@/features/workload/WorkloadTimetableGrid";

export type StaffSlotDetail = {
  id?: number;
  timingSlotId?: number;
  slotLabel: string;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
  subjectCode: string | null;
  sectionName: string | null;
  status: string;
  isPosted: boolean;
  roomLabel?: string | null;
};

export type StaffAttendanceStatus = {
  status: "present" | "late" | "leave" | "od" | "permission" | "absent";
  displayStatus: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
  thumbStatus: "active" | "partial" | "full" | "none";
  punchCount: number;
  details: string | null;
  leaveType?: string | null;
  leaveReason?: string | null;
  odPlace?: string | null;
};

export type StaffOverviewItem = {
  hrmsEmployeeId: string;
  staffLinkId: number | null;
  name: string;
  code: string;
  division: string;
  department: string;
  designation: string;
  college: string;
  employeeGroup: string;
  isActive: boolean;
  linkStatus: "linked" | "unlinked";
  profilePhoto?: string | null;
  teachingSubjects: string[];
  todaySlotsCount: number;
  todayPostedSlotsCount: number;
  todayPendingSlotsCount: number;
  todaySlots: StaffSlotDetail[];
  todayAttendance: StaffAttendanceStatus;
};

export type StaffOverviewKPIs = {
  totalStaff: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  odCount: number;
  permissionCount: number;
  withSlotsCount: number;
  totalSlotsToday: number;
};

export type StaffPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type StaffFilterOptions = {
  divisions: string[];
  departments: string[];
  designations: string[];
};

export type StaffOverviewResponse = {
  date: string;
  dayOfWeek: string;
  data: StaffOverviewItem[];
  kpis: StaffOverviewKPIs;
  globalKpis?: StaffOverviewKPIs;
  pagination: StaffPagination;
  filterOptions: StaffFilterOptions;
};

export type StaffPunchRecord = {
  time: string;
  timestamp: string;
  device?: string | null;
  direction?: string | null;
};

export type StaffLeaveRecord = {
  leaveType: string;
  fromDate: string;
  toDate: string;
  numberOfDays: number;
  purpose: string | null;
  status: string;
};

export type StaffOdRecord = {
  odType: string;
  fromDate: string;
  toDate: string;
  placeVisited: string | null;
  purpose: string | null;
  status: string;
};

export type StaffPermissionRecord = {
  hours: number;
  reason: string | null;
  status: string;
};

export type StaffAssignedSubject = {
  subjectName: string;
  subjectCode: string | null;
  sectionName?: string | null;
  periodsPerWeek?: number;
  entryType?: string;
};

export type StaffWeeklySlot = {
  id: number;
  slotLabel: string;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
  subjectCode: string | null;
  sectionName: string | null;
  roomLabel?: string | null;
  entryType: string;
};

export type StaffRecentAttendanceItem = {
  date: string;
  dayOfWeek: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
};

export type StaffPersonalDetails = {
  dob?: string | null;
  gender: string;
  bloodGroup: string;
  maritalStatus: string;
  nationality: string;
  aadhaarNumber?: string | null;
  panNumber?: string | null;
  uanNumber?: string | null;
  pfNumber?: string | null;
  personalEmail?: string | null;
  officialEmail?: string | null;
  mobileNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  city: string;
  district: string;
  state: string;
  pincode?: string | null;
  highestQualification: string;
  specialization?: string | null;
  totalExperienceYears: number;
  employmentStatus: string;
  dateOfJoining?: string | null;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
  dateOfRelieving?: string | null;
  relievingReason?: string | null;
  reportingOfficer?: string | null;
  isHrmsSynced?: boolean;
  hrmsSource?: string;
  profileCompletionPercent: number;
};

export type StaffAchievement = {
  id: number;
  category: string;
  title: string;
  description?: string | null;
  publicationName?: string | null;
  issuingOrganization?: string | null;
  publicationDate?: string | null;
  certificateNumberOrDoi?: string | null;
  academicYear?: string | null;
  semester?: string | null;
  achievementUrl?: string | null;
  status: string;
  hodRemarks?: string | null;
  principalRemarks?: string | null;
  rejectionRemarks?: string | null;
  createdAt: string;
  documents: Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
  }>;
};

export type StaffSemesterAcademicHistoryItem = {
  academicYear: string;
  semester: number;
  batch: string;
  sectionName: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  periodsAllotted: number;
  totalSemesterSlots: number;
  semesterWeeks: number;
  semDuration?: string | null;
  semStartDate?: string | null;
  semEndDate?: string | null;
  classesScheduled: number;
  classesPresent: number;
  classesTaken: number;
  classesPending: number;
  classesSubstituted?: number;
  remainingSlots: number;
  presenceVariance: number;
  completionPercent: number;
  compliancePercent: number;
};

export type StaffStudentFeedbackHistoryItem = {
  academicYear: string;
  semester: number;
  branchName: string;
  sectionName: string;
  subjectName: string;
  facultyName: string;
  feedbackCount: number;
  avgRating: number;
  feedbackSummary: string;
};

export type StaffSemesterRole = {
  id: number;
  academicYear: string;
  semester: string;
  roleName: string;
  department: string;
  college: string;
  assignedBy: string;
  startDate?: string | null;
  endDate?: string | null;
  responsibilities?: string | null;
  status: string;
  supportingDocUrl?: string | null;
};

export type StaffCareerHistoryItem = {
  id: number;
  eventType: string;
  eventDate: string;
  designation: string;
  department: string;
  college: string;
  remarks?: string | null;
  orderCopyUrl?: string | null;
};

export type StaffDocumentItem = {
  id: number;
  documentType: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  isVerified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
};

export type StaffApprovalHistoryItem = {
  id: number;
  achievementId: number;
  achievementTitle: string;
  achievementCategory: string;
  actorName: string;
  actorRole: string;
  action: string;
  remarks?: string | null;
  createdAt: string;
};

export type StaffDetailResponse = {
  staff: {
    hrmsEmployeeId: string;
    staffLinkId: number | null;
    name: string;
    code: string;
    division: string;
    department: string;
    designation: string;
    college: string;
    employeeGroup: string;
    isActive: boolean;
    linkStatus: "linked" | "unlinked";
    profilePhoto?: string | null;
    email?: string | null;
    phone?: string | null;
    gender?: string | null;
    dateOfJoining?: string | null;
    qualification?: string | null;
    experience?: string | null;
  };
  date: string;
  dayOfWeek: string;
  attendance: StaffAttendanceStatus & {
    punches: StaffPunchRecord[];
    leaveRecord?: StaffLeaveRecord | null;
    odRecord?: StaffOdRecord | null;
    permissionRecord?: StaffPermissionRecord | null;
  };
  todaySlots: StaffSlotDetail[];
  todaySlotsCount: number;
  todayPostedSlotsCount: number;
  todayPendingSlotsCount: number;
  teachingSubjects: StaffAssignedSubject[];
  weeklyTimetable: Record<string, StaffWeeklySlot[]>;
  workloadSummary: {
    totalWeeklyPeriods: number;
    theoryPeriods: number;
    labPeriods: number;
    totalSubjects: number;
    totalSections: number;
  };
  recentAttendance: StaffRecentAttendanceItem[];
  personalDetails?: StaffPersonalDetails;
  achievements?: StaffAchievement[];
  semesterAcademicHistory?: StaffSemesterAcademicHistoryItem[];
  studentFeedbackHistory?: StaffStudentFeedbackHistoryItem[];
  semesterRoles?: StaffSemesterRole[];
  careerHistory?: StaffCareerHistoryItem[];
  documents?: StaffDocumentItem[];
  approvalHistory?: StaffApprovalHistoryItem[];
  monthlyCalendar?: StaffMonthlyCalendarResponse;
  workloadTimetable?: FacultyTimetable | null;
};

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
  weeklyTimetable: Record<string, StaffWeeklySlot[]>;
};

