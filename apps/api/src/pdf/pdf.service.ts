import puppeteer, { type Browser } from 'puppeteer';
import { eq } from 'drizzle-orm';
import { settings, type Db } from '@invoices/db';
import { round2 } from '@invoices/shared';
import { loadInvoiceWithItems } from '../invoices/invoices.service';
import { buildPayBySquareText, buildQrDataUrl } from './qr';
import { renderInvoiceHtml } from './invoice-template';

let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  browserPromise ??= puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  return browserPromise;
}
export async function closeBrowser() {
  if (browserPromise) {
    await (await browserPromise).close();
    browserPromise = null;
  }
}

export async function generateInvoicePdf(db: Db, userId: string, invoiceId: string): Promise<Buffer> {
  const { invoice, items, totals } = await loadInvoiceWithItems(db, userId, invoiceId);
  const [userSettings] = await db.select().from(settings).where(eq(settings.userId, userId));

  let qrDataUrl: string | null = null;
  const remaining = round2(Math.max(0, totals.total - invoice.paidAmount));
  if (userSettings?.iban && remaining > 0) {
    qrDataUrl = await buildQrDataUrl(
      buildPayBySquareText({
        iban: userSettings.iban,
        amount: remaining,
        currency: invoice.currency,
        variableSymbol: invoice.variableSymbol,
        constantSymbol: invoice.constantSymbol,
        beneficiaryName: userSettings.supplierName,
        paymentNote: invoice.number,
      }),
    );
  }
  const signatureDataUrl =
    userSettings?.signatureImage && userSettings.signatureMimeType
      ? `data:${userSettings.signatureMimeType};base64,${Buffer.from(userSettings.signatureImage).toString('base64')}`
      : null;

  const html = renderInvoiceHtml({ invoice, items, totals, settings: userSettings, qrDataUrl, signatureDataUrl });
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 'load' suffices: the HTML embeds all images as data URLs, so there is no
    // network activity to await. Puppeteer 24 also no longer types 'networkidle0'
    // for setContent (excluded from SetContentWaitForOptions).
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, timeout: 30000 });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
