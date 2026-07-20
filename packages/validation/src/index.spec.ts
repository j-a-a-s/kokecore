import {
  ValidationError,
  chileanRutSchema,
  commonSchemas,
  createPhoneSchema,
  emailSchema,
  formatIBAN,
  formatMoney,
  formatPhoneForDisplay,
  ibanSchema,
  isValidChileanRut,
  isValidIBAN,
  isValidInternationalPhone,
  normalizeChileanRut,
  normalizeInternationalPhone,
  assertMoneyPrecision,
  createMoneySchema,
  sanitizeHTML,
  sanitizeInput,
  maskCreditCard,
  maskEmail,
  maskPhone,
  maskRUT,
  isValidEmail,
  isValidURL,
  urlSchema,
  validateData,
  validateEmailDomain,
  validateWithContext,
} from './index';
import { z } from 'zod';
import * as publicApi from './public';

describe('Chilean RUT', () => {
  it('validates a correct RUT', () => {
    expect(isValidChileanRut('12.345.678-5')).toBe(true);
    expect(isValidChileanRut('12345678-5')).toBe(true);
  });

  it('rejects an incorrect RUT', () => {
    expect(isValidChileanRut('12.345.678-9')).toBe(false);
    expect(isValidChileanRut('invalid')).toBe(false);
    expect(isValidChileanRut('')).toBe(false);
  });

  it('normalizes a RUT', () => {
    expect(normalizeChileanRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeChileanRut('')).toBe('');
    expect(normalizeChileanRut('K')).toBe('K');
  });

  it('supports verifier edge cases and the Zod schema', () => {
    expect(isValidChileanRut('1.000.005-K')).toBe(true);
    expect(isValidChileanRut('1.000.013-0')).toBe(true);
    expect(chileanRutSchema.parse('11.111.111-1')).toBe('11.111.111-1');
    expect(chileanRutSchema.safeParse('1-9').success).toBe(false);
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

  it('validates unknown currencies and configured bounds', () => {
    expect(() => assertMoneyPrecision(10, 'XYZ')).not.toThrow();
    expect(() => assertMoneyPrecision(10.25, 'XYZ')).not.toThrow();
    expect(() => assertMoneyPrecision(10.255, 'XYZ')).toThrow(
      'XYZ allows maximum 2 decimal places'
    );

    const bounded = createMoneySchema('XYZ', 10, 20);
    expect(bounded.safeParse(10.25).success).toBe(true);
    expect(bounded.safeParse(9).success).toBe(false);
    expect(bounded.safeParse(21).success).toBe(false);
  });

  it('validates integer-only schemas and formats currencies', () => {
    const clp = createMoneySchema('CLP');
    expect(clp.safeParse(1000).success).toBe(true);
    expect(clp.safeParse(1000.1).success).toBe(false);
    expect(formatMoney(1234, 'CLP', 'es-CL')).toContain('1.234');
  });
});

describe('Input sanitization', () => {
  it('escapes HTML and SQL characters', () => {
    const input = '<script title="x">alert(\'xss\');</script>';
    const sanitized = sanitizeInput(input);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;');
    expect(sanitized).toContain('&gt;');
    expect(sanitized).toContain('&quot;');
    expect(sanitized).toContain('&#x27;');
    expect(sanitized).toContain('&#x2F;');
  });

  it('can trim input without HTML escaping', () => {
    expect(sanitizeInput('  <strong>text</strong>  ', { html: false })).toBe(
      '<strong>text</strong>'
    );
    expect(sanitizeHTML('plain')).toBe('plain');
  });
});

describe('PII masking', () => {
  it('masks email addresses', () => {
    expect(maskEmail('juan.perez@example.com')).toBe('j********z@example.com');
    expect(maskEmail('ab@example.com')).toBe('**@example.com');
    expect(maskEmail('invalid')).toBe('invalid');
    expect(maskEmail('@example.com')).toBe('@example.com');
  });

  it('masks phone numbers', () => {
    expect(maskPhone('+56 9 1234 5678')).toMatch(/\*5678$/);
    expect(maskPhone('123')).toBe('123');
  });

  it('masks RUT numbers', () => {
    expect(maskRUT('12.345.678-5')).toBe('*****6785');
    expect(maskRUT('1-9')).toBe('1-9');
  });

  it('masks credit cards', () => {
    expect(maskCreditCard('4111 1111 1111 1111')).toBe('************1111');
    expect(maskCreditCard('123')).toBe('123');
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

  it('validates phone numbers with and without a country', () => {
    expect(isValidInternationalPhone('+56912345678')).toBe(true);
    expect(isValidInternationalPhone('912345678', 'CL')).toBe(true);
    expect(isValidInternationalPhone('invalid', 'CL')).toBe(false);
    expect(isValidInternationalPhone('invalid')).toBe(false);

    expect(normalizeInternationalPhone('912345678', 'CL')).toBe('+56912345678');
    expect(normalizeInternationalPhone('invalid', 'CL')).toBe('invalid');
    expect(formatPhoneForDisplay('912345678', 'CL')).toBe('912345678');
    expect(formatPhoneForDisplay('invalid', 'CL')).toBe('invalid');
  });

  it('validates phone and IBAN schemas', () => {
    expect(createPhoneSchema('CL').safeParse('912345678').success).toBe(true);
    expect(createPhoneSchema().safeParse('+56912345678').success).toBe(true);
    expect(createPhoneSchema('CL').safeParse('bad').success).toBe(false);

    const iban = 'GB82 WEST 1234 5698 7654 32';
    expect(isValidIBAN(iban)).toBe(true);
    expect(formatIBAN(iban)).toBe('GB82WEST12345698765432');
    expect(ibanSchema.safeParse(iban).success).toBe(true);
    expect(ibanSchema.safeParse('invalid').success).toBe(false);
  });

  it('exposes common schemas', () => {
    expect(emailSchema.safeParse('person@example.com').success).toBe(true);
    expect(emailSchema.safeParse('bad').success).toBe(false);
    expect(urlSchema.safeParse('https://example.com').success).toBe(true);
    expect(commonSchemas.uuid.safeParse('00000000-0000-4000-8000-000000000000').success).toBe(true);
    expect(commonSchemas.positiveInteger.safeParse(2).success).toBe(true);
    expect(commonSchemas.nonNegativeNumber.safeParse(0).success).toBe(true);
  });
});

describe('Validation result helpers', () => {
  const schema = z.object({ email: z.string().email() });

  it('returns parsed data and structured Zod errors', () => {
    expect(validateData(schema, { email: 'person@example.com' })).toEqual({
      success: true,
      data: { email: 'person@example.com' },
    });
    const invalid = validateData(schema, { email: 'bad' });
    expect(invalid.success).toBe(false);
    expect(invalid.errors?.[0]).toBeInstanceOf(ValidationError);
    expect(invalid.errors?.[0]?.field).toBe('email');
  });

  it('normalizes non-Zod validation failures', () => {
    const throwingSchema = z.string().transform(() => {
      throw new Error('external validator failed');
    });
    const result = validateData(throwingSchema, 'value');
    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.field).toBe('unknown');
  });

  it('validates email domains', async () => {
    expect(await validateEmailDomain('person@example.com')).toBe(true);
    expect(await validateEmailDomain('person@invalid')).toBe(false);
    expect(await validateEmailDomain('missing-domain')).toBe(false);
  });

  it('validates with context and preserves both failure forms', () => {
    expect(
      validateWithContext(schema, { email: 'person@example.com' }, { role: 'ADMIN' }).success
    ).toBe(true);
    expect(validateWithContext(schema, { email: 'bad' }, {}).errors?.[0]?.field).toBe('email');

    const throwingSchema = z.string().transform(() => {
      throw new Error('context adapter failed');
    });
    expect(validateWithContext(throwingSchema, 'value', {}).errors?.[0]?.field).toBe('unknown');
  });
});

describe('Public API', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.validateData).toBe(validateData);
  });
});
