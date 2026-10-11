import type { Authorization } from "@/components/auth/AuthProvider";

const INSTITUTE_WIDE_PERMISSIONS = [
  "timetable.edit",
  "timetable.publish",
  "user_management.manage_users",
  "settings.edit",
  "mentoring.manage",
] as const;

/** Roles that may search employees and raise requests on their behalf. */
const REQUEST_DELEGATE_ROLE_KEYS = new Set([
  "super_admin",
  "principal",
  "vice_principal",
  "hod",
  "class_teacher",
]);

export function canRaiseRequestForOthers(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some((role) => REQUEST_DELEGATE_ROLE_KEYS.has(role.roleKey));
}

/** HOD user role check. */
export function isHodUser(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some((role) => role.roleKey === "hod");
}

/** Class Teacher user role check. */
export function isClassTeacherUser(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some((role) => role.roleKey === "class_teacher");
}


/** Staff role only — must raise substitution for own classes. */
export function isStaffOnlyRequester(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  if (canRaiseRequestForOthers(authorization)) return false;
  return authorization.roles.some((role) => role.roleKey === "staff");
}

/** Global super admin — hide personal teaching/request routes from sidebar. */
export function isSuperAdminUser(authorization: Authorization | null): boolean {
  if (!authorization?.scope?.isGlobal) return false;
  return authorization.roles?.some((role) => role.roleKey === "super_admin") ?? false;
}

/** Faculty / teaching staff without institute-wide admin permissions. */
export function isTeachingStaffOnly(authorization: Authorization | null): boolean {
  if (!authorization) return false;
  // If user has any leadership role (Super Admin, Principal, VP, HOD), they are leadership
  const isLeadership = authorization.roles?.some((role) =>
    REQUEST_DELEGATE_ROLE_KEYS.has(role.roleKey),
  );
  if (isLeadership) return false;

  // Staff role users are teaching staff
  const isStaffRole = authorization.roles?.some((role) => role.roleKey === "staff");
  if (isStaffRole) return true;

  if (!authorization.permissions?.length) return false;
  const perms = authorization.permissions;
  const hasTeachingAccess =
    perms.includes("attendance.view") ||
    perms.includes("attendance.post") ||
    perms.includes("my_timetable.view");
  if (!hasTeachingAccess) return false;
  return !INSTITUTE_WIDE_PERMISSIONS.some((key) => perms.includes(key));
}

export type DashboardMode = "admin" | "hod" | "class_teacher" | "teacher";

export type AvailableDashboardView = {
  mode: DashboardMode;
  label: string;
  shortLabel: string;
  description: string;
  isPrimary: boolean;
};

/** Principal or Vice Principal leadership role check. */
export function isPrincipalOrVpUser(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some(
    (role) => role.roleKey === "principal" || role.roleKey === "vice_principal"
  );
}

/** Staff role check. */
export function isStaffUser(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some((role) => role.roleKey === "staff");
}

/** Determine the primary/default dashboard mode for the user based on assigned role. */
export function getDefaultDashboardMode(authorization: Authorization | null): DashboardMode {
  if (!authorization) return "teacher";

  // Super Admin, Principal, Vice Principal -> Admin/Command Center
  if (isSuperAdminUser(authorization) || isPrincipalOrVpUser(authorization)) {
    return "admin";
  }

  // HOD -> Department Dashboard
  if (isHodUser(authorization)) {
    return "hod";
  }

  // Class Teacher -> Class Teacher & Section Dashboard
  if (isClassTeacherUser(authorization)) {
    return "class_teacher";
  }

  // Teaching staff only / Staff role -> Subject Teacher Dashboard
  if (isStaffUser(authorization) || isTeachingStaffOnly(authorization)) {
    return "teacher";
  }

  // Fallback for users with dashboard view permission
  if (authorization.permissions?.includes("dashboard.view")) {
    if (authorization.scope?.isGlobal) return "admin";
  }

  return "teacher";
}

/** Get list of accessible dashboard views based on roles and capabilities. */
export function getAvailableDashboardViews(
  authorization: Authorization | null,
): AvailableDashboardView[] {
  if (!authorization) {
    return [
      {
        mode: "teacher",
        label: "Subject Teacher Dashboard",
        shortLabel: "My Classes",
        description: "Personal teaching timetable and attendance posting",
        isPrimary: true,
      },
    ];
  }

  const views: AvailableDashboardView[] = [];
  const defaultMode = getDefaultDashboardMode(authorization);
  const isSuperAdmin = isSuperAdminUser(authorization);
  const isLeadership = isPrincipalOrVpUser(authorization);
  const isHod = isHodUser(authorization);
  const isClassTeacher = isClassTeacherUser(authorization);

  // 1. Admin / Command Center
  if (isSuperAdmin || isLeadership || authorization.permissions?.includes("dashboard.view")) {
    views.push({
      mode: "admin",
      label: isSuperAdmin ? "Command Center" : "Leadership Overview",
      shortLabel: "Command Center",
      description: isSuperAdmin
        ? "Multi-institute analytics & system health"
        : "College-wide academic operations",
      isPrimary: defaultMode === "admin",
    });
  }

  // 2. HOD / Department
  if (isHod || isSuperAdmin || isLeadership) {
    views.push({
      mode: "hod",
      label: isHod ? "Department Overview (HOD)" : "HOD View",
      shortLabel: "HOD Dept",
      description: "Department faculty workload, syllabus & section health",
      isPrimary: defaultMode === "hod",
    });
  }

  // 3. Class Teacher & Section
  if (isClassTeacher || isSuperAdmin || isLeadership) {
    views.push({
      mode: "class_teacher",
      label: isClassTeacher ? "Class Teacher & Section" : "Class Teacher View",
      shortLabel: "Class Teacher",
      description: "Assigned section roster, today's attendance & mentoring",
      isPrimary: defaultMode === "class_teacher",
    });
  }

  // 4. Subject Teacher / Teaching Classes
  // Any faculty member or subject teacher has access to their personal teaching classes
  views.push({
    mode: "teacher",
    label:
      isHod || isClassTeacher || isLeadership
        ? "My Teaching Classes"
        : "Subject Teacher Dashboard",
    shortLabel: "My Teaching",
    description: "Personal subjects, period schedule & attendance posting",
    isPrimary: defaultMode === "teacher",
  });

  return views;
}

export function scopeAllowsCollege(
  authorization: Authorization | null,
  collegeId: number,
): boolean {
  if (!authorization?.scope) return true;
  if (authorization.scope.isGlobal) return true;
  const ids = authorization.scope.collegeIds;
  if (!ids?.length) return true;
  return ids.includes(collegeId);
}

export function scopeAllowsBranch(
  authorization: Authorization | null,
  branchId: number,
): boolean {
  if (!authorization?.scope) return true;
  if (authorization.scope.isGlobal) return true;
  const ids = authorization.scope.branchIds;
  if (!ids?.length) return true;
  return ids.includes(branchId);
}

