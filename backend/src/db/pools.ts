import mysql from "mysql2/promise";
import { MongoClient, type Db } from "mongodb";
import { env } from "../config/env.js";

type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
};

let academicPool: mysql.Pool | null = null;
let studentPool: mysql.Pool | null = null;
let examPool: mysql.Pool | null = null;
let mongoClient: MongoClient | null = null;
let hrmsDb: Db | null = null;

function isConnError(err: any): boolean {
  if (!err) return false;
  const code = err.code || "";
  const errno = err.errno;
  const msg = String(err.message || "").toLowerCase();
  return (
    code === "ECONNRESET" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "ECONNREFUSED" ||
    code === "ER_SERVER_SHUTDOWN" ||
    errno === -4077 ||
    err.fatal === true ||
    msg.includes("econnreset") ||
    msg.includes("connection lost") ||
    msg.includes("closed")
  );
}

function createPool(config: DbConfig, connectionLimit = 5) {
  if (!config.host || !config.user) {
    return null;
  }

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit,
    maxIdle: connectionLimit,
    idleTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    // Keep MySQL DATE/DATETIME as strings so JS timezones cannot shift calendar days.
    dateStrings: true,
    ...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  pool.on("error", (err) => {
    console.warn(`[db-pool:${config.database}] Idle client connection error:`, (err as any)?.code || (err as any)?.message);
  });

  return pool;
}

export function getAcademicPool() {
  if (!academicPool) {
    academicPool = createPool(env.academicDb, 10);
  }
  return academicPool;
}

export function getStudentPool() {
  if (!studentPool) {
    studentPool = createPool(env.studentDb, 8);
  }
  if (!studentPool) {
    throw new Error("Student database is not configured");
  }
  return studentPool;
}

export function getExamPool() {
  if (!examPool) {
    examPool = createPool(env.examDb, 5);
  }
  if (!examPool) {
    throw new Error("Examination database is not configured");
  }
  return examPool;
}

export async function getHrmsDb() {
  if (!env.hrmsMongoUrl) {
    throw new Error("HRMS Mongo URL is not configured");
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(env.hrmsMongoUrl);
    await mongoClient.connect();
    hrmsDb = mongoClient.db("hrms");
  }

  if (!hrmsDb) {
    throw new Error("HRMS database connection failed");
  }

  return hrmsDb;
}

export async function queryStudent<T = mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
) {
  const pool = getStudentPool();
  try {
    const [rows] = await pool.query(sql, params);
    return rows as T;
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[student_db] Connection reset (${err.code || err.message}). Retrying query once...`);
      const [rows] = await pool.query(sql, params);
      return rows as T;
    }
    throw err;
  }
}

export async function executeStudent(sql: string, params: unknown[] = []) {
  const pool = getStudentPool();
  try {
    const [result] = await pool.execute(sql, params as any[]);
    return result as mysql.ResultSetHeader;
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[student_db] Connection reset (${err.code || err.message}). Retrying execute once...`);
      const [result] = await pool.execute(sql, params as any[]);
      return result as mysql.ResultSetHeader;
    }
    throw err;
  }
}

export async function queryExam<T = mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
) {
  const pool = getExamPool();
  try {
    const [rows] = await pool.query(sql, params as any[]);
    return rows as T;
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[exam_db] Connection reset (${err.code || err.message}). Retrying query once...`);
      const [rows] = await pool.query(sql, params as any[]);
      return rows as T;
    }
    throw err;
  }
}

export async function executeExam(sql: string, params: unknown[] = []) {
  const pool = getExamPool();
  try {
    const [result] = await pool.execute(sql, params as any[]);
    return result as mysql.ResultSetHeader;
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[exam_db] Connection reset (${err.code || err.message}). Retrying execute once...`);
      const [result] = await pool.execute(sql, params as any[]);
      return result as mysql.ResultSetHeader;
    }
    throw err;
  }
}

export async function queryAcademic<T = mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
) {
  const pool = getAcademicPool();
  if (!pool) {
    throw new Error("Academic Portal database is not configured");
  }
  try {
    const [rows] = await pool.query(sql, params as any[]);
    return rows as T;
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[academic_portal] Connection reset (${err.code || err.message}). Retrying query once...`);
      const [rows] = await pool.query(sql, params as any[]);
      return rows as T;
    }
    throw err;
  }
}

export async function executeAcademic(sql: string, params: unknown[] = []) {
  const pool = getAcademicPool();
  if (!pool) {
    throw new Error("Academic Portal database is not configured");
  }
  try {
    const [result] = await pool.execute(sql, params as any[]);
    return result as mysql.ResultSetHeader;
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[academic_portal] Connection reset (${err.code || err.message}). Retrying execute once...`);
      const [result] = await pool.execute(sql, params as any[]);
      return result as mysql.ResultSetHeader;
    }
    throw err;
  }
}

export async function withAcademicTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
) {
  const pool = getAcademicPool();
  if (!pool) {
    throw new Error("Academic Portal database is not configured");
  }
  let conn: mysql.PoolConnection;
  try {
    conn = await pool.getConnection();
  } catch (err: any) {
    if (isConnError(err)) {
      console.warn(`[academic_portal] Connection reset on getConnection (${err.code || err.message}). Retrying once...`);
      conn = await pool.getConnection();
    } else {
      throw err;
    }
  }
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors if connection was severed
    }
    throw error;
  } finally {
    conn.release();
  }
}
