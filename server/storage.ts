import { users, type User, type InsertUser, type UserUpdate, readings, type Reading, type InsertReading, products, type Product, type InsertProduct, orders, type Order, type InsertOrder, orderItems, type OrderItem, type InsertOrderItem, livestreams, type Livestream, type InsertLivestream, forumPosts, type ForumPost, type InsertForumPost, forumComments, type ForumComment, type InsertForumComment, messages, type Message, type InsertMessage, gifts, type Gift, type InsertGift } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { pool } from "./database";
import { eq, and, or, desc, isNull, asc, sql } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPgSimple(session);

// Define SessionStore type - using any to bypass strict typing issues with session stores
type SessionStore = any;

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: UserUpdate): Promise<User | undefined>;
  getReaders(): Promise<User[]>;
  getOnlineReaders(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  
  // Readings
  createReading(reading: InsertReading): Promise<Reading>;
  getReading(id: number): Promise<Reading | undefined>;
  getReadings(): Promise<Reading[]>;
  getReadingsByClient(clientId: number): Promise<Reading[]>;
  getReadingsByReader(readerId: number): Promise<Reading[]>;
  updateReading(id: number, reading: Partial<InsertReading>): Promise<Reading | undefined>;
  
  // Products
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProducts(): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  
  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  
  // Order Items
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  
  // Livestreams
  createLivestream(livestream: InsertLivestream): Promise<Livestream>;
  getLivestream(id: number): Promise<Livestream | undefined>;
  getLivestreams(): Promise<Livestream[]>;
  getLivestreamsByUser(userId: number): Promise<Livestream[]>;
  updateLivestream(id: number, livestream: Partial<InsertLivestream>): Promise<Livestream | undefined>;
  
  // Forum Posts
  createForumPost(forumPost: InsertForumPost): Promise<ForumPost>;
  getForumPost(id: number): Promise<ForumPost | undefined>;
  getForumPosts(): Promise<ForumPost[]>;
  updateForumPost(id: number, forumPost: Partial<InsertForumPost>): Promise<ForumPost | undefined>;
  
  // Forum Comments
  createForumComment(forumComment: InsertForumComment): Promise<ForumComment>;
  getForumCommentsByPost(postId: number): Promise<ForumComment[]>;
  
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByUsers(userId1: number, userId2: number): Promise<Message[]>;
  getUnreadMessageCount(userId: number): Promise<number>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  
  // Gifts for livestreams
  createGift(gift: InsertGift): Promise<Gift>;
  getGiftsByLivestream(livestreamId: number): Promise<Gift[]>;
  getGiftsBySender(senderId: number): Promise<Gift[]>;
  getGiftsByRecipient(recipientId: number): Promise<Gift[]>;
  getUnprocessedGifts(): Promise<Gift[]>;
  markGiftAsProcessed(id: number): Promise<Gift | undefined>;
  
  // Session store for authentication
  sessionStore: SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private readings: Map<number, Reading>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private livestreams: Map<number, Livestream>;
  private forumPosts: Map<number, ForumPost>;
  private forumComments: Map<number, ForumComment>;
  private messages: Map<number, Message>;
  private gifts: Map<number, Gift>;
  
  sessionStore: SessionStore;
  
  currentUserId: number;
  currentReadingId: number;
  currentProductId: number;
  currentOrderId: number;
  currentOrderItemId: number;
  currentLivestreamId: number;
  currentForumPostId: number;
  currentForumCommentId: number;
  currentMessageId: number;
  currentGiftId: number;

  constructor() {
    this.users = new Map();
    this.readings = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.livestreams = new Map();
    this.forumPosts = new Map();
    this.forumComments = new Map();
    this.messages = new Map();
    this.gifts = new Map();
    
    this.currentUserId = 1;
    this.currentReadingId = 1;
    this.currentProductId = 1;
    this.currentOrderId = 1;
    this.currentOrderItemId = 1;
    this.currentLivestreamId = 1;
    this.currentForumPostId = 1;
    this.currentForumCommentId = 1;
    this.currentMessageId = 1;
    this.currentGiftId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  // User
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now, 
      lastActive: now, 
      isOnline: false,
      reviewCount: 0,
      squareCustomerId: null,
      profileImage: insertUser.profileImage || null,
      bio: insertUser.bio || null,
      specialties: insertUser.specialties || null,
      pricing: insertUser.pricing || null,
      rating: insertUser.rating || null,
      verified: insertUser.verified || false,
      role: insertUser.role || "client"
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: UserUpdate): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...userData,
      lastActive: userData.lastActive || new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async getReaders(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === "reader");
  }
  
  async getOnlineReaders(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === "reader" && user.isOnline);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Readings
  async createReading(insertReading: InsertReading): Promise<Reading> {
    const id = this.currentReadingId++;
    const reading: Reading = {
      ...insertReading,
      id,
      createdAt: new Date(),
      completedAt: null,
      rating: null,
      review: null,
      scheduledFor: insertReading.scheduledFor ?? null,
      notes: insertReading.notes ?? null,
      startedAt: null,
      totalPrice: null,
      duration: insertReading.duration ?? null,
      paymentStatus: "pending",
      paymentId: null,
      paymentLinkUrl: null
    };
    this.readings.set(id, reading);
    return reading;
  }
  
  async getReading(id: number): Promise<Reading | undefined> {
    return this.readings.get(id);
  }
  
  async getReadings(): Promise<Reading[]> {
    return Array.from(this.readings.values());
  }
  
  async getReadingsByClient(clientId: number): Promise<Reading[]> {
    return Array.from(this.readings.values()).filter(reading => reading.clientId === clientId);
  }
  
  async getReadingsByReader(readerId: number): Promise<Reading[]> {
    return Array.from(this.readings.values()).filter(reading => reading.readerId === readerId);
  }
  
  async updateReading(id: number, readingData: Partial<InsertReading> & {
    startedAt?: Date | null;
    completedAt?: Date | null;
    totalPrice?: number | null;
    paymentStatus?: "pending" | "authorized" | "paid" | "failed" | "refunded" | null;
    paymentId?: string | null;
    paymentLinkUrl?: string | null;
    rating?: number | null;
    review?: string | null;
  }): Promise<Reading | undefined> {
    const reading = this.readings.get(id);
    if (!reading) return undefined;
    
    const updatedReading: Reading = {
      ...reading,
      ...readingData
    };
    
    this.readings.set(id, updatedReading);
    return updatedReading;
  }
  
  // Products
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const product: Product = {
      ...insertProduct,
      id,
      createdAt: new Date(),
      featured: insertProduct.featured ?? null,
      isSynced: false,
      updatedAt: new Date(),
      squareId: insertProduct.squareId || null,
      squareVariationId: insertProduct.squareVariationId || null
    };
    this.products.set(id, product);
    return product;
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
  
  async getFeaturedProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => product.featured);
  }
  
  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct: Product = {
      ...product,
      ...productData
    };
    
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  // Orders
  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const now = new Date();
    const order: Order = {
      ...insertOrder,
      id,
      createdAt: now,
      updatedAt: now,
      paymentStatus: "pending",
      paymentLinkUrl: null,
      squareOrderId: null,
      squarePaymentId: null
    };
    this.orders.set(id, order);
    return order;
  }
  
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }
  
  async getOrdersByUser(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.userId === userId);
  }
  
  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder: Order = {
      ...order,
      ...orderData,
      updatedAt: new Date()
    };
    
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }
  
  // Order Items
  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.currentOrderItemId++;
    const orderItem: OrderItem = {
      ...insertOrderItem,
      id
    };
    this.orderItems.set(id, orderItem);
    return orderItem;
  }
  
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(item => item.orderId === orderId);
  }
  
  // Livestreams
  async createLivestream(insertLivestream: InsertLivestream): Promise<Livestream> {
    const id = this.currentLivestreamId++;
    const livestream: Livestream = {
      ...insertLivestream,
      id,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null,
      viewerCount: 0,
      scheduledFor: insertLivestream.scheduledFor ?? null
    };
    this.livestreams.set(id, livestream);
    return livestream;
  }
  
  async getLivestream(id: number): Promise<Livestream | undefined> {
    return this.livestreams.get(id);
  }
  
  async getLivestreams(): Promise<Livestream[]> {
    return Array.from(this.livestreams.values());
  }
  
  async getLivestreamsByUser(userId: number): Promise<Livestream[]> {
    return Array.from(this.livestreams.values()).filter(livestream => livestream.userId === userId);
  }
  
  async updateLivestream(id: number, livestreamData: Partial<InsertLivestream>): Promise<Livestream | undefined> {
    const livestream = this.livestreams.get(id);
    if (!livestream) return undefined;
    
    const updatedLivestream: Livestream = {
      ...livestream,
      ...livestreamData
    };
    
    this.livestreams.set(id, updatedLivestream);
    return updatedLivestream;
  }
  
  // Forum Posts
  async createForumPost(insertForumPost: InsertForumPost): Promise<ForumPost> {
    const id = this.currentForumPostId++;
    const now = new Date();
    const forumPost: ForumPost = {
      ...insertForumPost,
      id,
      createdAt: now,
      updatedAt: now,
      likes: 0,
      views: 0
    };
    this.forumPosts.set(id, forumPost);
    return forumPost;
  }
  
  async getForumPost(id: number): Promise<ForumPost | undefined> {
    return this.forumPosts.get(id);
  }
  
  async getForumPosts(): Promise<ForumPost[]> {
    return Array.from(this.forumPosts.values());
  }
  
  async updateForumPost(id: number, forumPostData: Partial<InsertForumPost>): Promise<ForumPost | undefined> {
    const forumPost = this.forumPosts.get(id);
    if (!forumPost) return undefined;
    
    const updatedForumPost: ForumPost = {
      ...forumPost,
      ...forumPostData,
      updatedAt: new Date()
    };
    
    this.forumPosts.set(id, updatedForumPost);
    return updatedForumPost;
  }
  
  // Forum Comments
  async createForumComment(insertForumComment: InsertForumComment): Promise<ForumComment> {
    const id = this.currentForumCommentId++;
    const now = new Date();
    const forumComment: ForumComment = {
      ...insertForumComment,
      id,
      createdAt: now,
      updatedAt: now,
      likes: 0
    };
    this.forumComments.set(id, forumComment);
    return forumComment;
  }
  
  async getForumCommentsByPost(postId: number): Promise<ForumComment[]> {
    return Array.from(this.forumComments.values()).filter(comment => comment.postId === postId);
  }
  
  // Messages
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      createdAt: new Date(),
      readAt: null,
      price: insertMessage.price ?? null,
      isPaid: insertMessage.isPaid ?? null
    };
    this.messages.set(id, message);
    return message;
  }
  
  async getMessagesByUsers(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      message => 
        (message.senderId === userId1 && message.receiverId === userId2) ||
        (message.senderId === userId2 && message.receiverId === userId1)
    );
  }
  
  async getUnreadMessageCount(userId: number): Promise<number> {
    return Array.from(this.messages.values()).filter(
      message => message.receiverId === userId && message.readAt === null
    ).length;
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage: Message = {
      ...message,
      readAt: new Date()
    };
    
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }
  
  // Gift methods for livestreams
  async createGift(gift: InsertGift): Promise<Gift> {
    const id = this.currentGiftId++;
    const now = new Date();
    
    // Calculate the split - 70% to reader, 30% to platform
    const readerAmount = Math.floor(gift.amount * 0.7);
    const platformAmount = gift.amount - readerAmount;
    
    const newGift: Gift = {
      ...gift,
      id,
      createdAt: now,
      readerAmount,
      platformAmount,
      processed: false,
      processedAt: null
    };
    
    this.gifts.set(id, newGift);
    return newGift;
  }
  
  async getGiftsByLivestream(livestreamId: number): Promise<Gift[]> {
    return Array.from(this.gifts.values())
      .filter(gift => gift.livestreamId === livestreamId)
      .sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
  
  async getGiftsBySender(senderId: number): Promise<Gift[]> {
    return Array.from(this.gifts.values())
      .filter(gift => gift.senderId === senderId)
      .sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
  
  async getGiftsByRecipient(recipientId: number): Promise<Gift[]> {
    return Array.from(this.gifts.values())
      .filter(gift => gift.recipientId === recipientId)
      .sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
  
  async getUnprocessedGifts(): Promise<Gift[]> {
    return Array.from(this.gifts.values())
      .filter(gift => !gift.processed)
      .sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
      });
  }
  
  async markGiftAsProcessed(id: number): Promise<Gift | undefined> {
    const gift = this.gifts.get(id);
    if (!gift) return undefined;
    
    const processedGift: Gift = {
      ...gift,
      processed: true,
      processedAt: new Date()
    };
    
    this.gifts.set(id, processedGift);
    return processedGift;
  }
  
  // Seed data for demonstration
  private seedData() {
    // No seed data in production
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: SessionStore;

  constructor() {
    // Use MemoryStore instead of PostgresSessionStore to avoid session deserialization issues
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    /* 
    // Commented out PostgresSessionStore until session issues are resolved
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
    */
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const now = new Date();
    const [createdUser] = await db.insert(users).values({
      ...user,
      createdAt: now,
      lastActive: now,
      isOnline: false,
      reviewCount: 0,
      accountBalance: 0,
      squareCustomerId: null,
      stripeCustomerId: null
    }).returning();

    return createdUser;
  }

  async updateUser(id: number, userData: UserUpdate): Promise<User | undefined> {
    const lastActive = userData.lastActive || new Date();
    const [updatedUser] = await db.update(users)
      .set({ ...userData, lastActive })
      .where(eq(users.id, id))
      .returning();

    return updatedUser;
  }

  async getReaders(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "reader"));
  }

  async getOnlineReaders(): Promise<User[]> {
    return await db.select().from(users)
      .where(and(
        eq(users.role, "reader"),
        eq(users.isOnline, true)
      ));
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Reading methods
  async createReading(reading: InsertReading): Promise<Reading> {
    const [createdReading] = await db.insert(readings).values({
      ...reading,
      duration: reading.duration ?? null,
      createdAt: new Date(),
      completedAt: null,
      rating: null,
      review: null,
      scheduledFor: reading.scheduledFor ?? null,
      notes: reading.notes ?? null,
      startedAt: null,
      totalPrice: null,
      paymentStatus: "pending",
      paymentId: null,
      paymentLinkUrl: null
    }).returning();

    return createdReading;
  }

  async getReading(id: number): Promise<Reading | undefined> {
    const [reading] = await db.select().from(readings).where(eq(readings.id, id));
    return reading;
  }
  
  async getReadings(): Promise<Reading[]> {
    return await db.select().from(readings);
  }

  async getReadingsByClient(clientId: number): Promise<Reading[]> {
    return await db.select().from(readings).where(eq(readings.clientId, clientId));
  }

  async getReadingsByReader(readerId: number): Promise<Reading[]> {
    return await db.select().from(readings).where(eq(readings.readerId, readerId));
  }

  async updateReading(id: number, readingData: Partial<InsertReading> & {
    startedAt?: Date | null;
    completedAt?: Date | null;
    totalPrice?: number | null;
    paymentStatus?: "pending" | "authorized" | "paid" | "failed" | "refunded" | null;
    paymentId?: string | null;
    paymentLinkUrl?: string | null;
    rating?: number | null;
    review?: string | null;
  }): Promise<Reading | undefined> {
    const [updatedReading] = await db.update(readings)
      .set(readingData)
      .where(eq(readings.id, id))
      .returning();
      
    return updatedReading;
  }

  // Product methods
  async createProduct(product: InsertProduct): Promise<Product> {
    const now = new Date();
    const [createdProduct] = await db.insert(products).values({
      ...product,
      createdAt: now,
      updatedAt: now,
      isSynced: false,
      squareId: product.squareId || null,
      squareVariationId: product.squareVariationId || null
    }).returning();
    
    return createdProduct;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getFeaturedProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.featured, true));
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
      
    return updatedProduct;
  }

  // Order methods
  async createOrder(order: InsertOrder): Promise<Order> {
    const now = new Date();
    const [createdOrder] = await db.insert(orders).values({
      ...order,
      createdAt: now,
      updatedAt: now,
      paymentStatus: "pending",
      paymentLinkUrl: null,
      squareOrderId: null,
      squarePaymentId: null
    }).returning();
    
    return createdOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByUser(userId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
      
    return updatedOrder;
  }

  // Order Item methods
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [createdOrderItem] = await db.insert(orderItems).values(orderItem).returning();
    return createdOrderItem;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // Livestream methods
  async createLivestream(livestream: InsertLivestream): Promise<Livestream> {
    const [createdLivestream] = await db.insert(livestreams).values({
      ...livestream,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null,
      viewerCount: 0,
      scheduledFor: livestream.scheduledFor ?? null
    }).returning();
    
    return createdLivestream;
  }

  async getLivestream(id: number): Promise<Livestream | undefined> {
    const [livestream] = await db.select().from(livestreams).where(eq(livestreams.id, id));
    return livestream;
  }

  async getLivestreams(): Promise<Livestream[]> {
    return await db.select().from(livestreams);
  }

  async getLivestreamsByUser(userId: number): Promise<Livestream[]> {
    return await db.select().from(livestreams).where(eq(livestreams.userId, userId));
  }

  async updateLivestream(id: number, livestreamData: Partial<InsertLivestream>): Promise<Livestream | undefined> {
    const [updatedLivestream] = await db.update(livestreams)
      .set(livestreamData)
      .where(eq(livestreams.id, id))
      .returning();
      
    return updatedLivestream;
  }

  // Forum Post methods
  async createForumPost(forumPost: InsertForumPost): Promise<ForumPost> {
    const now = new Date();
    const [createdForumPost] = await db.insert(forumPosts).values({
      ...forumPost,
      createdAt: now,
      updatedAt: now,
      likes: 0,
      views: 0
    }).returning();
    
    return createdForumPost;
  }

  async getForumPost(id: number): Promise<ForumPost | undefined> {
    const [forumPost] = await db.select().from(forumPosts).where(eq(forumPosts.id, id));
    return forumPost;
  }

  async getForumPosts(): Promise<ForumPost[]> {
    return await db.select().from(forumPosts).orderBy(desc(forumPosts.createdAt));
  }

  async updateForumPost(id: number, forumPostData: Partial<InsertForumPost>): Promise<ForumPost | undefined> {
    const [updatedForumPost] = await db.update(forumPosts)
      .set({ ...forumPostData, updatedAt: new Date() })
      .where(eq(forumPosts.id, id))
      .returning();
      
    return updatedForumPost;
  }

  // Forum Comment methods
  async createForumComment(forumComment: InsertForumComment): Promise<ForumComment> {
    const now = new Date();
    const [createdForumComment] = await db.insert(forumComments).values({
      ...forumComment,
      createdAt: now,
      updatedAt: now,
      likes: 0
    }).returning();
    
    return createdForumComment;
  }

  async getForumCommentsByPost(postId: number): Promise<ForumComment[]> {
    return await db.select().from(forumComments)
      .where(eq(forumComments.postId, postId))
      .orderBy(asc(forumComments.createdAt));
  }

  // Message methods
  async createMessage(message: InsertMessage): Promise<Message> {
    const [createdMessage] = await db.insert(messages).values({
      ...message,
      createdAt: new Date(),
      readAt: null,
      price: message.price ?? null,
      isPaid: message.isPaid ?? null
    }).returning();
    
    return createdMessage;
  }

  async getMessagesByUsers(userId1: number, userId2: number): Promise<Message[]> {
    return await db.select().from(messages).where(
      or(
        and(
          eq(messages.senderId, userId1),
          eq(messages.receiverId, userId2)
        ),
        and(
          eq(messages.senderId, userId2),
          eq(messages.receiverId, userId1)
        )
      )
    ).orderBy(asc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, userId),
          isNull(messages.readAt)
        )
      );
    
    return Number(result[0]?.count || 0);
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [updatedMessage] = await db.update(messages)
      .set({ readAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
      
    return updatedMessage;
  }
  
  // Gift methods for livestreams
  async createGift(gift: InsertGift): Promise<Gift> {
    // Calculate the split - 70% to reader, 30% to platform
    const readerAmount = Math.floor(gift.amount * 0.7);
    const platformAmount = gift.amount - readerAmount;
    
    const [createdGift] = await db.insert(gifts).values({
      ...gift,
      readerAmount,
      platformAmount,
      processed: false,
      createdAt: new Date()
    }).returning();
    
    return createdGift;
  }
  
  async getGiftsByLivestream(livestreamId: number): Promise<Gift[]> {
    return await db.select().from(gifts)
      .where(eq(gifts.livestreamId, livestreamId))
      .orderBy(desc(gifts.createdAt));
  }
  
  async getGiftsBySender(senderId: number): Promise<Gift[]> {
    return await db.select().from(gifts)
      .where(eq(gifts.senderId, senderId))
      .orderBy(desc(gifts.createdAt));
  }
  
  async getGiftsByRecipient(recipientId: number): Promise<Gift[]> {
    return await db.select().from(gifts)
      .where(eq(gifts.recipientId, recipientId))
      .orderBy(desc(gifts.createdAt));
  }
  
  async getUnprocessedGifts(): Promise<Gift[]> {
    return await db.select().from(gifts)
      .where(eq(gifts.processed, false))
      .orderBy(asc(gifts.createdAt)); // Process oldest first
  }
  
  async markGiftAsProcessed(id: number): Promise<Gift | undefined> {
    const now = new Date();
    const [processedGift] = await db.update(gifts)
      .set({ 
        processed: true,
        processedAt: now
      })
      .where(eq(gifts.id, id))
      .returning();
      
    return processedGift;
  }
}

// Use DatabaseStorage instead of MemStorage for production
export const storage = new DatabaseStorage();
