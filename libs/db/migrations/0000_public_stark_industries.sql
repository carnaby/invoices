CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"ico" text,
	"ic_dph" text,
	"dic" text,
	"street" text,
	"zip" text,
	"city" text,
	"country" text DEFAULT 'Slovensko' NOT NULL,
	"email" text,
	"cc_emails" text[] DEFAULT '{}' NOT NULL,
	"phone" text,
	"default_due_days" integer,
	"discount_percent" numeric(5, 2) DEFAULT 0 NOT NULL,
	"contact_first_name" text,
	"contact_last_name" text,
	"iban" text,
	"swift" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'ks' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid,
	"number" text NOT NULL,
	"variable_symbol" text,
	"constant_symbol" text,
	"customer_name" text NOT NULL,
	"customer_ico" text,
	"customer_ic_dph" text,
	"customer_dic" text,
	"customer_street" text,
	"customer_zip" text,
	"customer_city" text,
	"customer_country" text,
	"customer_email" text,
	"customer_cc_emails" text[] DEFAULT '{}' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"delivery_date" date NOT NULL,
	"intro_text" text,
	"note" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"paid_date" date,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"supplier_name" text,
	"supplier_street" text,
	"supplier_zip" text,
	"supplier_city" text,
	"supplier_country" text DEFAULT 'Slovensko' NOT NULL,
	"supplier_ico" text,
	"supplier_dic" text,
	"supplier_ic_dph" text,
	"registration_text" text,
	"supplier_email" text,
	"supplier_phone" text,
	"iban" text,
	"swift" text,
	"default_due_days" integer DEFAULT 14 NOT NULL,
	"default_constant_symbol" text DEFAULT '0308' NOT NULL,
	"default_intro_text" text,
	"default_note" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_password_enc" text,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"email_from" text,
	"signature_image" "bytea",
	"signature_mime_type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_user_idx" ON "contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_user_number_uq" ON "invoices" USING btree ("user_id","number");--> statement-breakpoint
CREATE INDEX "invoices_user_issue_idx" ON "invoices" USING btree ("user_id","issue_date");