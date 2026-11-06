CREATE TABLE "invoice_originals" (
	"invoice_id" uuid PRIMARY KEY NOT NULL,
	"pdf" "bytea" NOT NULL,
	"file_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_originals" ADD CONSTRAINT "invoice_originals_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;