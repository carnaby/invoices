import { CurrencyCode, encode, PaymentOptions } from 'bysquare';
import QRCode from 'qrcode';

export function buildPayBySquareText(opts: {
  iban: string; amount: number; currency: string;
  variableSymbol?: string | null; constantSymbol?: string | null;
  beneficiaryName?: string | null; paymentNote?: string | null;
}): string {
  return encode({
    payments: [
      {
        type: PaymentOptions.PaymentOrder,
        amount: opts.amount,
        currencyCode: (opts.currency as CurrencyCode) ?? CurrencyCode.EUR,
        variableSymbol: opts.variableSymbol ?? undefined,
        constantSymbol: opts.constantSymbol ?? undefined,
        paymentNote: opts.paymentNote ?? undefined,
        bankAccounts: [{ iban: opts.iban }],
        beneficiary: opts.beneficiaryName ? { name: opts.beneficiaryName } : undefined,
      },
    ],
  });
}

export function buildQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 400 });
}
