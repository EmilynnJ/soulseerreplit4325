# SoulSeer Database Setup Guide

This document provides instructions for setting up and populating the SoulSeer application database without sample/mock data.

## Prerequisites

- Node.js installed
- Access to Neon Database (as configured in your .env file)
- Clerk API credentials (for user setup)

## Database Setup Process

### 1. Check Database Connection & Tables

Run the check-database script to verify your database connection and see which tables currently exist:

```bash
npx tsx check-database.ts
```

This will:
- Test the database connection
- Show which tables exist and how many rows they contain
- Identify missing tables

### 2. Initialize Database with Schema & Admin User

Run the initialization script to:
- Create all database tables based on the schema
- Create an initial admin user (if one doesn't exist)

```bash
npx tsx init-database.ts
```

Default admin credentials:
- Username: admin
- Email: admin@soulseer.app
- Password: admin123 (change this immediately after first login)

### 3. Set Up Clerk Users with Proper Roles

After creating users in the Clerk Dashboard, assign the correct roles using:

```bash
npx tsx setup-clerk-users.ts
```

This will update the following users with appropriate roles:
- Admin user: emilynn@angelic.com 
- Reader user: emilynn992@gmail.com (with reader-specific metadata)
- Client user: emily81292@gmail.com

### 4. Create Additional Database Users (if needed)

To manually create users in your database (separate from Clerk):

```bash
npx tsx create-user.ts <username> <email> <password> <fullName> <role>
```

Example:
```bash
npx tsx create-user.ts janedoe jane@example.com securepass "Jane Doe" reader
```

## Troubleshooting

### Connection Issues

If you encounter database connection problems:
1. Verify your .env file contains the correct connection strings
2. Check that DATABASE_URL is properly set
3. Ensure your IP is whitelisted in Neon Dashboard

### Table Creation Errors

If migration fails:
1. Check the error message for specific issues
2. Manually examine the SQL in server/migrations/01_initial_schema.sql
3. Try running migrations individually

### User Authentication Problems

For Clerk authentication issues:
1. Verify CLERK_SECRET_KEY and VITE_CLERK_PUBLISHABLE_KEY in .env
2. Check that users exist in Clerk Dashboard
3. Confirm metadata is properly set with correct roles

## Important Notes

- The database structure follows the schema defined in shared/schema.ts
- All passwords are hashed using bcrypt before storage
- Never store sensitive data in public repositories
- Always change default passwords immediately

## Database Schema Overview

The application uses the following core tables:
- users: User accounts with role-based permissions
- readings: Records of client-reader interactions
- products: Shop items and services
- orders/order_items: Purchase tracking
- livestreams: Live event management
- forum_posts/forum_comments: Community features
- messages: User-to-user communication

For a complete schema reference, see the 01_initial_schema.sql file. 