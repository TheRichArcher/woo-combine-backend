import fs from "fs";
import path from "path";

const appPath = path.resolve(__dirname, "../App.jsx");

describe("draft frontend route policy matrix", () => {
  const source = fs.readFileSync(appPath, "utf8");

  const staffOnlyRoutes = [
    "/draft/create",
    "/draft/:draftId/setup",
    "/draft/:draftId/live",
    "/drafts",
  ];

  it("enforces staff-only route guards for draft management routes", () => {
    for (const routePath of staffOnlyRoutes) {
      const routeAnchor = `path="${routePath}"`;
      const routeIdx = source.indexOf(routeAnchor);
      expect(routeIdx).toBeGreaterThan(-1);

      // Keep this local and robust against formatting churn in JSX spacing/newlines.
      const routeChunk = source.slice(routeIdx, routeIdx + 260);
      expect(routeChunk).toContain('<RequireAuth allowedRoles={["organizer", "coach"]}>');
    }
  });

  it("keeps invite route public for token-based entry", () => {
    const publicJoinRegex =
      /path="\/draft\/join\/:inviteToken"[\s\S]*?element=\{<JoinDraft \/>}/m;
    expect(publicJoinRegex.test(source)).toBe(true);
  });
});

