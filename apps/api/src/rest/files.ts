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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  r.get('/invoices/:id/pdf', async (req, res) => {
    const userId = await resolveUserId(db, req.cookies?.[SESSION_COOKIE]);
    if (!userId) return res.status(401).json({ error: 'Musíte byť prihlásený' });
    if (!UUID_RE.test(req.params.id)) {
      return res.status(404).json({ error: 'Faktúra neexistuje' });
    }
    try {
      const { generateInvoicePdf } = await import('../pdf/pdf.service');
      const { loadInvoiceWithItems } = await import('../invoices/invoices.service');
      const { invoice } = await loadInvoiceWithItems(db, userId, req.params.id);
      const pdf = await generateInvoicePdf(db, userId, req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="faktura-${invoice.number}.pdf"`);
      res.send(pdf);
    } catch (e: any) {
      if (e?.code === 'NOT_FOUND') return res.status(404).json({ error: 'Faktúra neexistuje' });
      console.error('PDF generation failed', e);
      res.status(500).json({ error: 'Generovanie PDF zlyhalo' });
    }
  });

  return r;
}
