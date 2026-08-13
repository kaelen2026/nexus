CREATE TYPE "public"."billing_usage_reservation_status" AS ENUM('reserved', 'committed', 'released');--> statement-breakpoint
CREATE TABLE "billing_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"units" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_usage_records_reservation_id_unique" UNIQUE("reservation_id"),
	CONSTRAINT "billing_usage_records_units_non_negative" CHECK ("billing_usage_records"."units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "billing_usage_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"reserved_units" integer NOT NULL,
	"actual_units" integer,
	"status" "billing_usage_reservation_status" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "billing_usage_reservations_reserved_units_positive" CHECK ("billing_usage_reservations"."reserved_units" > 0),
	CONSTRAINT "billing_usage_reservations_actual_units_non_negative" CHECK ("billing_usage_reservations"."actual_units" is null or "billing_usage_reservations"."actual_units" >= 0)
);
--> statement-breakpoint
ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_reservation_id_billing_usage_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."billing_usage_reservations"("id") ON DELETE no action ON UPDATE no action;