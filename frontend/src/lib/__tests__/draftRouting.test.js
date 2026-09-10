import { isDraftRouteWithoutEventContext, getDraftInviteRedirect } from '../draftRouting';
test.each(['/drafts','/draft/create','/draft/join/token','/draft/fixture/live','/draft/fixture/setup','/draft/fixture/board','/draft/fixture/rankings','/draft/fixture/payment'])('standalone route %s bypasses combine context', path=>expect(isDraftRouteWithoutEventContext(path)).toBe(true));
test.each(['/players','/coach','/events','/draft/fixture/admin','/draftish/fixture/live'])('unrelated route %s stays gated', path=>expect(isDraftRouteWithoutEventContext(path)).toBe(false));

test('login URL preserves its own draft invitation independent of shared storage',()=>expect(getDraftInviteRedirect('?redirect=%2Fdraft%2Fjoin%2Ftest_token-1')).toBe('/draft/join/test_token-1'));
test.each(['?redirect=https://evil.example','?redirect=//evil.example','?redirect=/draft/join/token/extra',''])('rejects invalid draft return target %s',query=>expect(getDraftInviteRedirect(query)).toBeNull());
