import {
  pgTable, uuid, text, timestamp, date, numeric, integer, boolean,
  customType, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    companyName: text('company_name').notNull(),
    ico: text('ico'),
    icDph: text('ic_dph'),
    dic: text('dic'),
    street: text('street'),
    zip: text('zip'),
    city: text('city'),
    country: text('country').notNull().default('Slovensko'),
    email: text('email'),
    ccEmails: text('cc_emails').array().notNull().default([]),
    phone: text('phone'),
    defaultDueDays: integer('default_due_days'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2, mode: 'number' })
      .notNull()
      .default(0),
    contactFirstName: text('contact_first_name'),
    contactLastName: text('contact_last_name'),
    iban: text('iban'),
    swift: text('swift'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('contacts_user_idx').on(t.userId)],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    number: text('number').notNull(),
    variableSymbol: text('variable_symbol'),
    constantSymbol: text('constant_symbol'),
    customerName: text('customer_name').notNull(),
    customerIco: text('customer_ico'),
    customerIcDph: text('customer_ic_dph'),
    customerDic: text('customer_dic'),
    customerStreet: text('customer_street'),
    customerZip: text('customer_zip'),
    customerCity: text('customer_city'),
    customerCountry: text('customer_country'),
    customerEmail: text('customer_email'),
    customerCcEmails: text('customer_cc_emails').array().notNull().default([]),
    issueDate: date('issue_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    deliveryDate: date('delivery_date', { mode: 'string' }).notNull(),
    introText: text('intro_text'),
    note: text('note'),
    currency: text('currency').notNull().default('EUR'),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2, mode: 'number' })
      .notNull()
      .default(0),
    paidDate: date('paid_date', { mode: 'string' }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invoices_user_number_uq').on(t.userId, t.number),
    index('invoices_user_issue_idx').on(t.userId, t.issueDate),
  ],
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3, mode: 'number' }).notNull().default(1),
    unit: text('unit').notNull().default('ks'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2, mode: 'number' }).notNull(),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2, mode: 'number' }).notNull().default(0),
  },
  (t) => [index('invoice_items_invoice_idx').on(t.invoiceId)],
);

export const settings = pgTable('settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  supplierName: text('supplier_name'),
  supplierStreet: text('supplier_street'),
  supplierZip: text('supplier_zip'),
  supplierCity: text('supplier_city'),
  supplierCountry: text('supplier_country').notNull().default('Slovensko'),
  supplierIco: text('supplier_ico'),
  supplierDic: text('supplier_dic'),
  supplierIcDph: text('supplier_ic_dph'),
  registrationText: text('registration_text'),
  supplierEmail: text('supplier_email'),
  supplierPhone: text('supplier_phone'),
  iban: text('iban'),
  swift: text('swift'),
  defaultDueDays: integer('default_due_days').notNull().default(14),
  defaultConstantSymbol: text('default_constant_symbol').notNull().default('0308'),
  defaultIntroText: text('default_intro_text'),
  defaultNote: text('default_note'),
  smtpHost: text('smtp_host'),
  smtpPort: integer('smtp_port'),
  smtpUser: text('smtp_user'),
  smtpPasswordEnc: text('smtp_password_enc'),
  smtpSecure: boolean('smtp_secure').notNull().default(true),
  emailFrom: text('email_from'),
  signatureImage: bytea('signature_image'),
  signatureMimeType: text('signature_mime_type'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
