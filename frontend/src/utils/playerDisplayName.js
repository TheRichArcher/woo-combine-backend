const VIEWER_ROLES = new Set(['viewer', 'public']);

const hasAssignedNumber = (number) => number !== null && number !== undefined && String(number).trim() !== '';

const getFirstName = (player = {}) => {
  if (typeof player.first_name === 'string' && player.first_name.trim()) {
    return player.first_name.trim();
  }

  if (typeof player.name === 'string' && player.name.trim()) {
    const [firstName] = player.name.trim().split(/\s+/);
    return firstName || '';
  }

  return '';
};

export const formatViewerPlayerName = (player = {}, userRole) => {
  const fullName = typeof player.name === 'string' ? player.name : '';
  if (!VIEWER_ROLES.has(userRole)) {
    return fullName;
  }

  const firstName = getFirstName(player);
  const number = player.number;

  if (!firstName) return fullName;
  if (!hasAssignedNumber(number)) return firstName;
  return `${firstName} #${number}`;
};
