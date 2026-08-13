CREATE TABLE "billing_plan_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "billing_plan_entitlements_plan_key_unique" UNIQUE("plan_id","key")
);
--> statement-breakpoint
CREATE TABLE "billing_plan_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"key" text NOT NULL,
	"limit" integer NOT NULL,
	CONSTRAINT "billing_plan_quotas_plan_key_unique" UNIQUE("plan_id","key")
);
--> statement-breakpoint
ALTER TABLE "billing_plan_entitlements" ADD CONSTRAINT "billing_plan_entitlements_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_quotas" ADD CONSTRAINT "billing_plan_quotas_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;