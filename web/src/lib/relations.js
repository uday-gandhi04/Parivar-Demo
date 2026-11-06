import { KINSHIP_TABLE } from './kinship-table.js';

// ── Gender inference ──────────────────────────────────────────────────────────

function buildGenderMap(members) {
  const g = new Map();

  for (const m of members) {
    if (m.gender === 'M' || m.gender === 'F') g.set(m.mid, m.gender);
  }

  for (const m of members) {
    if (g.has(m.mid)) continue;
    if (m.fatherId != null) g.set(m.fatherId, 'M');
    if (m.motherId != null) g.set(m.motherId, 'F');
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const m of members) {
      if (g.has(m.mid)) continue;
      if (m.spouseId != null && g.has(m.spouseId)) {
        g.set(m.mid, g.get(m.spouseId) === 'M' ? 'F' : 'M');
      }
    }
  }

  return g;
}

// ── BFS Traversal ─────────────────────────────────────────────────────────────

const BFS_DEPTH_LIMIT = 12;

export function computePaths(fromMid, members, allMembersForGender = null) {
  const membersMap = new Map(members.map((m) => [m.mid, m]));
  const genderMap = buildGenderMap(allMembersForGender ?? members);

  const childrenOf = new Map();
  for (const m of members) {
    for (const pid of [m.fatherId, m.motherId]) {
      if (pid == null) continue;
      if (!childrenOf.has(pid)) childrenOf.set(pid, new Set());
      childrenOf.get(pid).add(m.mid);
    }
  }

  const paths = new Map(); 
  paths.set(fromMid, { path: [], mids: [fromMid] });
  const queue = [{ mid: fromMid, path: [], mids: [fromMid] }];

  while (queue.length > 0) {
    const { mid, path, mids } = queue.shift();
    if (path.length >= BFS_DEPTH_LIMIT) continue;

    const m = membersMap.get(mid);
    if (!m) continue;

    const enqueue = (targetMid, token) => {
      if (paths.has(targetMid)) return;
      const newPath = [...path, token];
      const newMids = [...mids, targetMid];
      paths.set(targetMid, { path: newPath, mids: newMids });
      queue.push({ mid: targetMid, path: newPath, mids: newMids });
    };

    if (m.fatherId != null) enqueue(m.fatherId, 'F');
    if (m.motherId != null) enqueue(m.motherId, 'M');
    if (m.spouseId != null) enqueue(m.spouseId, 'S');

    const sibMids = new Set();
    for (const pid of [m.fatherId, m.motherId]) {
      if (pid == null) continue;
      for (const sib of (childrenOf.get(pid) ?? [])) {
        if (sib !== mid) sibMids.add(sib);
      }
    }
    for (const sibMid of sibMids) {
      if (paths.has(sibMid)) continue;
      const sibMember = membersMap.get(sibMid);
      if (!sibMember) continue;
      const gender = genderMap.get(sibMid);
      if (!gender) continue;
      const siblingAnchorDob = m.dob;
      const ageToken = ageModifier(sibMember.dob, siblingAnchorDob);
      enqueue(sibMid, `SIB:${gender}${ageToken}`);
    }

    for (const childMid of (childrenOf.get(mid) ?? [])) {
      if (paths.has(childMid)) continue;
      const gender = genderMap.get(childMid);
      if (!gender) continue;
      enqueue(childMid, `CHILD:${gender}`);
    }
  }

  return paths;
}

function ageModifier(targetDob, currentDob) {
  if (!targetDob || !currentDob) return '';
  const td = new Date(targetDob).getTime();
  const cd = new Date(currentDob).getTime();
  if (isNaN(td) || isNaN(cd)) return '';
  if (td < cd) return ':elder';
  if (td > cd) return ':younger';
  return '';
}

// ── Core Kinship Engine ───────────────────────────────────────────────────────

function pickEntry(entries, focusGender) {
  if (!entries?.length) return null;
  if (focusGender) {
    const specific = entries.find((e) => e.focusGender === focusGender);
    if (specific) return specific;
  }
  return entries.find((e) => !e.focusGender) ?? null;
}

function lookupLabel(path, targetMid, genderMap, focusGender) {
  if (path.length === 1 && path[0] === 'S') {
    const g = genderMap.get(targetMid);
    if (g === 'M') return { hi: 'Pati', en: 'Husband' };
    if (g === 'F') return { hi: 'Patni', en: 'Wife' };
    return { hi: 'Pati / Patni', en: 'Spouse' };
  }

  const key = path.join('.');
  const exact = pickEntry(KINSHIP_TABLE.get(key), focusGender);
  if (exact) return { hi: exact.hi, en: exact.en };

  const stripped = key.replace(/:(elder|younger)/g, '');
  if (stripped !== key) {
    const fallback = pickEntry(KINSHIP_TABLE.get(stripped), focusGender);
    if (fallback) return { hi: fallback.hi, en: fallback.en };
  }

  return null;
}

// THE FIX: Adding `focusGender` and Directional Spouse Checks
function calculateMathematicalKinship(path, targetMid, genderMap, mids, focusGender) {
  let genDelta = 0;
  let signature = [];
  let hasSpouseHop = false;

  for (let i = 0; i < path.length; i++) {
    const token = path[i];
    const hopTargetMid = mids[i + 1];
    const hopTargetGender = genderMap.get(hopTargetMid) || 'M';

    const base = token.replace(/:(elder|younger)$/, '');
    
    if (base === 'F') { genDelta += 1; signature.push('F'); }
    else if (base === 'M') { genDelta += 1; signature.push('M'); }
    else if (base === 'S') { hasSpouseHop = true; signature.push(hopTargetGender === 'M' ? 'H' : 'W'); }
    else if (base === 'SIB:M') { signature.push('B'); }
    else if (base === 'SIB:F') { signature.push('Z'); }
    else if (base === 'CHILD:M') { genDelta -= 1; signature.push('S'); }
    else if (base === 'CHILD:F') { genDelta -= 1; signature.push('D'); }
  }

  const isMale = genderMap.get(targetMid) === 'M';

  // Determine branch side
  let side = 'fallback';
  if (path.length > 0) {
    const firstStep = path[0].replace(/:(elder|younger)$/, '');
    if (firstStep === 'F') side = 'paternal';
    else if (firstStep === 'M') side = 'maternal';
    else if (firstStep === 'S') side = 'inlaw';
  }

  let mathFallback = { hi: isMale ? 'Door ka Rishtedaar' : 'Door ki Rishtedaar', en: isMale ? 'Distant Relative (M)' : 'Distant Relative (F)' };

  if (genDelta === 2) {
    if (isMale) mathFallback = side === 'maternal' ? { hi: 'Nana ji / Pardada', en: 'Maternal Grandfather' } : { hi: 'Dada ji / Pardada', en: 'Paternal Grandfather' };
    else mathFallback = side === 'maternal' ? { hi: 'Nani ji / Pardadi', en: 'Maternal Grandmother' } : { hi: 'Dadi ji / Pardadi', en: 'Paternal Grandmother' };
  } 
  else if (genDelta === 1) {
    if (hasSpouseHop) {
      if (isMale) {
        if (side === 'paternal') mathFallback = { hi: 'Phupha ji', en: 'Uncle (Bua\'s Husband)' };
        else if (side === 'maternal') mathFallback = { hi: 'Mausa ji', en: 'Uncle (Mausi\'s Husband)' };
        else mathFallback = { hi: 'Phupha / Mausa', en: 'Uncle (In-law)' };
      } else {
        if (side === 'paternal') mathFallback = { hi: 'Chachi / Tai ji', en: 'Aunt (Chacha\'s Wife)' };
        else if (side === 'maternal') mathFallback = { hi: 'Mami ji', en: 'Aunt (Mama\'s Wife)' };
        else mathFallback = { hi: 'Chachi / Mami', en: 'Aunt (In-law)' };
      }
    } else {
      if (isMale) {
        if (side === 'paternal') mathFallback = { hi: 'Chacha / Tau ji', en: 'Paternal Uncle' };
        else if (side === 'maternal') mathFallback = { hi: 'Mama ji', en: 'Maternal Uncle' };
        else mathFallback = { hi: 'Chacha / Mama', en: 'Uncle' };
      } else {
        if (side === 'paternal') mathFallback = { hi: 'Bua ji', en: 'Paternal Aunt' };
        else if (side === 'maternal') mathFallback = { hi: 'Mausi ji', en: 'Maternal Aunt' };
        else mathFallback = { hi: 'Bua / Mausi', en: 'Aunt' };
      }
    }
  } 
  else if (genDelta === 0) {
    if (hasSpouseHop) {
      const startsWithSpouse = path[0] === 'S';
      const endsWithSpouse = path[path.length - 1] === 'S';

      if (startsWithSpouse && endsWithSpouse && path.length > 1) {
        // Spouse's Sibling's Spouse (e.g. Wife's Sister's Husband -> Sadhu)
        if (isMale) {
          mathFallback = focusGender === 'F' ? { hi: 'Nandoi', en: 'Brother-in-law' } : { hi: 'Saadhu', en: 'Brother-in-law' };
        } else {
          mathFallback = focusGender === 'F' ? { hi: 'Devrani / Jethani', en: 'Sister-in-law' } : { hi: 'Sarhaj', en: 'Sister-in-law' };
        }
      } else if (endsWithSpouse) {
        // Blood relative's spouse (e.g. Cousin Sister's Husband -> Jijaji)
        mathFallback = { hi: isMale ? 'Jijaji' : 'Bhabhi', en: isMale ? 'Brother-in-law' : 'Sister-in-law' };
      } else if (startsWithSpouse) {
        // Spouse's blood relative (e.g. Wife's Cousin Brother -> Saala)
        if (isMale) {
          mathFallback = focusGender === 'F' ? { hi: 'Devar / Jeth', en: 'Brother-in-law' } : { hi: 'Saala', en: 'Brother-in-law' };
        } else {
          mathFallback = focusGender === 'F' ? { hi: 'Nanad', en: 'Sister-in-law' } : { hi: 'Saali', en: 'Sister-in-law' };
        }
      } else {
        mathFallback = { hi: isMale ? 'Brother-in-law' : 'Sister-in-law', en: isMale ? 'Brother-in-law' : 'Sister-in-law' };
      }
    } else {
      mathFallback = { hi: isMale ? 'Cousin Bhai' : 'Cousin Behen', en: isMale ? 'Cousin Brother' : 'Cousin Sister' };
    }
  } 
  else if (genDelta === -1) {
    if (hasSpouseHop) {
      mathFallback = { hi: isMale ? 'Damaad' : 'Bahu', en: isMale ? 'Son-in-law' : 'Daughter-in-law' };
    } else {
      if (isMale) {
        if (side === 'paternal') mathFallback = { hi: 'Bhatija', en: 'Nephew (Paternal)' };
        else if (side === 'maternal') mathFallback = { hi: 'Bhanja', en: 'Nephew (Maternal)' };
        else mathFallback = { hi: 'Bhatija / Bhanja', en: 'Nephew' };
      } else {
        if (side === 'paternal') mathFallback = { hi: 'Bhatiji', en: 'Niece (Paternal)' };
        else if (side === 'maternal') mathFallback = { hi: 'Bhanji', en: 'Niece (Maternal)' };
        else mathFallback = { hi: 'Bhatiji / Bhanji', en: 'Niece' };
      }
    }
  } 
  else if (genDelta === -2) {
    if (isMale) {
      if (side === 'maternal') mathFallback = { hi: 'Nati', en: 'Grandson (Maternal)' };
      else mathFallback = { hi: 'Pota', en: 'Grandson (Paternal)' };
    } else {
      if (side === 'maternal') mathFallback = { hi: 'Natni', en: 'Granddaughter (Maternal)' };
      else mathFallback = { hi: 'Poti', en: 'Granddaughter (Paternal)' };
    }
  }
  else if (genDelta > 2) {
    mathFallback = { hi: isMale ? 'Purvaj' : 'Purvaj', en: isMale ? 'Male Ancestor' : 'Female Ancestor' };
  }
  else if (genDelta < -2) {
    mathFallback = { hi: isMale ? 'Vanshaj' : 'Vanshaj', en: isMale ? 'Male Descendant' : 'Female Descendant' };
  }

  return { ...mathFallback, genDelta, signature: signature.join('-') };
}

function composeLabel(path, targetMid, genderMap, focusGender, mids = null) {
  const direct = lookupLabel(path, targetMid, genderMap, focusGender);
  if (direct) return direct;

  if (mids) {
    // Pass focusGender to fallback so we know if viewer is Male/Female for Saala vs Jeth
    const mathRes = calculateMathematicalKinship(path, targetMid, genderMap, mids, focusGender);
    return { hi: mathRes.hi, en: mathRes.en };
  }

  return { hi: 'Door ke Rishtedaar', en: 'Distant Relative' };
}

// ── Single-hop labels ─────────────────────────────────────────────────────────

const HOP_LABELS = {
  F:          { hi: 'Pita',       en: 'father' },
  M:          { hi: 'Mata',       en: 'mother' },
  'SIB:M':    { hi: 'Bhai',       en: 'brother' },
  'SIB:F':    { hi: 'Behen',      en: 'sister' },
  'CHILD:M':  { hi: 'Beta',       en: 'son' },
  'CHILD:F':  { hi: 'Beti',       en: 'daughter' },
};

function hopLabelFor(token, toMid, genderMap) {
  if (token === 'S') {
    const g = genderMap.get(toMid);
    if (g === 'M') return { hi: 'Pati',       en: 'husband' };
    if (g === 'F') return { hi: 'Patni',      en: 'wife' };
    return               { hi: 'Pati/Patni', en: 'spouse' };
  }
  const base = token.replace(/:(elder|younger)$/, '');
  return HOP_LABELS[base] ?? { hi: base, en: base };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getRelationPath(fromMid, toMid, allMembers) {
  const membersMap = new Map(allMembers.map((m) => [m.mid, m]));
  const genderMap = buildGenderMap(allMembers);

  const paths = computePaths(fromMid, allMembers, allMembers);
  if (!paths.has(toMid)) return null;

  const { path: tokens, mids } = paths.get(toMid);
  const focusGender = genderMap.get(fromMid) ?? null;
  const relation = composeLabel(tokens, toMid, genderMap, focusGender, mids);

  const hops = tokens.map((token, i) => ({
    fromMember: membersMap.get(mids[i]),
    toMember:   membersMap.get(mids[i + 1]),
    hopLabel:   hopLabelFor(token, mids[i + 1], genderMap),
    hopType:    token.replace(/:(elder|younger)$/, ''),
  }));

  return { relation, hops };
}

export function buildRelationMap(fromMid, members, allMembersForGender = null) {
  const paths = computePaths(fromMid, members, allMembersForGender);
  const genderMap = buildGenderMap(allMembersForGender ?? members);
  const focusGender = genderMap.get(fromMid) ?? null;
  const result = new Map();

  for (const [mid, data] of paths) {
    if (mid === fromMid) {
      result.set(mid, { path: [], label: null, distance: 0, genDelta: 0 });
      continue;
    }
    
    // Pass focusGender down so the calculator knows if the logged-in user is Male or Female
    const mathRes = calculateMathematicalKinship(data.path, mid, genderMap, data.mids, focusGender);
    const label = composeLabel(data.path, mid, genderMap, focusGender, data.mids);
    
    result.set(mid, { 
      path: data.path, 
      label,
      distance: data.path.length,
      genDelta: mathRes.genDelta 
    });
  }

  return result;
}

export function getRelation(fromMid, toMid, members) {
  return buildRelationMap(fromMid, members).get(toMid)?.label ?? null;
}

// ── Tier classification ───────────────────────────────────────────────────────

const TIERS = [
  { key: 'siblings',       label: 'Siblings',                  test: (p) => p.length === 1 && p[0].startsWith('SIB:') },
  { key: 'grandparents',   label: 'Grandparents',              test: (p) => p.length === 2 && /^[FM]$/.test(p[0]) && /^[FM]$/.test(p[1]) },
  { key: 'greatgrand',     label: 'Great-grandparents',        test: (p) => p.length === 3 && p.every((t) => /^[FM]$/.test(t)) },
  { key: 'cousins',        label: 'Cousins',                   test: (p) => p.length === 3 && /^[FM]$/.test(p[0]) && p[1].startsWith('SIB:') && p[2].startsWith('CHILD:') },
  { key: 'unclesaunts',    label: 'Uncles & Aunts',            test: (p) => (p.length === 2 || p.length === 3) && /^[FM]$/.test(p[0]) && p[1].startsWith('SIB:') },
  { key: 'fatherscousins', label: "Father's/Mother's generation cousins", test: (p) => p.length === 4 && /^[FM]$/.test(p[0]) && /^[FM]$/.test(p[1]) && p[2].startsWith('SIB:') && p[3].startsWith('CHILD:') },
  { key: 'grandrelatives', label: 'Grand-relatives',           test: (p) => (p.length === 3 || p.length === 4) && /^[FM]$/.test(p[0]) && /^[FM]$/.test(p[1]) && p[2].startsWith('SIB:') },
  { key: 'inlaws',         label: 'In-laws',                   test: (p) => p[0] === 'S' && p.length > 1 },
];

export function classifyTier(path) {
  for (const tier of TIERS) {
    if (tier.test(path)) return tier.key;
  }
  return 'other';
}

export const TIER_ORDER = TIERS.map((t) => t.key).concat('other');
export const TIER_LABELS = Object.fromEntries(TIERS.map((t) => [t.key, t.label]));