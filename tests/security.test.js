import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeInput,
  normalizeHelpNumber,
  isValidHelpNumber,
  isValidEmail,
  evaluatePasswordStrength,
  generateSalt,
  hashPassword,
  constantTimeEquals,
  generateCryptographicOTP,
  generateSessionToken
} from '../src/utils/security.js';

describe('RakshaPulse Security Engine Tests', () => {
  describe('Input Sanitization & XSS Neutralization', () => {
    it('should strip script tags and HTML tags', () => {
      const dirty = '<script>alert("hack")</script><b>Kunal</b>';
      const clean = sanitizeInput(dirty);
      assert.strictEqual(clean, 'Kunal');
    });

    it('should strip inline javascript execution handlers', () => {
      const dirty = 'onload=evil() javascript:void(0)';
      const clean = sanitizeInput(dirty);
      assert.ok(!clean.includes('javascript:'));
      assert.ok(!clean.includes('onload='));
    });
  });

  describe('Help Number & Phone Normalization', () => {
    it('should clean spaces, dashes and parens while preserving +', () => {
      assert.strictEqual(normalizeHelpNumber('+91 (987) 65-43210'), '+919876543210');
      assert.strictEqual(normalizeHelpNumber('98765 43210'), '9876543210');
    });

    it('should validate 10-15 digit help numbers', () => {
      assert.strictEqual(isValidHelpNumber('+919876543210'), true);
      assert.strictEqual(isValidHelpNumber('9876543210'), true);
      assert.strictEqual(isValidHelpNumber('123'), false);
      assert.strictEqual(isValidHelpNumber(''), false);
    });

    it('should validate email format', () => {
      assert.strictEqual(isValidEmail('kunal@example.com'), true);
      assert.strictEqual(isValidEmail('invalid-email'), false);
      assert.strictEqual(isValidEmail(''), true); // optional
    });
  });

  describe('Password Strength & Complexity Validation', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const evalRes = evaluatePasswordStrength('Short1!');
      assert.strictEqual(evalRes.isValid, false);
      assert.strictEqual(evalRes.checks.length, false);
    });

    it('should reject passwords missing special characters or uppercase', () => {
      const noSpecial = evaluatePasswordStrength('Password123');
      assert.strictEqual(noSpecial.isValid, false);
      assert.strictEqual(noSpecial.checks.hasSpecial, false);

      const noUpper = evaluatePasswordStrength('password123!');
      assert.strictEqual(noUpper.isValid, false);
      assert.strictEqual(noUpper.checks.hasUpper, false);
    });

    it('should approve strong passwords meeting all requirements', () => {
      const strong = evaluatePasswordStrength('Raksha@Pulse2026');
      assert.strictEqual(strong.isValid, true);
      assert.strictEqual(strong.score, 4);
      assert.strictEqual(strong.label, 'Strong');
    });
  });

  describe('WebCrypto Salted Hashing & Timing-Attack Resistance', () => {
    it('should produce 64-char hex SHA-256 hash using unique salts', async () => {
      const salt1 = generateSalt(16);
      const salt2 = generateSalt(16);
      assert.notStrictEqual(salt1, salt2);

      const hash1 = await hashPassword('SecretKey123!', salt1);
      const hash2 = await hashPassword('SecretKey123!', salt2);

      assert.strictEqual(hash1.length, 64);
      assert.strictEqual(hash2.length, 64);
      // Different salts produce different hashes for same password
      assert.notStrictEqual(hash1, hash2);
    });

    it('should accurately verify constant-time string equality', () => {
      const strA = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
      const strB = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
      const strC = '0000000000000000000000000000000000000000000000000000000000000000';

      assert.strictEqual(constantTimeEquals(strA, strB), true);
      assert.strictEqual(constantTimeEquals(strA, strC), false);
      assert.strictEqual(constantTimeEquals('short', 'longer_string'), false);
    });
  });

  describe('CSPRNG OTP & Session Token Cryptography', () => {
    it('should generate a 6-digit numeric OTP', () => {
      for (let i = 0; i < 50; i++) {
        const otp = generateCryptographicOTP();
        assert.strictEqual(otp.length, 6);
        assert.match(otp, /^\d{6}$/);
        const num = parseInt(otp, 10);
        assert.ok(num >= 100000 && num <= 999999);
      }
    });

    it('should generate high-entropy 256-bit session token with prefix', () => {
      const token = generateSessionToken();
      assert.ok(token.startsWith('rkp_sess_'));
      assert.strictEqual(token.length, 'rkp_sess_'.length + 64);
    });
  });
});
