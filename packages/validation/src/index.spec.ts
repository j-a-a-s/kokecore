import {
  isValidChileanRut,
  normalizeChileanRut,
  assertMoneyPrecision,
  createMoneySchema,
  sanitizeInput,
  maskEmail,
  maskPhone,
  maskRUT,
  isValidEmail,
  isValidURL,
} from './index';

describe('Chilean RUT', () => {
  it('validates a correct RUT', () => {
    expect(isValidChileanRut('12.345.678-5')).toBe(true);
    expect(isValidChileanRut('12345678-5')).toBe(true);
  });

  it('rejects an incorrect RUT', () => {
    expect(isValidChileanRut('12.345.678-9')).toBe(false);
    expect(isValidChileanRut('invalid')).toBe(false);
  });

  it('normalizes a RUT', () => {
    expect(normalizeChileanRut('12.345.678-5')).toBe('12345678-5');
  });
});

describe('Money precision', () => {
  it('allows CLP without decimals', () => {
    expect(() => assertMoneyPrecision(1000, 'CLP')).not.toThrow();
  });

  it('rejects CLP with decimals', () => {
    expect(() => assertMoneyPrecision(1000.5, 'CLP')).toThrow('CLP does not allow decimal places');
  });

  it('validates USD precision', () => {
    const schema = createMoneySchema('USD');
    expect(() => schema.parse(100.5)).not.toThrow();
    expect(() => schema.parse(100.555)).toThrow();
  });
});

describe('Input sanitization', () => {
  it('escapes HTML and SQL characters', () => {
    const input = "<script>alert('xss');</script>";
    const sanitized = sanitizeInput(input);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;');
    expect(sanitized).toContain('&gt;');
  });
});

describe('PII masking', () => {
  it('masks email addresses', () => {
    expect(maskEmail('juan.perez@example.com')).toBe('j********z@example.com');
  });

  it('masks phone numbers', () => {
    expect(maskPhone('+56 9 1234 5678')).toMatch(/\*5678$/);
  });

  it('masks RUT numbers', () => {
    expect(maskRUT('12.345.678-5')).toBe('*****6785');
  });
});

describe('Common validators', () => {
  it('validates email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
  });

  it('validates URL', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('not-a-url')).toBe(false);
  });
});
