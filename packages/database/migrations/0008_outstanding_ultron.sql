CREATE TABLE "auth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_credentials_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_account_id_auth_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."auth_accounts"("id") ON DELETE no action ON UPDATE no action;