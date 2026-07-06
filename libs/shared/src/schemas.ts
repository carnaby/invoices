import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dátum musí byť vo formáte RRRR-MM-DD');
const optionalTrimmed = z.string().trim().max(200).optional().nullable();
const optionalEmail = z
  .union([z.literal(''), z.string().trim().email('Neplatný e-mail')])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const registerSchema = z.object({
  username: z.string().trim().min(3, 'Meno musí mať aspoň 3 znaky').max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Meno môže obsahovať len písmená, čísla a . _ -'),
  password: z.string().min(8, 'Heslo musí mať aspoň 8 znakov').max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const contactInputSchema = z.object({
  companyName: z.string().trim().min(1, 'Názov firmy je povinný').max(200),
  ico: optionalTrimmed,
  icDph: optionalTrimmed,
  dic: optionalTrimmed,
  street: optionalTrimmed,
  zip: optionalTrimmed,
  city: optionalTrimmed,
  country: z.string().trim().max(100).default('Slovensko'),
  email: optionalEmail,
  ccEmails: z.array(z.string().trim().email('Neplatný e-mail')).default([]),
  phone: optionalTrimmed,
  defaultDueDays: z.number().int().min(0).max(365).optional().nullable(),
  discountPercent: z.number().min(0).max(100).default(0),
  contactFirstName: optionalTrimmed,
  contactLastName: optionalTrimmed,
  iban: optionalTrimmed,
  swift: optionalTrimmed,
});
export type ContactInput = z.infer<typeof contactInputSchema>;

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Popis položky je povinný').max(500),
  quantity: z.number().positive('Počet musí byť kladný').max(999999),
  unit: z.string().trim().max(20).default('ks'),
  unitPrice: z.number().min(-9999999).max(9999999),
  vatRate: z.number().min(0).max(100).default(0),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const invoiceInputSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  number: z.string().trim().min(1, 'Číslo faktúry je povinné').max(20),
  variableSymbol: z.string().trim().regex(/^\d{0,10}$/, 'VS môže mať max. 10 číslic').optional().nullable(),
  constantSymbol: optionalTrimmed,
  customerName: z.string().trim().min(1, 'Odberateľ je povinný').max(200),
  customerIco: optionalTrimmed,
  customerIcDph: optionalTrimmed,
  customerDic: optionalTrimmed,
  customerStreet: optionalTrimmed,
  customerZip: optionalTrimmed,
  customerCity: optionalTrimmed,
  customerCountry: optionalTrimmed,
  customerEmail: optionalEmail,
  customerCcEmails: z.array(z.string().trim().email()).default([]),
  issueDate: dateStr,
  dueDate: dateStr,
  deliveryDate: dateStr,
  introText: z.string().max(2000).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().default('EUR'),
  items: z.array(invoiceItemInputSchema).min(1, 'Faktúra musí mať aspoň jednu položku').max(100),
});
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export const settingsInputSchema = z.object({
  supplierName: optionalTrimmed,
  supplierStreet: optionalTrimmed,
  supplierZip: optionalTrimmed,
  supplierCity: optionalTrimmed,
  supplierCountry: z.string().trim().max(100).default('Slovensko'),
  supplierIco: optionalTrimmed,
  supplierDic: optionalTrimmed,
  supplierIcDph: optionalTrimmed,
  registrationText: z.string().max(500).optional().nullable(),
  supplierEmail: optionalEmail,
  supplierPhone: optionalTrimmed,
  iban: optionalTrimmed,
  swift: optionalTrimmed,
  defaultDueDays: z.number().int().min(0).max(365).default(14),
  defaultConstantSymbol: z.string().trim().max(10).default('0308'),
  defaultIntroText: z.string().max(2000).optional().nullable(),
  defaultNote: z.string().max(2000).optional().nullable(),
  smtpHost: optionalTrimmed,
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: optionalTrimmed,
  smtpSecure: z.boolean().default(true),
  emailFrom: optionalEmail,
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const smtpPasswordSchema = z.object({
  password: z.string().min(1).max(500),
});

export const markPaidSchema = z.object({
  id: z.string().uuid(),
  paidAmount: z.number().min(0),
  paidDate: dateStr.optional().nullable(),
});
export type MarkPaidInput = z.infer<typeof markPaidSchema>;

export const sendEmailSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().min(1, 'Predmet je povinný').max(200),
  body: z.string().min(1, 'Text správy je povinný').max(10000),
});
export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export const signatureUploadSchema = z.object({
  dataBase64: z.string().min(1).max(1_400_000, 'Obrázok môže mať max. 1 MB'),
  mimeType: z.enum(['image/png', 'image/jpeg']),
});
export type SignatureUploadInput = z.infer<typeof signatureUploadSchema>;
