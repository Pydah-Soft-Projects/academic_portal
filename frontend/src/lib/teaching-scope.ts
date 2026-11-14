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
  if (!authorization?.roles?.length) return false;
  return (
    authorization.roles.some((role) => role.roleKey === "super_admin" || role.roleKey === "superadmin") ||
    Boolean(authorization.scope?.isGlobal && authorization.roles.some((r) => r.roleKey.includes("admin")))
  );
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

export type DashboardMode = "admin" | "principal" | "vice_principal" | "hod" | "class_teacher" | "teacher";

/** Principal role check. */
export function isPrincipalUser(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some((role) => role.roleKey === "principal");
}

/** Vice Principal role check. */
export function isVicePrincipalUser(authorization: Authorization | null): boolean {
  if (!authorization?.roles?.length) return false;
  return authorization.roles.some((role) => role.roleKey === "vice_principal");
}

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

  // Super Admin -> Institutional Admin Dashboard (Command Center)
  if (isSuperAdminUser(authorization) || authorization.scope?.isGlobal) {
    return "admin";
  }

  // Vice Principal role -> Vice Principal Dashboard
  if (isVicePrincipalUser(authorization)) {
    return "vice_principal";
  }

  // Principal role -> Principal Dashboard
  if (isPrincipalUser(authorization)) {
    return "principal";
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

export const ROLE_HIERARCHY_ORDER: Record<string, number> = {
  super_admin: 1,
  superadmin: 1,
  principal: 2,
  vice_principal: 3,
  director: 3,
  dean: 3,
  hod: 4,
  class_teacher: 5,
  mentor: 5,
  staff: 6,
  faculty: 6,
};

/**
 * Returns the unique single role for the user based on institutional hierarchy order.
 * Deduplicates multi-scope assignments of the same role and prioritizes leadership/administrative roles.
 */
export function getUniqueSingleRole(
  authorization: Authorization | null,
): { roleKey: string; label: string } | null {
  if (!authorization?.roles?.length) return null;

  const uniqueRoles = new Map<string, { roleKey: string; label: string }>();
  for (const r of authorization.roles) {
    if (!uniqueRoles.has(r.roleKey)) {
      uniqueRoles.set(r.roleKey, { roleKey: r.roleKey, label: r.label });
    }
  }

  const sorted = Array.from(uniqueRoles.values()).sort((a, b) => {
    const rankA = ROLE_HIERARCHY_ORDER[a.roleKey] ?? 99;
    const rankB = ROLE_HIERARCHY_ORDER[b.roleKey] ?? 99;
    return rankA - rankB;
  });

  return sorted[0] ?? null;
}

/**
 * Returns the unique single role display label for the user (e.g. "Super Admin", "HOD", "Staff").
 */
export function getUniqueSingleRoleLabel(authorization: Authorization | null): string | null {
  return getUniqueSingleRole(authorization)?.label ?? null;
}


