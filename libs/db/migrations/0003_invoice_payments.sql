CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"paid_on" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_amount_positive" CHECK ("invoice_payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
-- paid_amount and paid_date are kept as a frozen record of the values before this migration (dropped later).
-- Each invoice with a paid amount becomes one payment on its paid date.
INSERT INTO "invoice_payments" ("invoice_id", "paid_on", "amount")
SELECT "id", coalesce("paid_date", "issue_date"), "paid_amount" FROM "invoices" WHERE "paid_amount" > 0;