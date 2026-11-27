// Drizzle view of the tables created by migrations/. Migrations are written
// by hand (see CLAUDE.md); keep this file in step with them.
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ms = (name: string) => integer(name, { mode: "timestamp_ms" });

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: ms("created_at").notNull(),
  updatedAt: ms("updated_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ms("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ms("access_token_expires_at"),
    refreshTokenExpiresAt: ms("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = sqliteTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ms("expires_at").notNull(),
    createdAt: ms("created_at").notNull(),
    updatedAt: ms("updated_at").notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const allowedEmails = sqliteTable("allowed_emails", {
  email: text("email").primaryKey(),
  role: text("role", { enum: ["admin", "member"] }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    sha256: text("sha256").notNull().unique(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    originalName: text("original_name").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: ["pending", "in_cloud", "on_drive"],
    }).notNull(),
    originalInCloud: integer("original_in_cloud", { mode: "boolean" })
      .notNull()
      .default(false),
    drivePath: text("drive_path"),
    takenAt: integer("taken_at"),
    createdAt: integer("created_at").notNull(),
    uploadedAt: integer("uploaded_at"),
    archivedAt: integer("archived_at"),
  },
  (t) => [index("photos_status_idx").on(t.status, t.uploadedAt)],
);

export const agentTokens = sqliteTable("agent_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  lastSeenAt: integer("last_seen_at"),
  revokedAt: integer("revoked_at"),
});
