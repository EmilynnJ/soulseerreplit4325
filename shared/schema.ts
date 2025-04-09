import { pgTable, text, serial, integer, boolean, timestamp, json, unique, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  profileImage: text("profile_image"),
  role: text("role", { enum: ["client", "reader", "admin"] }).notNull().default("client"),
  bio: text("bio"),
  specialties: text("specialties").array(),
  pricing: integer("pricing"), // Legacy field - base price per minute in cents
  pricingChat: integer("pricing_chat"), // Chat price per minute in cents (legacy)
  pricingVoice: integer("pricing_voice"), // Voice/phone price per minute in cents (legacy)
  pricingVideo: integer("pricing_video"), // Video price per minute in cents (legacy)
  // Fixed pricing for scheduled readings
  scheduledChatPrice15: integer("scheduled_chat_price_15"), // Fixed price for 15-min chat reading
  scheduledChatPrice30: integer("scheduled_chat_price_30"), // Fixed price for 30-min chat reading
  scheduledChatPrice60: integer("scheduled_chat_price_60"), // Fixed price for 60-min chat reading 
  scheduledVoicePrice15: integer("scheduled_voice_price_15"), // Fixed price for 15-min voice reading
  scheduledVoicePrice30: integer("scheduled_voice_price_30"), // Fixed price for 30-min voice reading
  scheduledVoicePrice60: integer("scheduled_voice_price_60"), // Fixed price for 60-min voice reading
  scheduledVideoPrice15: integer("scheduled_video_price_15"), // Fixed price for 15-min video reading
  scheduledVideoPrice30: integer("scheduled_video_price_30"), // Fixed price for 30-min video reading
  scheduledVideoPrice60: integer("scheduled_video_price_60"), // Fixed price for 60-min video reading
  rating: integer("rating"),
  reviewCount: integer("review_count").default(0),
  verified: boolean("verified").default(false),
  accountBalance: integer("account_balance").default(0), // Account balance in cents
  createdAt: timestamp("created_at").defaultNow(),
  lastActive: timestamp("last_active").defaultNow(),
  isOnline: boolean("is_online").default(false),
  // No longer using Square - only Stripe
  // stripeCustomerId field already exists
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for payment processing
  // Fields for pay-per-minute readings
  balance: real("balance").default(0), // User balance in dollars
  earnings: real("earnings").default(0), // Reader's earnings in dollars
  ratePerMinute: real("rate_per_minute").default(5.0), // Reader's rate per minute in dollars
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isPaid: boolean("is_paid").default(false),
  price: integer("price"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  readerId: integer("reader_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  status: text("status", { enum: ["scheduled", "waiting_payment", "payment_completed", "in_progress", "completed", "cancelled"] }).notNull(),
  type: text("type", { enum: ["chat", "video", "voice"] }).notNull(),
  readingMode: text("reading_mode", { enum: ["scheduled", "on_demand"] }).notNull(),
  scheduledFor: timestamp("scheduled_for"),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull(), // Legacy price field (required by database)
  pricePerMinute: integer("price_per_minute").notNull(), // in cents
  totalPrice: integer("total_price"), // in cents, calculated after reading completes
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  paymentStatus: text("payment_status", { enum: ["pending", "authorized", "paid", "failed", "refunded"] }).default("pending"),
  paymentId: text("payment_id"), // Stripe payment intent ID
  paymentLinkUrl: text("payment_link_url"), // Stripe payment link URL
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  rating: integer("rating"),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // in cents
  imageUrl: text("image_url").notNull(),
  category: text("category").notNull(),
  stock: integer("stock").notNull(),
  featured: boolean("featured").default(false),
  stripeProductId: text("stripe_product_id"), // Stripe product ID
  stripePriceId: text("stripe_price_id"), // Stripe price ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "processing", "shipped", "delivered", "cancelled"] }).notNull(),
  total: integer("total").notNull(), // in cents
  shippingAddress: json("shipping_address").notNull(),
  paymentStatus: text("payment_status", { enum: ["pending", "authorized", "paid", "failed", "refunded"] }).default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"), // Stripe payment intent ID
  stripeSessionId: text("stripe_session_id"), // Stripe checkout session ID
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(), // in cents
});

export const livestreams = pgTable("livestreams", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  status: text("status", { enum: ["scheduled", "created", "live", "idle", "ended"] }).notNull(),
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  category: text("category").notNull(),
  viewerCount: integer("viewer_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  // WebRTC fields
  roomId: text("room_id"), // Used for WebRTC room identification
  recordingUrl: text("recording_url"), // URL to the recording of the livestream
  // Legacy LiveKit fields (keeping for backward compatibility)
  livekitRoomName: text("livekit_room_name"),
  duration: real("duration"), // Duration in seconds after stream ends
});

export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  likes: integer("likes").default(0),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const forumComments = pgTable("forum_comments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  postId: integer("post_id").notNull().references(() => forumPosts.id),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const gifts = pgTable("gifts", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id").notNull().references(() => users.id),
  livestreamId: integer("livestream_id").references(() => livestreams.id),
  amount: integer("amount").notNull(), // Amount in cents
  giftType: text("gift_type", { 
    enum: ["applause", "heart", "star", "diamond", "custom"] 
  }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  // Stores the split of the gift amount (70% to reader, 30% to platform)
  readerAmount: integer("reader_amount").notNull(), // 70% of amount in cents
  platformAmount: integer("platform_amount").notNull(), // 30% of amount in cents
  processed: boolean("processed").default(false), // Whether the payment has been processed to the reader
  processedAt: timestamp("processed_at"),
});

// Insert Schemas

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, lastActive: true, isOnline: true, reviewCount: true });

export const insertReadingSchema = createInsertSchema(readings)
  .omit({ 
    id: true, 
    createdAt: true, 
    completedAt: true, 
    rating: true, 
    review: true, 
    startedAt: true, 
    paymentStatus: true,
    paymentId: true,
    paymentLinkUrl: true,
    stripeCustomerId: true
  });

export const insertProductSchema = createInsertSchema(products)
  .omit({ 
    id: true, 
    createdAt: true,
    stripeProductId: true,
    stripePriceId: true
  });

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ 
    id: true, 
    createdAt: true,
    paymentStatus: true,
    stripePaymentIntentId: true,
    stripeSessionId: true
  });

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true });

export const insertLivestreamSchema = createInsertSchema(livestreams)
  .omit({ 
    id: true, 
    createdAt: true, 
    startedAt: true, 
    endedAt: true, 
    viewerCount: true,
    duration: true,
    // Don't omit roomId as we need it for WebRTC
    livekitRoomName: true
  });

export const insertForumPostSchema = createInsertSchema(forumPosts)
  .omit({ id: true, createdAt: true, updatedAt: true, likes: true, views: true });

export const insertForumCommentSchema = createInsertSchema(forumComments)
  .omit({ id: true, createdAt: true, updatedAt: true, likes: true });

export const insertMessageSchema = createInsertSchema(messages)
  .omit({ id: true, createdAt: true, readAt: true });

export const insertGiftSchema = createInsertSchema(gifts)
  .omit({ id: true, createdAt: true, processed: true, processedAt: true });
  
// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserUpdate = Partial<InsertUser> & {
  isOnline?: boolean;
  lastActive?: Date;
  stripeCustomerId?: string;
  accountBalance?: number;
  reviewCount?: number;
  // Pay-per-minute reading system fields
  balance?: number;
  earnings?: number;
  ratePerMinute?: number;
  // Fixed pricing for scheduled readings
  scheduledChatPrice15?: number;
  scheduledChatPrice30?: number;
  scheduledChatPrice60?: number;
  scheduledVoicePrice15?: number;
  scheduledVoicePrice30?: number;
  scheduledVoicePrice60?: number;
  scheduledVideoPrice15?: number;
  scheduledVideoPrice30?: number;
  scheduledVideoPrice60?: number;
};

export type InsertReading = z.infer<typeof insertReadingSchema>;
export type Reading = typeof readings.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export type InsertLivestream = z.infer<typeof insertLivestreamSchema>;
export type Livestream = typeof livestreams.$inferSelect;
export type LivestreamUpdate = Partial<InsertLivestream> & {
  startedAt?: Date;
  endedAt?: Date;
  viewerCount?: number;
  duration?: number;
  roomId?: string;
  recordingUrl?: string;
  livekitRoomName?: string;
};

export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumPost = typeof forumPosts.$inferSelect;

export type InsertForumComment = z.infer<typeof insertForumCommentSchema>;
export type ForumComment = typeof forumComments.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertGift = z.infer<typeof insertGiftSchema>;
export type Gift = typeof gifts.$inferSelect;

// Pay-per-minute reading system tables

export const sessionLogs = pgTable("session_logs", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  readerId: integer("reader_id").notNull().references(() => users.id),
  clientId: integer("client_id").notNull().references(() => users.id),
  sessionType: text("session_type", { enum: ["video", "voice", "chat"] }).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in minutes
  totalAmount: real("total_amount"), // in dollars
  readerEarned: real("reader_earned"), // in dollars (70% of total)
  platformEarned: real("platform_earned"), // in dollars (30% of total)
  status: text("status", { enum: ["waiting", "connected", "ended"] }).notNull(),
  endReason: text("end_reason"),
  createdAt: timestamp("created_at").defaultNow()
});

export const giftLogs = pgTable("gift_logs", {
  id: serial("id").primaryKey(),
  livestreamId: integer("livestream_id").references(() => livestreams.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  giftType: text("gift_type").notNull(),
  giftValue: real("gift_value").notNull(), // in dollars
  receiverEarned: real("receiver_earned").notNull(), // in dollars (70% of gift value)
  platformEarned: real("platform_earned").notNull(), // in dollars (30% of gift value)
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Insert schemas for new tables
export const insertSessionLogSchema = createInsertSchema(sessionLogs)
  .omit({ id: true, createdAt: true });

export const insertGiftLogSchema = createInsertSchema(giftLogs)
  .omit({ id: true, createdAt: true });

// Types for new tables
export type InsertSessionLog = z.infer<typeof insertSessionLogSchema>;
export type SessionLog = typeof sessionLogs.$inferSelect;

export type InsertGiftLog = z.infer<typeof insertGiftLogSchema>;
export type GiftLog = typeof giftLogs.$inferSelect;
