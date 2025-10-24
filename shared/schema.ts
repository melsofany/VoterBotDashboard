import { pgTable, text, varchar, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Voter data schema
export const voters = pgTable("voters", {
  id: varchar("id").primaryKey(),
  nationalId: text("national_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  familyName: text("family_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),
  stance: text("stance").notNull(), // "supporter", "opponent", "neutral"
  idCardImageUrl: text("id_card_image_url"),
  representativeId: text("representative_id").notNull(),
  representativeName: text("representative_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Representative data schema
export const representatives = pgTable("representatives", {
  userId: text("user_id").primaryKey(),
  name: text("name"),
  totalVoters: real("total_voters").default(0),
  lastActiveAt: timestamp("last_active_at"),
});

export const insertVoterSchema = createInsertSchema(voters).omit({
  id: true,
  createdAt: true,
});

export const insertRepresentativeSchema = createInsertSchema(representatives).omit({
  totalVoters: true,
  lastActiveAt: true,
});

export type InsertVoter = z.infer<typeof insertVoterSchema>;
export type Voter = typeof voters.$inferSelect;

export type InsertRepresentative = z.infer<typeof insertRepresentativeSchema>;
export type Representative = typeof representatives.$inferSelect;

// Extended types for frontend use
export interface VoterWithDetails extends Voter {
  distance?: number;
}

export interface DashboardStats {
  totalVoters: number;
  supporters: number;
  opponents: number;
  neutral: number;
  todayCount: number;
  representativesCount: number;
}

export interface RepresentativePerformance extends Representative {
  votersCount: number;
  supportersCount: number;
  opponentsCount: number;
  neutralCount: number;
}
