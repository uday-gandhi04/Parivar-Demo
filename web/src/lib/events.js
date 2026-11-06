export function getFamilyEvents(members) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysEvents = [];
  const upcomingEvents = [];
  const seenAnniversaries = new Set();

  members.forEach(member => {
    if (member.isDeceased) return; // Skip deceased members

    // 1. Process Birthdays
    if (member.dob) {
      const birthDate = new Date(member.dob);
      if (!isNaN(birthDate)) {
        let nextBday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        
        // If birthday passed this year, look at next year
        if (nextBday < today && nextBday.getTime() !== today.getTime()) {
          nextBday.setFullYear(today.getFullYear() + 1);
        }
        
        const turningAge = nextBday.getFullYear() - birthDate.getFullYear();
        const diffDays = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const event = { member, type: 'Birthday', date: nextBday, age: turningAge };
        if (diffDays === 0) todaysEvents.push(event);
        else if (diffDays <= 30) upcomingEvents.push(event);
      }
    }

    // 2. Process Anniversaries
    if (member.anniversary && member.spouseId) {
      const annivDate = new Date(member.anniversary);
      if (!isNaN(annivDate)) {
        // Prevent showing duplicate anniversary entries for husband and wife
        const coupleKey = `${Math.min(member.mid, member.spouseId)}-${Math.max(member.mid, member.spouseId)}`;
        
        if (!seenAnniversaries.has(coupleKey)) {
          seenAnniversaries.add(coupleKey);
          
          let nextAnniv = new Date(today.getFullYear(), annivDate.getMonth(), annivDate.getDate());
          if (nextAnniv < today && nextAnniv.getTime() !== today.getTime()) {
            nextAnniv.setFullYear(today.getFullYear() + 1);
          }
          
          const years = nextAnniv.getFullYear() - annivDate.getFullYear();
          const diffDays = Math.ceil((nextAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          const spouse = members.find(m => m.mid === member.spouseId);
          const spouseName = spouse ? spouse.name.split(' ')[0] : 'their spouse';
          const primaryName = member.name.split(' ')[0];

          const event = {
            member,
            title: `${primaryName} & ${spouseName}`,
            type: 'Anniversary',
            date: nextAnniv,
            age: years
          };
          
          if (diffDays === 0) todaysEvents.push(event);
          else if (diffDays <= 30) upcomingEvents.push(event);
        }
      }
    }
  });

  // Sort upcoming chronologically
  upcomingEvents.sort((a, b) => a.date - b.date);

  return { todaysEvents, upcomingEvents };
}