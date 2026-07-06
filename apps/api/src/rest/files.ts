import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { settings, type Db } from '@invoices/db';
import { resolveUserId, SESSION_COOKIE } from '../trpc/context';

export async function getSignature(db: Db, userId: string) {
  const [row] = await db
    .select({ data: settings.signatureImage, mimeType: settings.signatureMimeType })
    .from(settings)
    .where(eq(settings.userId, userId));
  if (!row?.data || !row.mimeType) return null;
  return { data: row.data, mimeType: row.mimeType };
}

export function createFilesRouter(db: Db): Router {
  const r = Router();
  r.get('/signature', async (req, res) => {
    const userId = await resolveUserId(db, req.cookies?.[SESSION_COOKIE]);
    if (!userId) return res.status(401).json({ error: 'Musíte byť prihlásený' });
    const sig = await getSignature(db, userId);
    if (!sig) return res.status(404).json({ error: 'Podpis nie je nahraný' });
    res.setHeader('Content-Type', sig.mimeType);
    res.send(sig.data);
  });
  return r;
}
