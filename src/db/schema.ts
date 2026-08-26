import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (better-auth 1.7 required schema for the drizzle/pg
// adapter). Column set mirrors @better-auth/core db schema definitions:
// user, session, account (incl. the newer `issuer` column), verification.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  issuer: text("issuer").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// calorAI app tables
// ---------------------------------------------------------------------------

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** One goals row per user. */
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  calories: integer("calories").notNull(),
  proteinG: integer("protein_g").notNull(),
  carbsG: integer("carbs_g").notNull(),
  fatG: integer("fat_g").notNull(),
  /**
   * Daily water target in milliliters. Nullable with a server-side default
   * of 2000 so pre-existing rows backfill safely and readers can fall back
   * to 2000 when the column is null.
   */
  waterGoalMl: integer("water_goal_ml").default(2000),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profile = pgTable("profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  sex: text("sex"), // "male" | "female" | null
  age: integer("age"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  activityLevel: text("activity_level"), // "sedentary" | "light" | "moderate" | "active"
  goalIntent: text("goal_intent"), // "lose" | "maintain" | "gain"
  unitPreference: text("unit_preference").notNull().default("metric"), // "metric" | "imperial"
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * One row per water log delta. `amountMl` may be negative (undo taps);
 * consumers sum per (user, local day). `dateISO` is the app-wide plain
 * 'YYYY-MM-DD' local-day key — never a timestamp.
 */
export const waterLogs = pgTable(
  "water_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dateISO: text("date_iso").notNull(),
    amountMl: integer("amount_ml").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("water_logs_user_date_idx").on(table.userId, table.dateISO),
  ],
);

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eatenAt: timestamp("eaten_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** "breakfast" | "lunch" | "dinner" | "snack" — see MEAL_TYPES in contracts */
    mealType: text("meal_type").notNull(),
    photoUrl: text("photo_url"),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("meals_user_eaten_at_idx").on(table.userId, table.eatenAt)],
);

export const foodItems = pgTable(
  "food_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    portionDescription: text("portion_description").notNull(),
    calories: real("calories").notNull(),
    proteinG: real("protein_g").notNull(),
    carbsG: real("carbs_g").notNull(),
    fatG: real("fat_g").notNull(),
    /** AI confidence for estimated items: "high" | "medium" | "low"; null for manual entries */
    confidence: text("confidence"),
  },
  (table) => [index("food_items_meal_idx").on(table.mealId)],
);

// ---------------------------------------------------------------------------
// Push subscription / reminder notification tables
// ---------------------------------------------------------------------------

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** IANA timezone for the subscriber (e.g. "America/New_York"). */
    tz: text("tz").notNull().default("UTC"),
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    /**
     * Deduplication key: `"YYYY-MM-DD:<meal>"`. Prevents double-sends when
     * the cron fires more than once per local-hour window. Nullable so new
     * subscriptions have never-sent state.
     */
    lastSentKey: text("last_sent_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId)],
);
