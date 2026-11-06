export function getConciseRelation(longString, targetMember = null, perspectiveMember = null, allMembers = []) {
  if (!longString) return "";

  let concise = longString;

  // =========================================================================
  // 1. DYNAMIC AGE-BASED REPLACEMENTS
  // =========================================================================
  let isOlderThanParent = null; 

  if (targetMember?.dob && perspectiveMember) {
    let parentDob = null;
    const fatherId = perspectiveMember.fatherId || perspectiveMember.father_id || perspectiveMember.relations?.father?.mid;
    
    if (fatherId && allMembers?.length > 0) {
      const father = allMembers.find(m => m.mid === fatherId || m.id === fatherId);
      if (father?.dob) parentDob = father.dob;
    }

    if (parentDob) {
      isOlderThanParent = new Date(targetMember.dob) < new Date(parentDob);
    } else if (perspectiveMember.dob) {
      const estParentYear = new Date(perspectiveMember.dob).getFullYear() - 26;
      const targetYear = new Date(targetMember.dob).getFullYear();
      isOlderThanParent = targetYear < estParentYear;
    }

    if (isOlderThanParent === true) {
      concise = concise.replace(/Chacha ji/gi, "Bade Papa")
                       .replace(/Chacha/gi, "Bade Papa")
                       .replace(/Chachi ji/gi, "Badi Mummy")
                       .replace(/Chachi/gi, "Badi Mummy");
    } else if (isOlderThanParent === false) {
      concise = concise.replace(/Tau ji/gi, "Chacha ji")
                       .replace(/Tau/gi, "Chacha")
                       .replace(/Tai ji/gi, "Chachi ji")
                       .replace(/Tai/gi, "Chachi");
    }
  }

  // =========================================================================
  // 2. STATIC DICTIONARY OVERRIDES 
  // =========================================================================
  concise = concise.replace(/Tayera Bhai/gi, "Bada Bhai")
                   .replace(/Tayeri Behen/gi, "Badi Behen")
                   .replace(/Tau ji/gi, "Bade Papa")
                   .replace(/Tau/gi, "Bade Papa")
                   .replace(/Tai ji/gi, "Badi Mummy")
                   .replace(/Tai/gi, "Badi Mummy");

  // =========================================================================
  // 3. RELATION COMBINERS (Fixing "ka Pati" / "ki Patni" translations)
  // =========================================================================
  // Catches 1-hop marital extensions from the backend and assigns correct Hindi terms
  concise = concise.replace(/Bua-Saas ka Pati/gi, "Phupha ji")
                   .replace(/Sasur ki Behen ka Pati/gi, "Phupha ji")
                   .replace(/Bua ka Pati/gi, "Phupha ji")
                   .replace(/Pita ki Behen ka Pati/gi, "Phupha ji")
                   .replace(/Mausi-Saas ka Pati/gi, "Mausa ji")
                   .replace(/Saas ki Behen ka Pati/gi, "Mausa ji")
                   .replace(/Mausi ka Pati/gi, "Mausa ji")
                   .replace(/Mata ki Behen ka Pati/gi, "Mausa ji")
                   .replace(/Behen ka Pati/gi, "Jija ji")
                   .replace(/Bhai ki Patni/gi, "Bhabhi")
                   .replace(/Beta ki Patni/gi, "Bahu")
                   .replace(/Beti ka Pati/gi, "Damad")
                   .replace(/Mama ki Patni/gi, "Mami ji")
                   .replace(/Chacha ki Patni/gi, "Chachi ji")
                   .replace(/Bade Papa ki Patni/gi, "Badi Mummy");

  // =========================================================================
  // 4. THE GATEKEEPERS (Protecting strings from the Math Block)
  // =========================================================================
  const lowerStr = concise.toLowerCase();
  
  // Gatekeeper A: No "ka/ki/ke" chaining means it's already concise.
  if (!lowerStr.includes(" ka ") && !lowerStr.includes(" ki ") && !lowerStr.includes(" ke ")) {
    return concise;
  }

  // Gatekeeper B: The In-Law Protector. 
  // If the string contains marriage/in-law words, the Math Block will ruin it.
  // We return the string now so it remains accurate (e.g., "Saas ka Bhai" stays "Saas ka Bhai").
  const marriageWords = ["pati", "patni", "saas", "sasur", "damad", "bahu", "jija", "bhabhi", "phupha", "mausa"];
  if (marriageWords.some(w => lowerStr.includes(w))) {
    return concise;
  }

  // =========================================================================
  // 5. MATH-BASED GENERATION COMPRESSION (For purely bloodline chains)
  // =========================================================================
  let level = 0;
  let finalGender = 'unknown'; 
  let isMaternal = false; 
  let matchedSignificantWords = 0;
  
  const words = lowerStr.replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  const levelMap = {
    'pita': { l: 1, g: 'm' }, 'father': { l: 1, g: 'm' }, 'papa': { l: 1, g: 'm' },
    'mata': { l: 1, g: 'f', maternal: true }, 'mother': { l: 1, g: 'f', maternal: true }, 'mummy': { l: 1, g: 'f' },
    'beta': { l: -1, g: 'm' }, 'son': { l: -1, g: 'm' },
    'beti': { l: -1, g: 'f' }, 'daughter': { l: -1, g: 'f' },
    'bhai': { l: 0, g: 'm' }, 'brother': { l: 0, g: 'm' },
    'behen': { l: 0, g: 'f' }, 'sister': { l: 0, g: 'f' },
    'dada': { l: 2, g: 'm' }, 'dadaji': { l: 2, g: 'm' }, 
    'dadi': { l: 2, g: 'f' }, 'dadiji': { l: 2, g: 'f' }, 
    'nana': { l: 2, g: 'm', maternal: true }, 'nanaji': { l: 2, g: 'm', maternal: true },
    'nani': { l: 2, g: 'f', maternal: true }, 'naniji': { l: 2, g: 'f', maternal: true },
    'pardada': { l: 3, g: 'm' }, 'pardadaji': { l: 3, g: 'm' },
    'pardadi': { l: 3, g: 'f' }, 'pardadiji': { l: 3, g: 'f' },
    'pota': { l: -2, g: 'm' }, 'poti': { l: -2, g: 'f' },
    'parpota': { l: -3, g: 'm' }, 'parpoti': { l: -3, g: 'f' }
  };

  for (const word of words) {
    if (levelMap[word]) {
      level += levelMap[word].l;
      finalGender = levelMap[word].g;
      if (levelMap[word].maternal) isMaternal = true;
      matchedSignificantWords++;
    }
  }

  if (matchedSignificantWords === 0) return concise;

  let mathConcise = concise; 

  if (level === 0) {
    mathConcise = finalGender === 'm' ? "Bhai" : (finalGender === 'f' ? "Behen" : "Cousin");
    if (matchedSignificantWords > 3) mathConcise = `Dur ka ${mathConcise}`;
  } else if (level === 1) {
    if (finalGender === 'm') {
      if (isMaternal) mathConcise = "Mama ji";
      else if (isOlderThanParent === true) mathConcise = "Bade Papa";
      else if (isOlderThanParent === false) mathConcise = "Chacha ji";
      else mathConcise = "Chacha / Bade Papa";
    } else if (finalGender === 'f') {
      if (isMaternal) mathConcise = "Mausi ji";
      else if (isOlderThanParent === true) mathConcise = "Badi Mummy";
      else if (isOlderThanParent === false) mathConcise = "Chachi ji";
      else mathConcise = "Chachi / Badi Mummy";
    }
  } else if (level === -1) {
    mathConcise = finalGender === 'm' ? "Bhatija / Bhanja" : (finalGender === 'f' ? "Bhatiji / Bhanji" : "Nephew/Niece");
  } else if (level === 2) {
    if (finalGender === 'm') mathConcise = isMaternal ? "Nana ji" : "Dada ji";
    else if (finalGender === 'f') mathConcise = isMaternal ? "Nani ji" : "Dadi ji";
  } else if (level === -2) {
     mathConcise = finalGender === 'm' ? "Pota / Nati" : "Poti / Natin";
  } else if (level >= 3) {
     mathConcise = finalGender === 'm' ? "Pardada ji / Purvaj" : "Pardadi ji / Purvaj";
  } else if (level <= -3) {
     mathConcise = finalGender === 'm' ? "Parpota (Descendant)" : "Parpoti (Descendant)";
  }

  return mathConcise;
}