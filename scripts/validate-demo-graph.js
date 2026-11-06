#!/usr/bin/env node
/**
 * Validate the synthetic Parivar demo workbook before importing it.
 * Checks workbook shape, IDs, references, gender/parent consistency, reciprocal
 * spouse links, date plausibility, parent cycles, generation depth and BFS reachability.
 * This script never connects to MongoDB.
 */
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const { values: args } = parseArgs({
  options: {
    file: { type: 'string', default: './data/Parivar_Demo_Family_250_Members.xlsx' },
    family: { type: 'string', default: 'PARIVAR_DEMO' },
    'member-id': { type: 'string', default: '1051' },
    'founder-father': { type: 'string', default: '1001' },
    'founder-mother': { type: 'string', default: '1002' },
    'expected-branches': { type: 'string', default: '8' },
    'expected-generations': { type: 'string', default: '6' },
    report: { type: 'string' },
  },
  strict: true,
});

const errors = [];
const warnings = [];
const issue = (list, code, message, details = {}) => list.push({ code, message, ...details });
const clean = (value) => value == null ? '' : String(value).trim();
const idValue = (value) => {
  const text = clean(value);
  if (!text || ['null', 'nan', 'test'].includes(text.toLowerCase())) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
};

function parseDMY(value) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (
    date.getUTCDate() !== Number(dd) ||
    date.getUTCMonth() !== Number(mm) - 1 ||
    date.getUTCFullYear() !== Number(yyyy)
  ) return null;
  return date;
}

function rowsFrom(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing required worksheet: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function run() {
  const workbook = XLSX.read(readFileSync(args.file), { type: 'buffer' });
  const familyRows = rowsFrom(workbook, 'F_master');
  const rawMembers = rowsFrom(workbook, 'members');
  const rawBusinesses = rowsFrom(workbook, 'business');
  const rawEducation = rowsFrom(workbook, 'education');

  const family = familyRows.filter((row) => clean(row.FID) || clean(row.FName));
  if (family.length !== 1 || clean(family[0]?.FID) !== args.family) {
    issue(errors, 'FAMILY_ROW', `Expected exactly one family row with FID=${args.family}.`);
  }

  const members = [];
  const byMid = new Map();
  rawMembers.forEach((row, index) => {
    const excelRow = index + 2;
    const mid = idValue(row.m_id);
    const name = clean(row.name);
    if (mid == null || !name) {
      issue(errors, 'MEMBER_ROW', `Invalid member row ${excelRow}.`, { row: excelRow });
      return;
    }
    if (byMid.has(mid)) {
      issue(errors, 'DUPLICATE_MID', `Duplicate member ID ${mid}.`, { row: excelRow });
      return;
    }
    const gender = clean(row.Gender ?? row.gender).toUpperCase();
    const dob = parseDMY(row.dob);
    if (!dob) issue(errors, 'DOB_INVALID', `${name} (${mid}) has an invalid or missing date of birth.`);
    if (!['M', 'F'].includes(gender)) issue(errors, 'GENDER_INVALID', `${name} (${mid}) has invalid gender value "${gender}".`);

    const member = {
      mid,
      name,
      fatherId: idValue(row.father_id),
      motherId: idValue(row.mother_id),
      spouseId: idValue(row.spouse_id),
      gender,
      dob,
      anniversary: parseDMY(row.anniversary),
      mobile: clean(row.mobile),
      email: clean(row.email),
      photo: clean(row.photo),
    };
    members.push(member);
    byMid.set(mid, member);
  });

  if (members.length !== 250) {
    issue(errors, 'MEMBER_COUNT', `Expected 250 members; found ${members.length}.`);
  }

  // Validate all relationship pointers and basic parent plausibility.
  const snapshotYear = 2026;
  for (const member of members) {
    for (const field of ['fatherId', 'motherId', 'spouseId']) {
      const ref = member[field];
      if (ref == null) continue;
      if (ref === member.mid) issue(errors, 'SELF_REFERENCE', `${member.name} (${member.mid}) references itself via ${field}.`);
      if (!byMid.has(ref)) issue(errors, 'ORPHAN_REFERENCE', `${member.name} (${member.mid}) has ${field}=${ref}, which does not exist.`);
    }
    if (member.fatherId != null && member.fatherId === member.motherId) {
      issue(errors, 'SAME_PARENT', `${member.name} has the same ID as father and mother.`);
    }
    const father = member.fatherId == null ? null : byMid.get(member.fatherId);
    const mother = member.motherId == null ? null : byMid.get(member.motherId);
    if (father && father.gender !== 'M') issue(errors, 'FATHER_GENDER', `${member.name}'s father reference does not point to a male member.`);
    if (mother && mother.gender !== 'F') issue(errors, 'MOTHER_GENDER', `${member.name}'s mother reference does not point to a female member.`);

    for (const parent of [father, mother]) {
      if (parent?.dob && member.dob) {
        const ageAtBirth = (member.dob.getTime() - parent.dob.getTime()) / (365.2425 * 86400000);
        if (ageAtBirth < 15) issue(errors, 'PARENT_AGE', `${parent.name} appears younger than 15 when ${member.name} was born.`);
        if (ageAtBirth > 75) issue(warnings, 'PARENT_AGE_HIGH', `${parent.name} was over 75 when ${member.name} was born.`);
      }
    }

    if (member.spouseId != null && byMid.has(member.spouseId)) {
      const spouse = byMid.get(member.spouseId);
      if (spouse.spouseId !== member.mid) {
        issue(errors, 'SPOUSE_NOT_RECIPROCAL', `${member.name} (${member.mid}) and ${spouse.name} (${spouse.mid}) do not have reciprocal spouse references.`);
      }
      if (member.anniversary && spouse.anniversary && member.anniversary.getTime() !== spouse.anniversary.getTime()) {
        issue(errors, 'ANNIVERSARY_MISMATCH', `${member.name} and ${spouse.name} have different anniversary dates.`);
      }
    }
  }

  // No contact/photo data is needed for this public synthetic dataset.
  for (const member of members) {
    if (member.mobile || member.email || member.photo) {
      issue(errors, 'CONTACT_OR_PHOTO_PRESENT', `${member.name} (${member.mid}) contains a contact detail or photo URL; the demo workbook should not include these.`);
    }
  }

  // Directed parent->child graph: detect cycles.
  const childrenByParent = new Map(members.map((member) => [member.mid, []]));
  for (const child of members) {
    for (const parentId of [child.fatherId, child.motherId]) {
      if (parentId != null && childrenByParent.has(parentId)) childrenByParent.get(parentId).push(child.mid);
    }
  }
  const color = new Map();
  function visit(mid) {
    color.set(mid, 1);
    for (const childId of childrenByParent.get(mid) || []) {
      if (color.get(childId) === 1) {
        issue(errors, 'PARENT_CYCLE', `Parent-child cycle detected through member ${childId}.`);
      } else if (!color.has(childId)) {
        visit(childId);
      }
    }
    color.set(mid, 2);
  }
  for (const member of members) if (!color.has(member.mid)) visit(member.mid);

  // Compute generation depth from parent pointers.
  const generationMemo = new Map();
  function generationOf(mid, visiting = new Set()) {
    if (generationMemo.has(mid)) return generationMemo.get(mid);
    if (visiting.has(mid)) return 0;
    const person = byMid.get(mid);
    if (!person) return 0;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(mid);
    const parentDepths = [person.fatherId, person.motherId]
      .filter((id) => id != null && byMid.has(id))
      .map((id) => generationOf(id, nextVisiting));
    const depth = (parentDepths.length ? Math.max(...parentDepths) : 0) + 1;
    generationMemo.set(mid, depth);
    return depth;
  }
  for (const member of members) generationOf(member.mid);
  const generationCount = Math.max(0, ...generationMemo.values());
  const expectedGenerations = Number(args['expected-generations']);
  if (generationCount !== expectedGenerations) {
    issue(errors, 'GENERATION_COUNT', `Expected ${expectedGenerations} generations; derived ${generationCount}.`);
  }

  // Eight immediate branches under the fictional founder couple.
  const founderFather = Number(args['founder-father']);
  const founderMother = Number(args['founder-mother']);
  const branchHeads = members.filter((m) => m.fatherId === founderFather && m.motherId === founderMother);
  const expectedBranches = Number(args['expected-branches']);
  if (branchHeads.length !== expectedBranches) {
    issue(errors, 'BRANCH_COUNT', `Expected ${expectedBranches} founder branches; found ${branchHeads.length}.`, {
      branchHeads: branchHeads.map((m) => ({ mid: m.mid, name: m.name })),
    });
  }

  // Undirected kinship BFS from the fixed public demonstration perspective.
  const startMid = Number(args['member-id']);
  if (!byMid.has(startMid)) issue(errors, 'DEMO_MEMBER_MISSING', `Demo perspective member ${startMid} does not exist.`);
  const adjacency = new Map(members.map((m) => [m.mid, new Set()]));
  const edge = (a, b) => {
    if (a == null || b == null || !adjacency.has(a) || !adjacency.has(b)) return;
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  };
  for (const m of members) {
    edge(m.mid, m.fatherId);
    edge(m.mid, m.motherId);
    edge(m.mid, m.spouseId);
  }
  const distances = new Map(byMid.has(startMid) ? [[startMid, 0]] : []);
  const queue = byMid.has(startMid) ? [startMid] : [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const next of adjacency.get(current) || []) {
      if (!distances.has(next)) {
        distances.set(next, distances.get(current) + 1);
        queue.push(next);
      }
    }
  }
  const unreachable = members.filter((m) => !distances.has(m.mid)).map((m) => ({ mid: m.mid, name: m.name }));
  if (unreachable.length) {
    issue(errors, 'DISCONNECTED_GRAPH', `${unreachable.length} member(s) are not reachable from demo member ${startMid}.`, { sample: unreachable.slice(0, 10) });
  }

  // Business and education references must point to existing members.
  const businessKeys = new Set();
  for (const [index, row] of rawBusinesses.entries()) {
    const mid = idValue(row.m_id);
    const bid = clean(row.b_id);
    if (mid == null || !bid) {
      issue(errors, 'BUSINESS_ROW', `Invalid business row ${index + 2}.`);
      continue;
    }
    if (!byMid.has(mid)) issue(errors, 'BUSINESS_ORPHAN', `Business ${bid} references missing member ${mid}.`);
    const key = `${mid}:${bid}`;
    if (businessKeys.has(key)) issue(errors, 'BUSINESS_DUPLICATE', `Duplicate business record ${key}.`);
    businessKeys.add(key);
    const member = byMid.get(mid);
    const birthYear = member?.dob?.getUTCFullYear();
    if (birthYear && snapshotYear - birthYear < 18) {
      issue(errors, 'BUSINESS_AGE', `Business ${bid} is assigned to a member under 18.`);
    }
    if (!clean(row.category) || !clean(row.desc)) issue(errors, 'BUSINESS_DETAILS', `Business ${bid} is missing category or description.`);
  }

  const educationKeys = new Set();
  for (const [index, row] of rawEducation.entries()) {
    const mid = idValue(row.m_id);
    const eid = clean(row.e_id);
    if (mid == null || !eid) {
      issue(errors, 'EDUCATION_ROW', `Invalid education row ${index + 2}.`);
      continue;
    }
    if (!byMid.has(mid)) issue(errors, 'EDUCATION_ORPHAN', `Education ${eid} references missing member ${mid}.`);
    const key = `${mid}:${eid}`;
    if (educationKeys.has(key)) issue(errors, 'EDUCATION_DUPLICATE', `Duplicate education record ${key}.`);
    educationKeys.add(key);
    const member = byMid.get(mid);
    const birthYear = member?.dob?.getUTCFullYear();
    const completionYear = Number(clean(row.Year));
    if (!Number.isInteger(completionYear) || completionYear > snapshotYear || (birthYear && completionYear < birthYear + 16)) {
      issue(errors, 'EDUCATION_YEAR', `Education ${eid} has an implausible year for member ${mid}.`);
    }
    if (!clean(row.Degree_course) || !clean(row.Institution) || !clean(row.Field)) {
      issue(errors, 'EDUCATION_DETAILS', `Education ${eid} is missing degree, institution or field.`);
    }
  }

  const demoMember = byMid.get(startMid);
  const summary = {
    familyId: args.family,
    members: members.length,
    generations: generationCount,
    founderBranches: branchHeads.length,
    businesses: businessKeys.size,
    educations: educationKeys.size,
    demoPerspective: { mid: startMid, name: demoMember?.name ?? null },
    reachableFromDemoPerspective: distances.size,
    connected: unreachable.length === 0 && byMid.has(startMid),
    errors: errors.length,
    warnings: warnings.length,
  };
  const result = { summary, errors, warnings };
  console.log(JSON.stringify(result, null, 2));
  if (args.report) writeFileSync(args.report, JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
}

try {
  run();
} catch (error) {
  console.error(`Validation failed: ${error.message}`);
  process.exitCode = 1;
}
