import "dotenv/config";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { env } from "../config/env.js";

async function tableExists(conn: mysql.Connection, table: string) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.academicDb.database, table],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function columnExists(conn: mysql.Connection, table: string, col: string) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [env.academicDb.database, table, col],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
  console.log(`Connecting to ${env.academicDb.database} @ ${env.academicDb.host}...`);
  const conn = await mysql.createConnection({
    host: env.academicDb.host,
    port: env.academicDb.port,
    user: env.academicDb.user,
    password: env.academicDb.password,
    database: env.academicDb.database,
    multipleStatements: true,
    connectTimeout: 60000,
    ...(env.academicDb.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  console.log("Connected. Creating Staff Profile enhancements tables...");

  // 1. Extended Personal & Employment details table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_personal_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      hrms_employee_id VARCHAR(100) NOT NULL,
      staff_link_id BIGINT UNSIGNED NULL,
      dob DATE NULL,
      gender VARCHAR(20) NULL,
      blood_group VARCHAR(10) NULL,
      marital_status VARCHAR(20) NULL,
      nationality VARCHAR(50) DEFAULT 'Indian',
      aadhaar_number VARCHAR(20) NULL,
      pan_number VARCHAR(20) NULL,
      uan_number VARCHAR(30) NULL,
      pf_number VARCHAR(50) NULL,
      personal_email VARCHAR(150) NULL,
      official_email VARCHAR(150) NULL,
      mobile_number VARCHAR(30) NULL,
      emergency_contact_name VARCHAR(100) NULL,
      emergency_contact_phone VARCHAR(30) NULL,
      current_address TEXT NULL,
      permanent_address TEXT NULL,
      city VARCHAR(100) NULL,
      district VARCHAR(100) NULL,
      state VARCHAR(100) DEFAULT 'Andhra Pradesh',
      pincode VARCHAR(20) NULL,
      highest_qualification VARCHAR(150) NULL,
      specialization VARCHAR(150) NULL,
      total_experience_years DECIMAL(4,1) DEFAULT 0.0,
      employment_status VARCHAR(50) DEFAULT 'Active',
      date_of_joining DATE NULL,
      probation_end_date DATE NULL,
      confirmation_date DATE NULL,
      date_of_relieving DATE NULL,
      relieving_reason TEXT NULL,
      profile_completion_percent INT UNSIGNED DEFAULT 80,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_staff_hrms_id (hrms_employee_id),
      KEY idx_staff_link (staff_link_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_personal_details created/verified");

  // 2. Staff Achievements table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_achievements (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      hrms_employee_id VARCHAR(100) NOT NULL,
      staff_link_id BIGINT UNSIGNED NULL,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      publication_name VARCHAR(255) NULL,
      issuing_organization VARCHAR(255) NULL,
      publication_date DATE NULL,
      certificate_number_or_doi VARCHAR(150) NULL,
      academic_year VARCHAR(30) NULL,
      semester VARCHAR(20) NULL,
      achievement_url VARCHAR(500) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      hod_reviewed_by BIGINT UNSIGNED NULL,
      hod_reviewed_at DATETIME NULL,
      hod_remarks TEXT NULL,
      principal_approved_by BIGINT UNSIGNED NULL,
      principal_approved_at DATETIME NULL,
      principal_remarks TEXT NULL,
      rejection_remarks TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_ach_hrms (hrms_employee_id),
      KEY idx_ach_staff_link (staff_link_id),
      KEY idx_ach_status (status),
      KEY idx_ach_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_achievements created/verified");

  // 3. Staff Achievement Documents
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_achievement_documents (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      achievement_id BIGINT UNSIGNED NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url MEDIUMTEXT NOT NULL,
      file_size INT UNSIGNED DEFAULT 0,
      file_type VARCHAR(50) DEFAULT 'application/pdf',
      uploaded_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ach_doc_ach (achievement_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_achievement_documents created/verified");

  // 4. Staff Achievement Approvals audit trail
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_achievement_approvals (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      achievement_id BIGINT UNSIGNED NOT NULL,
      actor_user_id BIGINT UNSIGNED NULL,
      actor_name VARCHAR(150) NULL,
      actor_role VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ach_appr_ach (achievement_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_achievement_approvals created/verified");

  // 5. Staff Semester-wise Roles & Responsibilities
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_semester_roles (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      hrms_employee_id VARCHAR(100) NOT NULL,
      staff_link_id BIGINT UNSIGNED NULL,
      academic_year VARCHAR(30) NOT NULL,
      semester VARCHAR(20) NOT NULL,
      role_name VARCHAR(100) NOT NULL,
      department VARCHAR(100) NULL,
      college VARCHAR(150) NULL,
      assigned_by VARCHAR(150) NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      responsibilities TEXT NULL,
      status VARCHAR(50) DEFAULT 'active',
      supporting_doc_url VARCHAR(500) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_staff_roles_hrms (hrms_employee_id),
      KEY idx_staff_roles_year (academic_year, semester)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_semester_roles created/verified");

  // 6. Staff Career Milestones (Joining, promotions, transfers, relieving)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_career_history (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      hrms_employee_id VARCHAR(100) NOT NULL,
      staff_link_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(50) NOT NULL,
      event_date DATE NOT NULL,
      designation VARCHAR(150) NOT NULL,
      department VARCHAR(100) NOT NULL,
      college VARCHAR(150) NOT NULL,
      remarks TEXT NULL,
      order_copy_url VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_career_hrms (hrms_employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_career_history created/verified");

  // 7. Staff Documents repository / checklist
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ap_staff_documents (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      hrms_employee_id VARCHAR(100) NOT NULL,
      staff_link_id BIGINT UNSIGNED NULL,
      document_type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      file_url MEDIUMTEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size INT UNSIGNED DEFAULT 0,
      file_type VARCHAR(50) DEFAULT 'application/pdf',
      is_verified BOOLEAN DEFAULT FALSE,
      verified_by VARCHAR(150) NULL,
      verified_at DATETIME NULL,
      uploaded_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_doc_hrms (hrms_employee_id),
      KEY idx_doc_type (document_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("-> ap_staff_documents created/verified");

  await conn.end();
  console.log("=== All Staff Profile Enhancement tables migrated successfully! ===");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

