import {
  ARGON2ID_OPTIONS,
  PasswordHasherService,
} from './password-hasher.service.js';

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService();

  it('hashes passwords using Argon2id with documented parameters', async () => {
    const plain = 'Str0ngP@ssw0rd!2026';
    const hash = await service.hash(plain);

    expect(hash).not.toBe(plain);
    expect(hash).toContain('$argon2id$');
    expect(hash).toContain(`m=${ARGON2ID_OPTIONS.memoryCost}`);
    expect(hash).toContain(`t=${ARGON2ID_OPTIONS.timeCost}`);
    expect(hash).toContain(`p=${ARGON2ID_OPTIONS.parallelism}`);
    await expect(service.verify(hash, plain)).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false when verifying a malformed hash', async () => {
    await expect(
      service.verify('invalid-hash', 'Str0ngP@ssw0rd!2026'),
    ).resolves.toBe(false);
  });
});
