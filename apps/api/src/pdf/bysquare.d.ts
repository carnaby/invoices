// `bysquare` ships types only via its "exports" map (no legacy "main"/"types"
// fields), which isn't resolvable under this repo's `moduleResolution: "node"`
// (see tsconfig.base.json). Runtime resolution (tsx/vite/node) handles the
// "exports" map fine — this ambient declaration only unblocks `tsc --noEmit`.
declare module 'bysquare' {
  export const PaymentOptions: {
    readonly PaymentOrder: 1;
    readonly StandingOrder: 2;
    readonly DirectDebit: 4;
  };
  export type PaymentOptions = (typeof PaymentOptions)[keyof typeof PaymentOptions];

  export const CurrencyCode: Record<string, string>;
  export type CurrencyCode = string;

  export interface BankAccount {
    iban: string;
    bic?: string;
  }

  export interface Beneficiary {
    name?: string;
    street?: string;
    city?: string;
  }

  export interface SimplePayment {
    type: PaymentOptions;
    amount?: number;
    currencyCode: string;
    variableSymbol?: string;
    constantSymbol?: string;
    specificSymbol?: string;
    paymentNote?: string;
    bankAccounts: BankAccount[];
    beneficiary?: Beneficiary;
  }

  export interface DataModel {
    invoiceId?: string;
    payments: SimplePayment[];
  }

  export function encode(data: DataModel): string;
  export function decode(text: string): DataModel;
}
