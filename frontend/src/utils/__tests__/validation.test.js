import { validateEmail, validatePlayerName } from '../validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('accepts valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name+tag@domain.co.uk',
        'user123@subdomain.example.org'
      ];

      validEmails.forEach(email => {
        expect(() => validateEmail(email)).not.toThrow();
      });
    });

    it('rejects invalid email addresses', () => {
      const invalidEmails = [
        'invalid.email',
        '@domain.com',
        'user@',
        '',
        null,
        undefined
      ];

      invalidEmails.forEach(email => {
        expect(() => validateEmail(email)).toThrow();
      });
    });
  });

  describe('validatePlayerName', () => {
    it('accepts valid player names', () => {
      const validNames = [
        'John Doe',
        'Mary-Jane Smith',
        "O'Connor",
        'José García'
      ];

      validNames.forEach(name => {
        expect(() => validatePlayerName(name)).not.toThrow();
      });
    });

    it('rejects invalid player names', () => {
      const invalidNames = [
        '',
        'A', // too short
        null,
        undefined,
        'Name123', // contains numbers
        'Name@Email' // contains special chars
      ];

      invalidNames.forEach(name => {
        expect(() => validatePlayerName(name)).toThrow();
      });
    });

    it('returns cleaned player name', () => {
      const result = validatePlayerName('  John Doe  ');
      expect(result).toBe('John Doe');
    });
  });
});