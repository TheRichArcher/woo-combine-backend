// Standalone drafts authorize through RequireAuth and the draft API; they do not
// require a combine event selection. Keep this list scoped to actual draft routes.
export const isDraftRouteWithoutEventContext = (pathname) =>
  pathname === '/drafts' || pathname === '/draft/create' ||
  /^\/draft\/join\/[^/]+\/?$/.test(pathname) ||
  /^\/draft\/[^/]+\/(setup|live|board|rankings|payment)\/?$/.test(pathname);
