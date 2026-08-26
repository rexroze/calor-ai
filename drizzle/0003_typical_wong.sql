CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sex" text,
	"age" integer,
	"height_cm" real,
	"weight_kg" real,
	"activity_level" text,
	"goal_intent" text,
	"unit_preference" text DEFAULT 'metric' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;