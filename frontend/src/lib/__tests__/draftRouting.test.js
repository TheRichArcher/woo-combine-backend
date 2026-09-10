import { isDraftRouteWithoutEventContext } from '../draftRouting';
test.each(['/drafts','/draft/create','/draft/join/token','/draft/fixture/live','/draft/fixture/setup','/draft/fixture/board','/draft/fixture/rankings','/draft/fixture/payment'])('standalone route %s bypasses combine context', path=>expect(isDraftRouteWithoutEventContext(path)).toBe(true));
test.each(['/players','/coach','/events','/draft/fixture/admin','/draftish/fixture/live'])('unrelated route %s stays gated', path=>expect(isDraftRouteWithoutEventContext(path)).toBe(false));
