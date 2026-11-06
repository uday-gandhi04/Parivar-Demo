// Table structure: Map<pathKey, entry[]>
// entry = { hi, en, focusGender? }
//   focusGender — only set when the label differs based on the viewer's gender.
//   Most entries omit it (label is the same regardless of viewer gender).
//
// Lookup order for a given key + focusGender:
//   1. entry.focusGender === focusGender  (gender-specific match)
//   2. entry.focusGender is undefined     (gender-neutral fallback)
//   3. no entry → null

function t(hi, en, focusGender) {
  return focusGender ? { hi, en, focusGender } : { hi, en };
}

const RAW = [
  // ── Direct ancestors ──────────────────────────────────────────
  ['F',     [t('Pitaji',  'Father')]],
  ['M',     [t('Mataji',  'Mother')]],
  ['F.F',   [t('Dadaji',  'Paternal Grandfather')]],
  ['F.M',   [t('Dadi',    'Paternal Grandmother')]],
  ['M.F',   [t('Nanaji',  'Maternal Grandfather')]],
  ['M.M',   [t('Nani',    'Maternal Grandmother')]],
  ['F.F.F', [t('Pardadaji', 'Paternal Great-Grandfather')]],
  ['F.F.M', [t('Pardadi',   'Paternal Great-Grandmother')]],
  ['M.F.F', [t('Parnanaji', 'Maternal Great-Grandfather')]],
  ['M.F.M', [t('Parnani',   'Maternal Great-Grandmother')]],
  ['M.M.F', [t('Parnana',   "Mother's Maternal Grandfather")]],
  ['M.M.M', [t('Parnani',   "Mother's Maternal Grandmother")]],

  // ── Siblings ──────────────────────────────────────────────────
  ['SIB:M',         [t('Bhai',        'Brother')]],
  ['SIB:M:elder',   [t('Bada Bhai',   'Elder Brother')]],
  ['SIB:M:younger', [t('Chota Bhai',  'Younger Brother')]],
  ['SIB:F',         [t('Behen',       'Sister')]],
  ['SIB:F:elder',   [t('Badi Behen',  'Elder Sister')]],
  ['SIB:F:younger', [t('Choti Behen', 'Younger Sister')]],

  // ── Sibling's spouse ──────────────────────────────────────────
  ['SIB:M.S', [t('Bhabhi', "Brother's Wife")]],
  ['SIB:F.S', [t('Jijaji', "Sister's Husband")]],

  // ── Nieces and nephews ────────────────────────────────────────
  ['SIB:M.CHILD:M', [t('Bhatija', "Brother's Son")]],
  ['SIB:M.CHILD:F', [t('Bhatiji', "Brother's Daughter")]],
  ['SIB:F.CHILD:M', [t('Bhanja',  "Sister's Son")]],
  ['SIB:F.CHILD:F', [t('Bhanji',  "Sister's Daughter")]],

  // ── Direct descendants ────────────────────────────────────────
  ['CHILD:M', [t('Beta', 'Son')]],
  ['CHILD:F', [t('Beti', 'Daughter')]],
  ['CHILD:M.CHILD:M', [t('Pota',  "Grandson (son's son)")]],
  ['CHILD:M.CHILD:F', [t('Poti',  "Granddaughter (son's daughter)")]],
  ['CHILD:F.CHILD:M', [t('Nati',  "Grandson (daughter's son)")]],
  ['CHILD:F.CHILD:F', [t('Natin', "Granddaughter (daughter's daughter)")]],
  ['CHILD:M.CHILD:M.CHILD:M', [t('Parpota',  "Great-grandson (via son)")]],
  ['CHILD:M.CHILD:M.CHILD:F', [t('Parpoti',  "Great-granddaughter (via son)")]],
  ['CHILD:F.CHILD:F.CHILD:M', [t('Parnati',  "Great-grandson (via daughter)")]],
  ['CHILD:F.CHILD:F.CHILD:F', [t('Parnatin', "Great-granddaughter (via daughter)")]],

  // ── Paternal aunts / uncles ───────────────────────────────────
  ['F.SIB:M',         [t('Chacha', "Father's Brother")]],
  ['F.SIB:M:elder',   [t('Bade Papa',  "Father's Elder Brother")]],
  ['F.SIB:M:younger', [t('Chacha', "Father's Younger Brother")]],
  ['F.SIB:F',         [t('Bua',    "Father's Sister")]],
  ['F.SIB:M.S',         [t('Chachi', "Chacha's Wife")]],
  ['F.SIB:M:elder.S',   [t('Badi Ma',  "Bade Papa's Wife")]],
  ['F.SIB:M:younger.S', [t('Chachi', "Chacha's Wife")]],
  ['F.SIB:F.S',         [t('Phupha', "Bua's Husband")]],

  // ── Maternal aunts / uncles ───────────────────────────────────
  ['M.SIB:M',   [t('Mama',  "Mother's Brother")]],
  ['M.SIB:F',   [t('Mausi', "Mother's Sister")]],
  ['M.SIB:M.S', [t('Mami',  "Mama's Wife")]],
  ['M.SIB:F.S', [t('Mausa', "Mausi's Husband")]],

  // ── First cousins ─────────────────────────────────────────────
  ['F.SIB:M:elder.CHILD:M', [t('Bada Bhai', 'Cousin (Paternal Older)')]],
  ['F.SIB:M:elder.CHILD:F', [t('Bada Bhai', 'Cousin (Paternal Older)')]],
  ['F.SIB:M:younger.CHILD:M', [t('Chachera Bhai', 'Cousin (Paternal Younger)')]],
  ['F.SIB:M:younger.CHILD:F', [t('Chachera Behen', 'Cousin (Paternal Younger)')]],
  ['F.SIB:M.CHILD:M', [t('Chachera Bhai',  'Paternal Cousin (M)')]],
  ['F.SIB:M.CHILD:F', [t('Chacheri Behen', 'Paternal Cousin (F)')]],
  ['F.SIB:F.CHILD:M', [t('Phuphera Bhai',  'Bua-side Cousin (M)')]],
  ['F.SIB:F.CHILD:F', [t('Phupheri Behen', 'Bua-side Cousin (F)')]],
  ['M.SIB:M.CHILD:M', [t('Mamera Bhai',    'Mama-side Cousin (M)')]],
  ['M.SIB:M.CHILD:F', [t('Mameri Behen',   'Mama-side Cousin (F)')]],
  ['M.SIB:F.CHILD:M', [t('Mausera Bhai',   'Mausi-side Cousin (M)')]],
  ['M.SIB:F.CHILD:F', [t('Mauseri Behen',  'Mausi-side Cousin (F)')]],

  // ── Grand-aunts / uncles ──────────────────────────────────────
  ['F.F.SIB:F',   [t('Bua-Dadi',    "Grandfather's Sister")]],
  ['F.F.SIB:M',   [t('Chacha-Dada', "Grandfather's Brother")]],
  ['F.F.SIB:F.S', [t('Phupha-Dada', "Bua-Dadi's Husband")]],
  ['F.F.SIB:M.S', [t('Chachi-Dadi', "Chacha-Dada's Wife")]],
  ['M.F.SIB:M',   [t('Nana-Chacha', "Maternal Grandfather's Brother")]],
  ['M.F.SIB:F',   [t('Nana-Bua',    "Maternal Grandfather's Sister")]],
  ['M.M.SIB:M',   [t('Nani-Chacha', "Maternal Grandmother's Brother")]],
  ['M.M.SIB:F',   [t('Nani-Bua',    "Maternal Grandmother's Sister")]],
  ['F.M.SIB:M',   [t('Mama-Dadi',   "Paternal Grandmother's Brother")]],
  ['F.M.SIB:F',   [t('Mausi-Dadi',  "Paternal Grandmother's Sister")]],

  // ── Father's first cousins ────────────────────────────────────
  ['F.F.SIB:F.CHILD:M', [t('Phuphera Chacha', "Bua-Dadi's Son")]],
  ['F.F.SIB:F.CHILD:F', [t('Phupheri Bua',    "Bua-Dadi's Daughter")]],
  ['F.F.SIB:M.CHILD:M', [t('Chachera Chacha', "Chacha-Dada's Son")]],
  ['F.F.SIB:M.CHILD:F', [t('Chacheri Bua',    "Chacha-Dada's Daughter")]],
  ['M.F.SIB:M.CHILD:M', [t('Mamera Mama',     "Nana-Chacha's Son")]],
  ['M.F.SIB:M.CHILD:F', [t('Mameri Mausi',    "Nana-Chacha's Daughter")]],

  // ── In-laws: parents of spouse (same regardless of focus gender) ──
  ['S.F', [t('Sasurji', 'Father-in-Law')]],
  ['S.M', [t('Saasuji', 'Mother-in-Law')]],
  ['S.F.F', [t('Pardada-Sasur', "Spouse's Paternal Grandfather")]],
  ['S.F.M', [t('Pardadi-Saas',  "Spouse's Paternal Grandmother")]],
  ['S.M.F', [t('Parnana-Sasur', "Spouse's Maternal Grandfather")]],
  ['S.M.M', [t('Parnani-Saas',  "Spouse's Maternal Grandmother")]],

  // ── In-laws: siblings of spouse (label depends on focus gender) ──
  // Male focus (viewing wife's family)
  ['S.SIB:M', [
    t('Saala',       "Wife's Brother",         'M'),
    t('Jeth/Devar',  "Husband's Brother",       'F'),
    t('Saala/Devar', "Spouse's Brother"),          // neutral fallback
  ]],
  ['S.SIB:M:elder', [
    t('Saala',  "Wife's Elder Brother",        'M'),
    t('Jeth',   "Husband's Elder Brother",     'F'),
    t('Jeth/Saala', "Spouse's Elder Brother"),
  ]],
  ['S.SIB:M:younger', [
    t('Saala',  "Wife's Younger Brother",      'M'),
    t('Devar',  "Husband's Younger Brother",   'F'),
    t('Devar/Saala', "Spouse's Younger Brother"),
  ]],
  ['S.SIB:F', [
    t('Saali',  "Wife's Sister",               'M'),
    t('Nanad',  "Husband's Sister",            'F'),
    t('Saali/Nanad', "Spouse's Sister"),
  ]],

  // ── In-laws: spouse's sibling's spouse ───────────────────────
  ['S.SIB:M.S', [
    t('Sarhaj',        "Wife's Brother's Wife",         'M'),
    t('Devrani/Jethani', "Husband's Brother's Wife",    'F'),
    t("Spouse's Brother's Wife", "Spouse's Brother's Wife"),
  ]],
  ['S.SIB:M:elder.S', [
    t('Sarhaj',   "Wife's Elder Brother's Wife",        'M'),
    t('Jethani',  "Jeth's Wife",                        'F'),
    t('Jethani/Sarhaj', "Spouse's Elder Brother's Wife"),
  ]],
  ['S.SIB:M:younger.S', [
    t('Sarhaj',   "Wife's Younger Brother's Wife",      'M'),
    t('Devrani',  "Devar's Wife",                       'F'),
    t('Devrani/Sarhaj', "Spouse's Younger Brother's Wife"),
  ]],
  ['S.SIB:F.S', [
    t('Sadhu',   "Wife's Sister's Husband",             'M'),
    t('Nandoi',  "Husband's Sister's Husband",          'F'),
    t("Spouse's Sister's Husband", "Spouse's Sister's Husband"),
  ]],
];

export const KINSHIP_TABLE = new Map(RAW);
