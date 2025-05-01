import { db } from './server/db';
import { users } from './shared/schema';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

// Load environment variables
config();

type UserRole = 'admin' | 'reader' | 'client';

async function createUser(
  username: string,
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  options?: {
    bio?: string;
    profileImage?: string;
    specialties?: string[];
    pricing?: number;
    verified?: boolean;
  }
) {
  try {
    // Generate secure password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Check if user with this username or email already exists
    const existingUser = await db.select().from(users).where(
      users.username === username || users.email === email
    );
    
    if (existingUser.length > 0) {
      console.error('A user with this username or email already exists.');
      return null;
    }
    
    // Set default values for optional fields
    const userOptions = {
      bio: options?.bio || null,
      profileImage: options?.profileImage || null,
      specialties: options?.specialties || null,
      pricing: options?.pricing || null,
      verified: options?.verified || false
    };
    
    // Insert the user
    const result = await db.insert(users).values({
      username,
      email,
      password: hashedPassword,
      fullName,
      role,
      ...userOptions
    }).returning();
    
    console.log(`User created successfully: ${username} (${role})`);
    return result[0];
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log('Usage: node -r tsx/cjs create-user.ts <username> <email> <password> <fullName> <role>');
    console.log('Example: node -r tsx/cjs create-user.ts john.doe john@example.com password "John Doe" client');
    console.log('Available roles: admin, reader, client');
    process.exit(1);
  }
  
  const [username, email, password, fullName, role] = args;
  
  if (!['admin', 'reader', 'client'].includes(role)) {
    console.error('Invalid role. Available roles: admin, reader, client');
    process.exit(1);
  }
  
  const user = await createUser(username, email, password, fullName, role as UserRole, {
    verified: true
  });
  
  if (user) {
    console.log('User details:');
    console.log('- ID:', user.id);
    console.log('- Username:', user.username);
    console.log('- Email:', user.email);
    console.log('- Full Name:', user.fullName);
    console.log('- Role:', user.role);
    console.log('- Verified:', user.verified);
  }
  
  process.exit(user ? 0 : 1);
}

// Export the createUser function for use in other scripts
export { createUser };

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
} 