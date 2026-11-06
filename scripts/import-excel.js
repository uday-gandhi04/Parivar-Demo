#!/usr/bin/env node
/**
 * Excel -> MongoDB importer for Parivar.
 *
 * Examples:
 *   node scripts/import-excel.js --file ./data/Parivar_Demo_Family_250_Members.xlsx --family PARIVAR_DEMO --dry-run
 *   node scripts/import-excel.js --file ./data/Parivar_Demo_Family_250_Members.xlsx --family PARIVAR_DEMO
 *   node scripts/import-excel.js --file ./data/Parivar_Demo_Family_250_Members.xlsx --family PARIVAR_DEMO --reset --report ./import-report.json
 *
 * What it does:
 *   - Reads F_master, members, business, education sheets.
 *   - Skips placeholder/test rows.
 *   - Parses DD.MM.YYYY dates to ISO via lib/parseDate.
 *   - Validates: duplicate m_id, orphan father/mother/spouse refs, mutual spouse pointers,
 *     self-reference, orphan business/education sub-records.
 *   - Hard errors abort the write. Warnings are reported but not blocking.
 *   - Idempotent by default (upsert on {fid, mid}). --reset deletes that family's docs first.
 */

import '../src/lib/loadEnv.js';
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseDate } from '../src/lib/parseDate.js';

// Keep dry-run validation usable without a live database connection.
const log = {
  info: (message) => console.log('i', message),
  ok: (message) => console.log('+', message),
  warn: (message) => console.warn('!', message),
  err: (message) => console.error('x', message),
  hr: () => console.log('-'.repeat(60)),
  title: (message) => console.log(`\n${message}`),
  dim: (message) => console.log(message),
};

// ---------- CLI ----------

const { values: args } = parseArgs({
  options: {
    file: { type: 'string', short: 'f' },
    family: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    reset: { type: 'boolean', default: false },
    'allow-errors': { type: 'boolean', default: false },
    report: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (args.help || !args.file) {
  console.log(
    [
      'Usage: node scripts/import-excel.js --file <path> --family <FID> [options]',
      '',
      'Options:',
      '  --file, -f <path>   Path to FD_Master.xlsx (required)',
      '  --family <FID>      Which family these members belong to (required)',
      '  --dry-run           Validate only, do not write to MongoDB',
      '  --reset             Delete all docs scoped to --family before writing',
      '  --allow-errors      Sanitize bad edges (null self-refs and orphan refs) and proceed instead of aborting',
      '  --report <path>     Write a JSON validation report to disk',
      '  --help, -h          Show this help',
    ].join('\n')
  );
  process.exit(args.help ? 0 : 1);
}

if (!args.family) {
  log.err('--family <FID> is required.');
  process.exit(1);
}

if (args.family !== 'PARIVAR_DEMO') {
  log.err('Safety stop: this public demo importer only accepts --family PARIVAR_DEMO.');
  process.exit(1);
}

// ---------- Helpers ----------

function readSheet(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Sheet "${name}" not found in workbook`);
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function isTestRow(row, fields) {
  return fields.some((f) => String(row[f] ?? '').trim().toLowerCase() === 'test');
}

function toMid(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'test' || lower === 'nan' || lower === 'null') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normaliseGender(v, note, sheet, row) {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).trim().toUpperCase();
  if (s === 'M') return 'M';
  if (s === 'F') return 'F';
  note('warn', sheet, row, 'gender', `Unrecognised gender "${v}" — set null`);
  return null;
}

/**
 * When --allow-errors is set, mutate `members` in place to remove the bad edges
 * referenced by `errors`. Self-references and orphan refs become null. Duplicate
 * m_id rows are already excluded during staging so nothing to do for those here.
 * Returns the count of members that were touched.
 */
function sanitize(members, errors) {
  const byMid = new Map(members.map((m) => [m.mid, m]));
  let touched = 0;
  for (const err of errors) {
    if (err.sheet !== 'members') continue;
    if (err.field === 'm_id') continue;

    const m = byMid.get(err.row);
    if (!m) continue;

    if (err.field === 'self') {
      if (m.fatherId === m.mid) m.fatherId = null;
      if (m.motherId === m.mid) m.motherId = null;
      if (m.spouseId === m.mid) m.spouseId = null;
      touched++;
    } else if (err.field === 'fatherId' || err.field === 'motherId' || err.field === 'spouseId') {
      m[err.field] = null;
      touched++;
    }
  }
  return touched;
}

// ---------- Stage + validate ----------

function stage(workbook, fid) {
  const issues = [];
  const note = (severity, sheet, row, field, message) =>
    issues.push({ severity, sheet, row, field, message });

  // F_master -> families
  const familyRows = readSheet(workbook, 'F_master')
    .filter((r) => !isTestRow(r, ['FID', 'FName']))
    .map((r) => ({
      fid: trimOrNull(r.FID),
      name: trimOrNull(r.FName),
      superAdminId: trimOrNull(r.SAdminID),
    }))
    .filter((r) => r.fid && r.name);

  // members
  const memberRowsRaw = readSheet(workbook, 'members');
  const seenMids = new Set();
  const members = [];

  memberRowsRaw.forEach((r, idx) => {
    const excelRow = idx + 2; // 1-based, plus header row

    if (isTestRow(r, ['m_id', 'name'])) return;

    const mid = toMid(r.m_id);
    if (mid === null) return;

    const name = trimOrNull(r.name);
    if (!name) return;

    if (seenMids.has(mid)) {
      note('error', 'members', excelRow, 'm_id', `Duplicate m_id ${mid}`);
      return;
    }
    seenMids.add(mid);

    const dob = parseDate(r.dob);
    if (r.dob && trimOrNull(r.dob) && !dob) {
      note('warn', 'members', excelRow, 'dob', `Could not parse "${r.dob}"`);
    }
    const anniversary = parseDate(r.anniversary);
    if (r.anniversary && trimOrNull(r.anniversary) && !anniversary) {
      note('warn', 'members', excelRow, 'anniversary', `Could not parse "${r.anniversary}"`);
    }

    members.push({
      fid,
      mid,
      name,
      fatherId: toMid(r.father_id),
      motherId: toMid(r.mother_id),
      spouseId: toMid(r.spouse_id),
      isDeceased: String(r.late ?? '').trim().toLowerCase() === 'x',
      mobile: trimOrNull(r.mobile),
      location: trimOrNull(r.location),
      dob,
      anniversary,
      photoUrl: trimOrNull(r.photo),
      status: trimOrNull(r.status),
      gender: normaliseGender(r.Gender ?? r.gender, note, 'members', excelRow),
      email: trimOrNull(r.email) ? trimOrNull(r.email).toLowerCase() : null,
    });
  });

  // Cross-reference checks
  const midSet = new Set(members.map((m) => m.mid));
  members.forEach((m) => {
    ['fatherId', 'motherId', 'spouseId'].forEach((field) => {
      const v = m[field];
      if (v !== null && !midSet.has(v)) {
        note('error', 'members', m.mid, field, `${field}=${v} does not match any m_id`);
      }
    });
    if (m.fatherId === m.mid || m.motherId === m.mid || m.spouseId === m.mid) {
      note('error', 'members', m.mid, 'self', `${m.name} (${m.mid}) references itself`);
    }
  });

  // Mutual-spouse check with auto-reciprocation.
  // If A.spouseId = B and B.spouseId is empty, fill B.spouseId = A and log it as 'info'.
  // If A.spouseId = B but B.spouseId = C (something else, non-empty), it's a real conflict — warn.
  // When two members both claim the same empty target (e.g. two wives pointing at one
  // husband), the first encountered wins; the second becomes a warning.
  const byMid = new Map(members.map((m) => [m.mid, m]));
  members.forEach((m) => {
    if (m.spouseId == null) return;
    const sp = byMid.get(m.spouseId);
    if (!sp) return; // orphan refs already caught above

    if (sp.spouseId == null) {
      sp.spouseId = m.mid;
      note(
        'info',
        'members',
        sp.mid,
        'spouseId',
        `Auto-reciprocated: ${sp.name} (${sp.mid}).spouseId set to ${m.mid} (${m.name})`
      );
    } else if (sp.spouseId !== m.mid) {
      note(
        'warn',
        'members',
        m.mid,
        'spouseId',
        `Mutual mismatch: ${m.name} (${m.mid}).spouse=${m.spouseId} but ${sp.name} (${sp.mid}).spouse=${sp.spouseId}`
      );
    }
  });

  // business
  const businesses = readSheet(workbook, 'business')
    .filter((r) => !isTestRow(r, ['m_id', 'b_id', 'B_name']))
    .map((r) => ({
      fid,
      mid: toMid(r.m_id),
      bid: trimOrNull(r.b_id),
      name: trimOrNull(r.B_name),
      city: trimOrNull(r.city),
      role: trimOrNull(r.role),
      description: trimOrNull(r.desc),
      category: trimOrNull(r.category),
      isCurrent: String(r.is_current ?? '').trim().toLowerCase() === 'yes',
    }))
    .filter((b) => b.mid !== null && b.bid);

  businesses.forEach((b) => {
    if (!midSet.has(b.mid)) {
      note('error', 'business', b.mid, 'm_id', `Orphan business — m_id ${b.mid} not found in members`);
    }
  });

  // education
  const educations = readSheet(workbook, 'education')
    .filter((r) => !isTestRow(r, ['m_id', 'e_id', 'Degree_course']))
    .map((r) => ({
      fid,
      mid: toMid(r.m_id),
      eid: trimOrNull(r.e_id),
      degreeOrCourse: trimOrNull(r.Degree_course),
      year: trimOrNull(r.Year),
      institution: trimOrNull(r.Institution),
      field: trimOrNull(r.Field),
    }))
    .filter((e) => e.mid !== null && e.eid);

  educations.forEach((e) => {
    if (!midSet.has(e.mid)) {
      note('error', 'education', e.mid, 'm_id', `Orphan education — m_id ${e.mid} not found in members`);
    }
  });

  return { familyRows, members, businesses, educations, issues };
}

// ---------- Main ----------

async function main() {
  log.title('Parivar Excel importer');
  log.info(`File:    ${args.file}`);
  log.info(`Family:  ${args.family}`);
  log.info(`Mode:    ${args['dry-run'] ? 'dry-run (no DB writes)' : args.reset ? 'reset + write' : 'upsert'}`);
  log.hr();

  const buf = readFileSync(args.file);
  const wb = XLSX.read(buf, { type: 'buffer' });
  log.ok(`Workbook loaded — sheets: ${wb.SheetNames.join(', ')}`);

  const fid = args.family;
  const { familyRows, members, businesses, educations, issues } = stage(wb, fid);

  if (familyRows.length !== 1 || familyRows[0].fid !== fid) {
    throw new Error(`Workbook must contain exactly one F_master row with FID=${fid}. Found: ${familyRows.map((f) => f.fid).join(', ') || 'none'}`);
  }
  if (args.reset && fid !== 'PARIVAR_DEMO') {
    throw new Error('Safety stop: this public demo importer may only reset FID=PARIVAR_DEMO.');
  }

  log.hr();
  log.title('Validation summary');
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warn');
  const fixes = issues.filter((i) => i.severity === 'info');

  log.info(`Families:    ${familyRows.length}`);
  log.info(`Members:     ${members.length} (deceased: ${members.filter((m) => m.isDeceased).length})`);
  log.info(`Businesses:  ${businesses.length}`);
  log.info(`Educations:  ${educations.length}`);
  if (fixes.length) log.info(`Auto-fixes:  ${fixes.length} (spouse cells reciprocated)`);
  if (errors.length) log.err(`Errors:      ${errors.length}`);
  if (warnings.length) log.warn(`Warnings:    ${warnings.length}`);
  if (!errors.length && !warnings.length) log.ok(`No blocking issues${fixes.length ? ' (auto-fixes applied)' : ''}`);

  if (issues.length) {
    log.hr();
    log.title('Issues (first 25)');
    issues.slice(0, 25).forEach((i) => {
      const fn = i.severity === 'error' ? log.err : i.severity === 'warn' ? log.warn : log.info;
      fn(`[${i.sheet}] row=${i.row} field=${i.field} — ${i.message}`);
    });
    if (issues.length > 25) log.dim(`  ... and ${issues.length - 25} more (see --report)`);
  }

  if (args.report) {
    const summary = {
      families: familyRows.length,
      members: members.length,
      businesses: businesses.length,
      educations: educations.length,
      autoFixes: fixes.length,
      errors: errors.length,
      warnings: warnings.length,
    };
    writeFileSync(args.report, JSON.stringify({ summary, issues }, null, 2));
    log.ok(`Report written to ${args.report}`);
  }

  if (args['dry-run']) {
    log.hr();
    log.info('Dry-run complete. No DB writes.');
    return;
  }

  if (errors.length) {
    if (args['allow-errors']) {
      const touched = sanitize(members, errors);
      log.warn(`--allow-errors: nulled invalid edges on ${touched} member(s); proceeding.`);
    } else {
      log.err(`Aborting: ${errors.length} validation error(s). Fix the source data, or pass --allow-errors to push past them.`);
      process.exitCode = 2;
      return;
    }
  }

  // ---- Write ----
  if (process.env.DEMO_MODE !== 'true') {
    throw new Error('Safety stop: set DEMO_MODE=true before importing demo data.');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required and must point to the separate parivar_demo database.');
  }

  // Load database-dependent modules only after dry-run and safety checks.
  const [{ connectDb, disconnectDb }, { Family, Member, Business, Education }] = await Promise.all([
    import('../src/lib/db.js'),
    import('../src/models/index.js'),
  ]);

  log.hr();
  log.title('Writing to the dedicated demo MongoDB database');
  await connectDb(process.env.MONGO_URI);
  log.ok('Connected');

  if (args.reset) {
    const [f, m, b, e] = await Promise.all([
      Family.deleteMany({ fid }),
      Member.deleteMany({ fid }),
      Business.deleteMany({ fid }),
      Education.deleteMany({ fid }),
    ]);
    log.warn(
      `Reset: removed Family=${f.deletedCount}, Member=${m.deletedCount}, Business=${b.deletedCount}, Education=${e.deletedCount} (fid=${fid})`
    );
  }

  for (const f of familyRows) {
    await Family.updateOne({ fid: f.fid }, { $set: f }, { upsert: true });
  }
  log.ok(`Families upserted: ${familyRows.length}`);

  if (members.length) {
    const res = await Member.bulkWrite(
      members.map((m) => ({
        updateOne: { filter: { fid: m.fid, mid: m.mid }, update: { $set: m }, upsert: true },
      })),
      { ordered: false }
    );
    log.ok(`Members: upserted ${res.upsertedCount}, modified ${res.modifiedCount} (total processed ${members.length})`);
  }

  if (businesses.length) {
    const res = await Business.bulkWrite(
      businesses.map((b) => ({
        updateOne: { filter: { fid: b.fid, mid: b.mid, bid: b.bid }, update: { $set: b }, upsert: true },
      })),
      { ordered: false }
    );
    log.ok(`Businesses: upserted ${res.upsertedCount}, modified ${res.modifiedCount}`);
  }

  if (educations.length) {
    const res = await Education.bulkWrite(
      educations.map((e) => ({
        updateOne: { filter: { fid: e.fid, mid: e.mid, eid: e.eid }, update: { $set: e }, upsert: true },
      })),
      { ordered: false }
    );
    log.ok(`Educations: upserted ${res.upsertedCount}, modified ${res.modifiedCount}`);
  }

  await disconnectDb();
  log.hr();
  log.ok('Done.');
}

main().catch((err) => {
  log.err(err.message);
  if (process.env.DEBUG) console.error(err);
  process.exitCode = 1;
});