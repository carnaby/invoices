import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import type { Db } from '@invoices/db';
import { createTestContext } from '../context';
import { createCaller } from '../app-router';

let db: Db; let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => close());
beforeEach(async () => truncateAll(db));

async function newUserCaller(username: string) {
  const u = await createCaller(createTestContext(db)).auth.register({ username, password: 'password123' });
  return createCaller(createTestContext(db, u.id));
}

describe('contacts', () => {
  it('create + get + list roundtrip with defaults', async () => {
    const caller = await newUserCaller('jozef');
    const created = await caller.contacts.create({ companyName: 'Test s.r.o.', ico: '12345678' });
    expect(created.country).toBe('Slovensko');
    const listed = await caller.contacts.list({});
    expect(listed).toHaveLength(1);
    await expect(caller.contacts.get({ id: created.id })).resolves.toMatchObject({ companyName: 'Test s.r.o.' });
  });

  it('list searches by name/ico/city case-insensitively and sorts by name', async () => {
    const caller = await newUserCaller('jozef');
    await caller.contacts.create({ companyName: 'Zeta s.r.o.', city: 'Martin' });
    await caller.contacts.create({ companyName: 'Alfa a.s.', ico: '99911122' });
    expect((await caller.contacts.list({})).map((c) => c.companyName)).toEqual(['Alfa a.s.', 'Zeta s.r.o.']);
    expect(await caller.contacts.list({ search: 'zeta' })).toHaveLength(1);
    expect(await caller.contacts.list({ search: '999' })).toHaveLength(1);
    expect(await caller.contacts.list({ search: 'mar' })).toHaveLength(1);
  });

  it('update changes fields', async () => {
    const caller = await newUserCaller('jozef');
    const c = await caller.contacts.create({ companyName: 'Test s.r.o.' });
    const updated = await caller.contacts.update({ id: c.id, data: { companyName: 'Nový názov s.r.o.', email: 'test@example.com' } });
    expect(updated.companyName).toBe('Nový názov s.r.o.');
    expect(updated.email).toBe('test@example.com');
  });

  it('remove soft-deletes (hidden from list/get)', async () => {
    const caller = await newUserCaller('jozef');
    const c = await caller.contacts.create({ companyName: 'Test s.r.o.' });
    await caller.contacts.remove({ id: c.id });
    expect(await caller.contacts.list({})).toHaveLength(0);
    await expect(caller.contacts.get({ id: c.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('tenant isolation: user B cannot see or modify A contacts', async () => {
    const a = await newUserCaller('alice');
    const b = await newUserCaller('bob');
    const c = await a.contacts.create({ companyName: 'Test s.r.o.' });
    expect(await b.contacts.list({})).toHaveLength(0);
    await expect(b.contacts.get({ id: c.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(b.contacts.update({ id: c.id, data: { companyName: 'Hack' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(b.contacts.remove({ id: c.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
