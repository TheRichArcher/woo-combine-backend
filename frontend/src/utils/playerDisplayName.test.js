import { formatViewerPlayerName } from './playerDisplayName';

describe('formatViewerPlayerName', () => {
  test('viewer sees first name only when no number is assigned', () => {
    const name = formatViewerPlayerName({ name: 'John Smith', number: null }, 'viewer');
    expect(name).toBe('John');
  });

  test('viewer sees first name plus number when number exists', () => {
    const name = formatViewerPlayerName({ name: 'John Smith', number: 12 }, 'viewer');
    expect(name).toBe('John #12');
  });

  test('public role follows viewer-safe format', () => {
    const name = formatViewerPlayerName({ name: 'John Smith', number: 34 }, 'public');
    expect(name).toBe('John #34');
  });

  test('organizer sees full name unchanged', () => {
    const name = formatViewerPlayerName({ name: 'John Smith', number: 12 }, 'organizer');
    expect(name).toBe('John Smith');
  });

  test('coach sees full name unchanged', () => {
    const name = formatViewerPlayerName({ name: 'John Smith', number: null }, 'coach');
    expect(name).toBe('John Smith');
  });
});
