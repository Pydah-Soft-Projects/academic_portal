import process from "node:process";
import "dotenv/config";
import { queryAcademic, queryStudent } from "../db/pools.js";

async function main() {
  console.log("--- REQUEST TYPES ---");
  const reqTypes = await queryAcademic("SELECT id, type_key, label FROM ap_request_types");
  console.log(reqTypes);

  const testBranchId = 17;
  const testDate = "2026-10-17";

  console.log("--- TEST SUBSTITUTIONS FOR TODAY ---");
  const subs = await queryAcademic(`
    SELECT d.id, d.year_of_study, d.section_name, d.subject_name, d.execution_status, d.reason,
           orig.display_name as original_faculty, repl.display_name as replacement_faculty,
           tts.slot_order, tts.label as slot_label, tts.start_time, tts.end_time
    FROM ap_faculty_substitution_details d
    LEFT JOIN ap_staff_link orig ON orig.id = d.original_faculty_staff_link_id
    LEFT JOIN ap_staff_link repl ON repl.id = d.replacement_faculty_staff_link_id
    LEFT JOIN ap_timing_template_slots tts ON tts.id = d.timing_slot_id
    WHERE d.session_date = ? AND d.branch_id = ?
  `, [testDate, testBranchId]);
  console.log("Substitutions:", subs);

  console.log("--- TEST TIMETABLE PLANS FOR BRANCH ---");
  const plans = await queryAcademic(`
    SELECT id, year_of_study, section_name, status, version_no
    FROM ap_timetable_plans
    WHERE branch_id = ? AND status != 'superseded' AND status != 'archived'
  `, [testBranchId]);
  console.log("Plans for branch 17:", plans);

  console.log("--- TEST UNPOSTED CLASS SESSIONS FOR TODAY ---");
  const unposted = await queryAcademic(`
    SELECT cs.id, cs.timing_slot_id, cs.section_name, cs.subject_name,
           cs.start_time, cs.end_time, cs.status,
           sl.display_name as faculty_name, tts.slot_order, tts.label as slot_label
    FROM ap_class_sessions cs
    LEFT JOIN ap_timing_template_slots tts ON tts.id = cs.timing_slot_id
    LEFT JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
    WHERE cs.session_date = ?
      AND cs.branch_id = ?
      AND cs.status NOT IN ('posted', 'completed', 'cancelled', 'holiday')
    ORDER BY cs.start_time ASC
    LIMIT 5
  `, [testDate, testBranchId]);
  console.log("Unposted sessions:", unposted);

  console.log("--- TEST PENDING REQUESTS ---");
  const reqs = await queryAcademic(`
    SELECT r.id, r.title, r.body, r.status, u.name as faculty_name, rt.label as request_label, rt.type_key
    FROM ap_requests r
    JOIN ap_request_types rt ON rt.id = r.request_type_id
    LEFT JOIN ap_users u ON u.id = r.requester_user_id
    WHERE (r.branch_id = ? OR r.branch_id IS NULL)
      AND r.status IN ('submitted', 'pending_approval', 'in_review')
    ORDER BY r.id DESC LIMIT 5
  `, [testBranchId]);
  console.log("Pending requests:", reqs);

  console.log("--- ACTIVE SECTIONS IN STUDENTS TABLE ---");
  const studentSections = await queryStudent(`
    SELECT current_year, section, COUNT(*) as count 
    FROM students 
    WHERE (college_id = 1 OR college_id IS NULL)
    GROUP BY current_year, section 
    HAVING count >= 5 
    LIMIT 10
  `);
  console.log(studentSections);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
