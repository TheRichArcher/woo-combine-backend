export function getPendingInviteJoinPath() {
  try {
    const pendingEventJoin = localStorage.getItem('pendingEventJoin');
    if (!pendingEventJoin) return null;
    const safePath = pendingEventJoin
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return `/join-event/${safePath}`;
  } catch {
    return null;
  }
}
