import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { executeAcademic, getHrmsDb, queryAcademic } from "../db/pools.js";
import { toMysqlUtcDateTime } from "../lib/mysql-datetime.js";
import { ensureInternalMarksSchema } from "./internal-marks.service.js";

/**
 * Authentication foundation
 *
 * HRMS has TWO password sources (confirmed in live DB):
 * - Mongo `users` — admin/office login accounts (~43)
 * - Mongo `employees` — staff directory with bcrypt `password` on each employee (~585)
 *   HRMS login audits use userType "user" and "employee" separately.
 *
 * Academic Portal:
 * 1. Admin links HRMS **employees** in User Management and assigns AP roles
 * 2. Login verifies password live against HRMS `users` OR `employees` (never copied)
 * 3. Bootstrap Super Admin is the only local password_hash on ap_users
 *
 * HRMS authsessions are NOT reused.
 */

export const LOCAL_AUTH_SOURCE = "local";

export const SUPER_ADMIN_SEED = {
  name: "Super Admin",
  username: "superadmin",
  email: "superadmin@academic.local",
  roleKey: "super_admin",
  /**
   * Resolved from env (AP_SUPERADMIN_PASSWORD). Dev-only default lives in env.ts.
   * Never log this value.
   */
  get password() {
    return env.superAdminBootstrap.password;
  },
} as const;

export type AuthUser = {
  id: number;
  name: string;
  email: string | null;
  username: string;
  hrmsEmployeeId: string | null;
  hrmsUserId: string;
  isActive: boolean;
  loginMethod?: "credentials" | "sso";
  isSso?: boolean;
};

type ApUserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string | null;
  username: string;
  password_hash?: string | null;
  hrms_employee_id: string | null;
  is_active: number;
};

type HrmsUserDoc = {
  _id: ObjectId;
  email?: string | null;
  name?: string | null;
  password?: string | null;
  isActive?: boolean;
  employeeId?: string | number | null;
  employeeRef?: unknown;
  tokenVersion?: number;
};

type HrmsEmployeeAuthDoc = {
  _id: ObjectId;
  emp_no?: string | number | null;
  employeeId?: string | number | null;
  employee_name?: string | null;
  email?: string | null;
  password?: string | null;
  is_active?: boolean | number | null;
};

const SESSION_COOKIE = () => env.auth.cookieName;

let schemaReady: Promise<void> | null = null;

export async function ensureAuthSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_sessions (
          id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT UNSIGNED NOT NULL,
          session_token_hash CHAR(64) NOT NULL,
          hrms_user_id VARCHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          last_seen_at DATETIME NULL,
          ip_address VARCHAR(64) NULL,
          user_agent VARCHAR(512) NULL,
          revoked_at DATETIME NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_ap_session_token_hash (session_token_hash),
          KEY idx_ap_sessions_user (user_id),
          KEY idx_ap_sessions_expires (expires_at),
          CONSTRAINT fk_ap_sessions_user FOREIGN KEY (user_id) REFERENCES ap_users(id)
        )
      `);

      try {
        await executeAcademic(`
          ALTER TABLE ap_sessions
          ADD COLUMN login_method VARCHAR(32) NOT NULL DEFAULT 'credentials'
        `);
      } catch {
        // column already exists or table altered
      }

      try {
        await executeAcademic(`
          INSERT INTO ap_permissions (permission_key, module, action, display_name, description, is_active)
          VALUES
            ('today_timetable.view', 'today_timetable', 'view', 'View Today Timetable', 'View daily timetable schedules and activity logs.', 1),
            ('today_timetable.edit', 'today_timetable', 'edit', 'Edit Today Timetable', 'Edit daily timetable periods, subject and faculty assignments.', 1)
          ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description), is_active = 1
        `);

        await executeAcademic(`
          INSERT IGNORE INTO ap_role_permissions (role_id, permission_id)
          SELECT r.id, p.id
          FROM ap_roles r
          CROSS JOIN ap_permissions p
          WHERE p.permission_key IN ('today_timetable.view', 'today_timetable.edit')
            AND r.role_key IN ('super_admin', 'principal', 'vice_principal', 'hod')
        `);

        await executeAcademic(`
          INSERT IGNORE INTO ap_role_permissions (role_id, permission_id)
          SELECT r.id, p.id
          FROM ap_roles r
          CROSS JOIN ap_permissions p
          WHERE p.permission_key = 'today_timetable.view'
            AND r.role_key = 'staff'
        `);

        await ensureInternalMarksSchema();
      } catch (err) {
        console.warn("Could not ensure schema / permissions in database:", err);
      }
    })();
  }
  await schemaReady;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function idFromValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const maybe = value as { toHexString?: () => string; toString?: () => string; _id?: unknown };
    if (typeof maybe.toHexString === "function") return maybe.toHexString();
    if (typeof maybe.toString === "function") {
      const asText = maybe.toString();
      if (/^[a-f0-9]{24}$/i.test(asText)) return asText;
    }
    if (maybe._id != null && maybe._id !== value) return idFromValue(maybe._id);
  }
  if (typeof value === "string" || typeof value === "number") {
    const t = String(value).trim();
    return t || null;
  }
  return null;
}

function mapApUser(row: ApUserRow, hrmsUserId: string): AuthUser {
  return {
    id: Number(row.id),
    name: row.name,
    email: text(row.email),
    username: row.username,
    hrmsEmployeeId: text(row.hrms_employee_id),
    hrmsUserId,
    isActive: Number(row.is_active) === 1,
  };
}

async function findHrmsUserByIdentifier(identifier: string): Promise<HrmsUserDoc | null> {
  const db = await getHrmsDb();
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const email = trimmed.toLowerCase();
  const users = db.collection<HrmsUserDoc>("users");

  let doc =
    (await users.findOne({
      email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    })) ?? null;

  if (!doc) {
    doc =
      (await users.findOne({
        employeeId: trimmed,
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      })) ?? null;
  }

  if (!doc && /^\d+$/.test(trimmed)) {
    doc =
      (await users.findOne({
        employeeId: Number(trimmed),
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      })) ?? null;
  }

  if (!doc && ObjectId.isValid(trimmed)) {
    doc =
      (await users.findOne({
        _id: new ObjectId(trimmed),
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      })) ?? null;
  }

  return doc;
}

function employeeIsActive(doc: HrmsEmployeeAuthDoc): boolean {
  if (doc.is_active === false || doc.is_active === 0) return false;
  return true;
}

/** HRMS staff password lives on `employees.password` (bcrypt) for employee-type logins. */
async function findHrmsEmployeeByIdentifier(
  identifier: string,
): Promise<HrmsEmployeeAuthDoc | null> {
  const db = await getHrmsDb();
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const employees = db.collection<HrmsEmployeeAuthDoc>("employees");
  const email = trimmed.toLowerCase();
  const safeEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let doc =
    (await employees.findOne({
      email: { $regex: `^${safeEmail}$`, $options: "i" },
    })) ?? null;

  if (!doc) {
    const or: Record<string, unknown>[] = [{ emp_no: trimmed }, { employeeId: trimmed }];
    if (/^\d+$/.test(trimmed)) {
      or.push({ emp_no: Number(trimmed) }, { employeeId: Number(trimmed) });
    }
    doc = (await employees.findOne({ $or: or })) ?? null;
  }

  if (!doc && ObjectId.isValid(trimmed)) {
    doc = (await employees.findOne({ _id: new ObjectId(trimmed) })) ?? null;
  }

  if (!doc || !employeeIsActive(doc)) return null;
  return doc;
}

async function findLinkedApUser(input: {
  username: string;
  email: string | null;
  hrmsEmployeeId: string;
}): Promise<ApUserRow> {
  const existing = await queryAcademic<ApUserRow[]>(
    `
    SELECT id, name, email, username, hrms_employee_id, is_active
    FROM ap_users
    WHERE (password_hash IS NULL OR password_hash = '')
      AND (
        username = ?
        OR (? IS NOT NULL AND email = ?)
        OR (hrms_employee_id IS NOT NULL AND hrms_employee_id = ?)
      )
    LIMIT 1
    `,
    [input.username, input.email, input.email, input.hrmsEmployeeId],
  );

  const row = existing[0];
  if (!row) {
    throw Object.assign(
      new Error(
        "No Academic Portal access yet. Ask an administrator to add you from User Management.",
      ),
      { status: 403 },
    );
  }
  if (Number(row.is_active) !== 1) {
    throw Object.assign(new Error("Account is deactivated"), { status: 403 });
  }
  return row;
}

/**
 * Resolve a portal user that an admin already linked from HRMS, then refresh
 * display identity (name/email) from HRMS. Never creates users on login and
 * never writes password_hash — passwords stay in HRMS and are verified live.
 */
async function resolveLinkedApUserFromHrms(
  hrmsUser: HrmsUserDoc,
): Promise<{ user: AuthUser; hrmsUserId: string }> {
  const hrmsUserId = String(hrmsUser._id);
  const email = text(hrmsUser.email)?.toLowerCase() ?? null;
  const name = text(hrmsUser.name) || email || `HRMS ${hrmsUserId}`;
  const employeeRef = idFromValue(hrmsUser.employeeRef);
  const empNo = text(hrmsUser.employeeId);
  // Prefer emp_no string for matching ap_users.hrms_employee_id (set from employees.emp_no).
  const hrmsEmployeeId = empNo || employeeRef || hrmsUserId;
  const username = email || `hrms_${hrmsUserId}`;

  const row = await findLinkedApUser({ username, email, hrmsEmployeeId });

  await executeAcademic(
    `
    UPDATE ap_users
    SET name = ?,
        email = COALESCE(?, email),
        username = ?,
        hrms_employee_id = COALESCE(?, hrms_employee_id),
        password_hash = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [name, email, username, hrmsEmployeeId, row.id],
  );
  const refreshed = await queryAcademic<ApUserRow[]>(
    `SELECT id, name, email, username, hrms_employee_id, is_active FROM ap_users WHERE id = ? LIMIT 1`,
    [row.id],
  );
  return { user: mapApUser(refreshed[0]!, hrmsUserId), hrmsUserId };
}

async function resolveLinkedApUserFromEmployee(
  emp: HrmsEmployeeAuthDoc,
): Promise<{ user: AuthUser; hrmsUserId: string }> {
  const hrmsUserId = `employee:${String(emp._id)}`;
  const email = text(emp.email)?.toLowerCase() ?? null;
  const empNo = text(emp.emp_no ?? emp.employeeId) || String(emp._id);
  const name = text(emp.employee_name) || email || `Employee ${empNo}`;
  const username = email || `emp_${empNo}`;

  const row = await findLinkedApUser({
    username,
    email,
    hrmsEmployeeId: empNo,
  });

  await executeAcademic(
    `
    UPDATE ap_users
    SET name = ?,
        email = COALESCE(?, email),
        username = ?,
        hrms_employee_id = ?,
        password_hash = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [name, email, username, empNo, row.id],
  );
  const refreshed = await queryAcademic<ApUserRow[]>(
    `SELECT id, name, email, username, hrms_employee_id, is_active FROM ap_users WHERE id = ? LIMIT 1`,
    [row.id],
  );
  return { user: mapApUser(refreshed[0]!, hrmsUserId), hrmsUserId };
}

export type LoginResult = {
  user: AuthUser;
  sessionToken: string;
  expiresAt: Date;
};

async function createSessionForUser(input: {
  user: AuthUser;
  hrmsUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  loginMethod?: "credentials" | "sso";
}): Promise<LoginResult> {
  const sessionToken = newSessionToken();
  const tokenHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + env.auth.sessionTtlHours * 60 * 60 * 1000);
  const loginMethod = input.loginMethod ?? "credentials";

  try {
    await executeAcademic(
      `
      INSERT INTO ap_sessions
        (user_id, session_token_hash, hrms_user_id, login_method, expires_at, last_seen_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)
      `,
      [
        input.user.id,
        tokenHash,
        input.hrmsUserId,
        loginMethod,
        toMysqlUtcDateTime(expiresAt),
        text(input.ipAddress),
        text(input.userAgent)?.slice(0, 512) ?? null,
      ],
    );
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message || "");
    if (msg.includes("Unknown column 'login_method'")) {
      await executeAcademic(
        `
        INSERT INTO ap_sessions
          (user_id, session_token_hash, hrms_user_id, expires_at, last_seen_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)
        `,
        [
          input.user.id,
          tokenHash,
          input.hrmsUserId,
          toMysqlUtcDateTime(expiresAt),
          text(input.ipAddress),
          text(input.userAgent)?.slice(0, 512) ?? null,
        ],
      );
    } else {
      throw err;
    }
  }

  const updatedUser: AuthUser = {
    ...input.user,
    loginMethod,
    isSso: loginMethod === "sso",
  };

  return { user: updatedUser, sessionToken, expiresAt };
}

async function tryLocalPasswordLogin(input: {
  identifier: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult | null> {
  const identifier = input.identifier.trim();
  // Bootstrap Super Admin only — never authenticate HRMS-linked users via local hash.
  const rows = await queryAcademic<(ApUserRow & { password_hash: string | null })[]>(
    `
    SELECT id, name, email, username, password_hash, hrms_employee_id, is_active
    FROM ap_users
    WHERE password_hash IS NOT NULL
      AND password_hash <> ''
      AND hrms_employee_id IS NULL
      AND (
        LOWER(username) = LOWER(?)
        OR LOWER(COALESCE(email, '')) = LOWER(?)
        OR LOWER(name) = LOWER(?)
      )
    LIMIT 1
    `,
    [identifier, identifier, identifier],
  );

  const row = rows[0];
  if (!row || Number(row.is_active) !== 1) return null;
  const hash = text(row.password_hash);
  if (!hash) return null;

  const ok = await bcrypt.compare(input.password, hash);
  if (!ok) return null;

  const user = mapApUser(row, LOCAL_AUTH_SOURCE);
  return createSessionForUser({
    user,
    hrmsUserId: LOCAL_AUTH_SOURCE,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

/**
 * Login order:
 * 1) Local Super Admin bootstrap (only account with a portal password_hash)
 * 2) HRMS Mongo `users` password (office/admin login accounts)
 * 3) HRMS Mongo `employees` password (staff directory — where most employee passwords live)
 * 4) Portal profile must already exist (admin linked employee + assigned AP roles)
 *
 * Password changes in HRMS apply here automatically — we never store staff passwords.
 */
export async function loginWithCredentials(input: {
  identifier: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult> {
  await ensureAuthSchema();

  const identifier = input.identifier.trim();
  const password = input.password;
  if (!identifier || !password) {
    throw Object.assign(new Error("Email/username and password are required"), { status: 400 });
  }

  const local = await tryLocalPasswordLogin(input);
  if (local) return local;

  // 1) HRMS users collection (admin/office accounts)
  const hrmsUser = await findHrmsUserByIdentifier(identifier);
  if (hrmsUser && hrmsUser.isActive !== false) {
    const hash = text(hrmsUser.password);
    if (hash) {
      const ok = await bcrypt.compare(password, hash);
      if (ok) {
        const { user, hrmsUserId } = await resolveLinkedApUserFromHrms(hrmsUser);
        return createSessionForUser({
          user,
          hrmsUserId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });
      }
    }
  }

  // 2) HRMS employees collection (staff passwords — e.g. emp 2145)
  const emp = await findHrmsEmployeeByIdentifier(identifier);
  if (emp) {
    const hash = text(emp.password);
    if (hash) {
      const ok = await bcrypt.compare(password, hash);
      if (ok) {
        const { user, hrmsUserId } = await resolveLinkedApUserFromEmployee(emp);
        return createSessionForUser({
          user,
          hrmsUserId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });
      }
    }
  }

  throw Object.assign(new Error("Invalid credentials"), { status: 401 });
}

export type CrmVerifyTokenResponse = {
  success: boolean;
  valid: boolean;
  message?: string;
  data?: {
    userId?: string | number;
    portalId?: string;
    role?: string;
    expiresAt?: string;
    email?: string;
    employeeId?: string | number;
    username?: string;
    name?: string;
    [key: string]: unknown;
  };
};

/**
 * Authenticate a user via CRM encrypted SSO token.
 * 1. Verifies token with CRM Backend Gateway (POST /auth/verify-token)
 * 2. Checks token validity and expiration
 * 3. Resolves user from Academic Portal (ap_users or linked HRMS profile)
 * 4. Creates a local session and returns user and session token
 */
export async function loginWithSsoToken(input: {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult & { crmData?: CrmVerifyTokenResponse["data"] }> {
  await ensureAuthSchema();

  const encryptedToken = input.token?.trim();
  if (!encryptedToken) {
    throw Object.assign(new Error("SSO token is required"), { status: 400 });
  }

  // 1) Verify token with CRM Backend Gateway
  const base = env.crm.backendUrl.replace(/\/$/, "");
  let crmVerifyUrl = base.endsWith("/auth/verify-token")
    ? base
    : `${base}/auth/verify-token`;
  let verifyResult: CrmVerifyTokenResponse;

  try {
    let response = await fetch(crmVerifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ encryptedToken }),
      signal: AbortSignal.timeout(10000),
    });

    // If 404 and base URL didn't include /api, try /api/auth/verify-token
    if (response.status === 404 && !base.includes("/api")) {
      const altUrl = `${base}/api/auth/verify-token`;
      const altResponse = await fetch(altUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedToken }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);

      if (altResponse && altResponse.status !== 404) {
        response = altResponse;
        crmVerifyUrl = altUrl;
      }
    }

    const bodyText = await response.text();
    try {
      verifyResult = JSON.parse(bodyText);
    } catch {
      throw Object.assign(
        new Error(`CRM gateway returned invalid JSON (Status: ${response.status})`),
        { status: 502 },
      );
    }
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "status" in err) {
      throw err;
    }
    const cause = (err as { cause?: Error & { code?: string } })?.cause;
    const causeDetails = cause ? ` (${cause.code || cause.message || String(cause)})` : "";
    const message = err instanceof Error ? err.message : "Failed to connect to CRM gateway";
    console.error(`[SSO] CRM verify-token request failed for ${crmVerifyUrl}:`, err, cause);
    throw Object.assign(
      new Error(`CRM verify-token request failed: ${message}${causeDetails} [Target: ${crmVerifyUrl}]`),
      { status: 502 },
    );
  }

  if (!verifyResult.success || !verifyResult.valid) {
    throw Object.assign(
      new Error(verifyResult.message || "Invalid or expired SSO token"),
      { status: 401 },
    );
  }

  const crmData = verifyResult.data;
  if (!crmData) {
    throw Object.assign(new Error("CRM response missing token payload"), { status: 401 });
  }

  // 2) Validate token expiration
  if (crmData.expiresAt) {
    const expiryTime = new Date(crmData.expiresAt).getTime();
    if (Date.now() >= expiryTime) {
      throw Object.assign(new Error("SSO token has expired"), { status: 401 });
    }
  }

  // 3) Resolve user in Academic Portal
  const rawUserId = text(crmData.userId);
  const rawEmail = text(crmData.email);
  const rawEmployeeId = text(crmData.employeeId);
  const rawUsername = text(crmData.username);

  let apUserRow: ApUserRow | null = null;
  const queryConditions: string[] = [];
  const queryParams: unknown[] = [];

  if (rawEmail) {
    queryConditions.push("LOWER(COALESCE(email, '')) = LOWER(?)");
    queryParams.push(rawEmail);
  } else if (rawUserId && rawUserId.includes("@")) {
    queryConditions.push("LOWER(COALESCE(email, '')) = LOWER(?)");
    queryParams.push(rawUserId);
  }

  if (rawEmployeeId) {
    queryConditions.push("hrms_employee_id = ?");
    queryParams.push(rawEmployeeId);
  } else if (rawUserId) {
    queryConditions.push("hrms_employee_id = ?");
    queryParams.push(rawUserId);
  }

  if (rawUsername) {
    queryConditions.push("LOWER(username) = LOWER(?)");
    queryParams.push(rawUsername);
  } else if (rawUserId) {
    queryConditions.push("LOWER(username) = LOWER(?)");
    queryParams.push(rawUserId);
  }

  if (rawUserId && /^\d+$/.test(rawUserId)) {
    queryConditions.push("id = ?");
    queryParams.push(Number(rawUserId));
  }

  if (queryConditions.length > 0) {
    const rows = await queryAcademic<ApUserRow[]>(
      `
      SELECT id, name, email, username, hrms_employee_id, is_active
      FROM ap_users
      WHERE (${queryConditions.join(" OR ")})
      LIMIT 1
      `,
      queryParams,
    );
    if (rows[0]) {
      apUserRow = rows[0];
    }
  }

  if (apUserRow) {
    if (Number(apUserRow.is_active) !== 1) {
      throw Object.assign(new Error("Account is deactivated"), { status: 403 });
    }
    const hrmsUserId = apUserRow.hrms_employee_id ?? String(apUserRow.id);
    const user = mapApUser(apUserRow, hrmsUserId);
    const session = await createSessionForUser({
      user,
      hrmsUserId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      loginMethod: "sso",
    });
    return { ...session, crmData };
  }

  // If not directly found in ap_users, resolve via HRMS MongoDB
  const fallbackIdentifier = rawUserId || rawEmail || rawEmployeeId || rawUsername || "";
  if (fallbackIdentifier) {
    let lastError: unknown = null;

    try {
      const hrmsUser = await findHrmsUserByIdentifier(fallbackIdentifier);
      if (hrmsUser && hrmsUser.isActive !== false) {
        const { user, hrmsUserId } = await resolveLinkedApUserFromHrms(hrmsUser);
        const session = await createSessionForUser({
          user,
          hrmsUserId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          loginMethod: "sso",
        });
        return { ...session, crmData };
      }
    } catch (err) {
      lastError = err;
    }

    try {
      const emp = await findHrmsEmployeeByIdentifier(fallbackIdentifier);
      if (emp) {
        const { user, hrmsUserId } = await resolveLinkedApUserFromEmployee(emp);
        const session = await createSessionForUser({
          user,
          hrmsUserId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          loginMethod: "sso",
        });
        return { ...session, crmData };
      }
    } catch (err) {
      lastError = err;
    }

    if (lastError && typeof lastError === "object" && "status" in lastError) {
      throw lastError;
    }
  }

  throw Object.assign(
    new Error(
      "No Academic Portal access yet. Ask an administrator to add you from User Management.",
    ),
    { status: 403 },
  );
}

/** @deprecated Use loginWithCredentials */
export const loginWithHrmsIdentity = loginWithCredentials;

/**
 * Upsert the global Super Admin bootstrap account and assign super_admin.
 * Password is stored only as bcrypt hash on ap_users for this account.
 */
export async function seedSuperAdmin(password = SUPER_ADMIN_SEED.password) {
  await ensureAuthSchema();

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await queryAcademic<ApUserRow[]>(
    `
    SELECT id, name, email, username, hrms_employee_id, is_active
    FROM ap_users
    WHERE username = ? OR email = ?
    LIMIT 1
    `,
    [SUPER_ADMIN_SEED.username, SUPER_ADMIN_SEED.email],
  );

  let userId: number;
  if (existing[0]) {
    userId = Number(existing[0].id);
    await executeAcademic(
      `
      UPDATE ap_users
      SET name = ?, email = ?, username = ?, password_hash = ?, is_active = 1,
          hrms_employee_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        SUPER_ADMIN_SEED.name,
        SUPER_ADMIN_SEED.email,
        SUPER_ADMIN_SEED.username,
        passwordHash,
        userId,
      ],
    );
  } else {
    const inserted = await executeAcademic(
      `
      INSERT INTO ap_users (name, email, username, password_hash, hrms_employee_id, is_active)
      VALUES (?, ?, ?, ?, NULL, 1)
      `,
      [
        SUPER_ADMIN_SEED.name,
        SUPER_ADMIN_SEED.email,
        SUPER_ADMIN_SEED.username,
        passwordHash,
      ],
    );
    userId = Number(inserted.insertId);
  }

  const roles = await queryAcademic<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM ap_roles WHERE role_key = ? LIMIT 1`,
    [SUPER_ADMIN_SEED.roleKey],
  );
  const roleId = roles[0]?.id;
  if (!roleId) {
    throw new Error(`Role ${SUPER_ADMIN_SEED.roleKey} not found. Run academic portal migrations first.`);
  }

  await executeAcademic(
    `
    INSERT INTO ap_user_roles (user_id, role_id, college_id, branch_id)
    VALUES (?, ?, NULL, NULL)
    ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
    `,
    [userId, roleId],
  );

  return {
    id: userId,
    name: SUPER_ADMIN_SEED.name,
    username: SUPER_ADMIN_SEED.username,
    email: SUPER_ADMIN_SEED.email,
    roleKey: SUPER_ADMIN_SEED.roleKey,
  };
}

export async function getUserForSessionToken(sessionToken: string): Promise<AuthUser | null> {
  await ensureAuthSchema();
  const tokenHash = sha256(sessionToken);
  let rows: (ApUserRow & { hrms_user_id: string; session_id: number; expires_at: string; login_method?: string })[] = [];

  try {
    rows = await queryAcademic<
      (ApUserRow & { hrms_user_id: string; session_id: number; expires_at: string; login_method?: string })[]
    >(
      `
      SELECT
        u.id, u.name, u.email, u.username, u.hrms_employee_id, u.is_active,
        s.id AS session_id, s.hrms_user_id, s.expires_at, s.login_method
      FROM ap_sessions s
      INNER JOIN ap_users u ON u.id = s.user_id
      WHERE s.session_token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP()
        AND u.is_active = 1
      LIMIT 1
      `,
      [tokenHash],
    );
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message || "");
    if (msg.includes("Unknown column 's.login_method'")) {
      rows = await queryAcademic<
        (ApUserRow & { hrms_user_id: string; session_id: number; expires_at: string })[]
      >(
        `
        SELECT
          u.id, u.name, u.email, u.username, u.hrms_employee_id, u.is_active,
          s.id AS session_id, s.hrms_user_id, s.expires_at
        FROM ap_sessions s
        INNER JOIN ap_users u ON u.id = s.user_id
        WHERE s.session_token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > UTC_TIMESTAMP()
          AND u.is_active = 1
        LIMIT 1
        `,
        [tokenHash],
      );
    } else {
      throw err;
    }
  }

  const row = rows[0];
  if (!row) return null;

  await executeAcademic(`UPDATE ap_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?`, [
    row.session_id,
  ]);

  const user = mapApUser(row, row.hrms_user_id);
  user.loginMethod = row.login_method === "sso" ? "sso" : "credentials";
  user.isSso = row.login_method === "sso";
  return user;
}

export async function revokeSessionToken(sessionToken: string | null | undefined) {
  await ensureAuthSchema();
  if (!sessionToken) return;
  const tokenHash = sha256(sessionToken);
  await executeAcademic(
    `
    UPDATE ap_sessions
    SET revoked_at = UTC_TIMESTAMP()
    WHERE session_token_hash = ? AND revoked_at IS NULL
    `,
    [tokenHash],
  );
}

/** Revoke all active sessions for a user (e.g. deactivation or role change). */
export async function revokeAllSessionsForUser(userId: number) {
  await ensureAuthSchema();
  const result = await executeAcademic(
    `
    UPDATE ap_sessions
    SET revoked_at = UTC_TIMESTAMP()
    WHERE user_id = ? AND revoked_at IS NULL
    `,
    [userId],
  );
  return Number(result.affectedRows ?? 0);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env.auth.secureCookies,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.auth.secureCookies,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE();
}
