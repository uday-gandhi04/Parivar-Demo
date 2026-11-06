function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberAvatar({ member, size = 'md', highlight = false, onClick }) {
  const isDeceased = member?.isDeceased;
  const classes = [
    'parivar-avatar',
    `size-${size}`,
    isDeceased ? 'deceased' : '',
    highlight ? 'highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (member?.photoUrl) {
    return (
      <img
        src={member.photoUrl}
        alt={member?.name || 'Member'}
        className={classes}
        title={member?.name}
        onClick={onClick}
        style={{ objectFit: 'cover', cursor: onClick ? 'pointer' : 'default' }}
      />
    );
  }

  return (
    <div 
      className={classes} 
      title={member?.name}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {initialsOf(member?.name)}
    </div>
  );
}