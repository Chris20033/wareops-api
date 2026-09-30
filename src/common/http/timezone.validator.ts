import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const supportedTimezones = new Set<string>(['UTC']);

try {
  for (const tz of Intl.supportedValuesOf('timeZone')) {
    supportedTimezones.add(tz);
  }
} catch {
  // Fallback handled via Intl.DateTimeFormat
}

export function isValidIanaTimezone(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  if (supportedTimezones.has(value)) {
    return true;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isValidIanaTimezone(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} debe ser un identificador de zona horaria IANA válido.`;
        },
      },
    });
  };
}

export function slugifyOrganizationName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
