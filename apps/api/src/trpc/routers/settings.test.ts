import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import { settings, type Db } from '@invoices/db';
import { createTestContext, resolveUserId } from '../context';
import { createCaller } from '../app-router';

let db: Db; let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => close());
beforeEach(async () => truncateAll(db));

async function registerAndGetCaller(username = 'jozef') {
  const ctx = createTestContext(db);
  const anon = createCaller(ctx);
  const u = await anon.auth.register({ username, password: 'password123' });
  return { caller: createCaller(createTestContext(db, u.id)), userId: u.id };
}

describe('settings', () => {
  it('get returns defaults after registration, without secret fields', async () => {
    const { caller } = await registerAndGetCaller();
    const s = await caller.settings.get();
    expect(s.defaultDueDays).toBe(14);
    expect(s.defaultConstantSymbol).toBe('0308');
    expect(s.hasSmtpPassword).toBe(false);
    expect(s.hasSignature).toBe(false);
    expect(s).not.toHaveProperty('smtpPasswordEnc');
    expect(s).not.toHaveProperty('signatureImage');
  });

  it('update persists supplier fields', async () => {
    const { caller } = await registerAndGetCaller();
    const s = await caller.settings.update({
      supplierName: 'Ján Testovací',
      supplierIco: '12345678',
      iban: 'SK3112000000198742637541',
      swift: 'TESTSKBX',
      defaultDueDays: 10,
    });
    expect(s.supplierName).toBe('Ján Testovací');
    expect(s.defaultDueDays).toBe(10);
  });

  it('setSmtpPassword stores encrypted, not plaintext', async () => {
    const { caller, userId } = await registerAndGetCaller();
    await caller.settings.setSmtpPassword({ password: 'smtp-tajne' });
    const [row] = await db.select().from(settings).where(eq(settings.userId, userId));
    expect(row.smtpPasswordEnc).toBeTruthy();
    expect(row.smtpPasswordEnc).not.toContain('smtp-tajne');
    expect((await caller.settings.get()).hasSmtpPassword).toBe(true);
  });

  it('signature upload/delete roundtrip', async () => {
    const { caller, userId } = await registerAndGetCaller();
    const png = Buffer.from('89504e470d0a1a0a', 'hex'); // PNG magic, synthetic
    await caller.settings.uploadSignature({ dataBase64: png.toString('base64'), mimeType: 'image/png' });
    expect((await caller.settings.get()).hasSignature).toBe(true);
    const { getSignature } = await import('../../rest/files');
    const sig = await getSignature(db, userId);
    expect(sig?.mimeType).toBe('image/png');
    expect(Buffer.compare(sig!.data, png)).toBe(0);
    await caller.settings.deleteSignature();
    expect(await getSignature(db, userId)).toBeNull();
  });

  it('unauthenticated access is rejected', async () => {
    const anon = createCaller(createTestContext(db));
    await expect(anon.settings.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
