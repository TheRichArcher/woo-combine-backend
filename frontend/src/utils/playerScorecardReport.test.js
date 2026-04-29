import { generatePlayerScorecardHTML } from './playerScorecardReport';

describe('generatePlayerScorecardHTML', () => {
  test('escapes user-controlled report fields before rendering raw HTML', () => {
    const maliciousName = '<img src=x onerror="alert(1)">';
    const html = generatePlayerScorecardHTML({
      player: {
        id: 'player-1',
        first_name: maliciousName,
        last_name: '<script>alert(2)</script>',
        number: '7"><svg onload="alert(3)">',
        age_group: '10U<script>alert(4)</script>'
      },
      displayName: maliciousName,
      documentTitle: '<script>alert(5)</script>',
      selectedEvent: { name: 'Event <img src=x onerror="alert(6)">' },
      templateName: 'Template <svg onload="alert(7)">',
      drills: [{ key: 'dash', label: 'Dash <script>alert(8)</script>' }],
      playerStats: {
        compositeScore: 91.2,
        rank: 1,
        totalInAgeGroup: 4,
        percentile: 100,
        starDisplay: '★★★★★'
      },
      drillAnalysis: [
        {
          key: 'dash',
          label: 'Dash <script>alert(8)</script>',
          playerScore: '4.7 <img src=x onerror="alert(9)">',
          unit: 'sec <svg onload="alert(10)">',
          percentile: 100
        }
      ],
      coachNotes: 'Great work\n<script>alert(11)</script><img src=x onerror="alert(12)">'
    });

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const eventHandlerNodes = Array.from(parsed.querySelectorAll('*')).filter((node) =>
      Array.from(node.attributes).some((attr) => attr.name.toLowerCase().startsWith('on'))
    );

    expect(parsed.querySelectorAll('script,img,svg')).toHaveLength(0);
    expect(eventHandlerNodes).toHaveLength(0);
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('&lt;script&gt;alert(11)&lt;/script&gt;');
  });
});
