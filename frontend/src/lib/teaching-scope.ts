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

/** Determine the single dashboard mode for the user based strictly on assigned role. */
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

  // Class Teacher -> Class Teacher Dashboard
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

