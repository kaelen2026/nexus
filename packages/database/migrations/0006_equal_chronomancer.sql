CREATE TYPE "public"."llm_request_status" AS ENUM('processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "llm_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"logical_model" text NOT NULL,
	"provider_model" text NOT NULL,
	"status" "llm_request_status" DEFAULT 'processing' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "llm_requests_input_tokens_non_negative" CHECK ("llm_requests"."input_tokens" is null or "llm_requests"."input_tokens" >= 0),
	CONSTRAINT "llm_requests_output_tokens_non_negative" CHECK ("llm_requests"."output_tokens" is null or "llm_requests"."output_tokens" >= 0)
);
