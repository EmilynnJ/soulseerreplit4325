import { clerkClient } from '@clerk/clerk-sdk-node';
import { config } from 'dotenv';
import sql from './server/database';

// Load environment variables from all possible .env files
config({ path: '.env' });
config({ path: '.env.local' });
config({ path: '.env.production' });

// Verify Clerk API key is set
if (!process.env.CLERK_SECRET_KEY) {
  console.error('Error: CLERK_SECRET_KEY environment variable is not set.');
  console.error('Please add your Clerk Secret Key to the .env file.');
  process.exit(1);
}

// Define the user roles we want to set up
const usersToSetup = [
  {
    email: 'emilynn@angelic.com',
    role: 'admin',
    additionalMetadata: {}
  },
  {
    email: 'emilynn992@gmail.com',
    role: 'reader',
    additionalMetadata: {
      specialties: ['Tarot', 'Medium', 'Clairvoyant'],
      experience: '10+ years',
      perMinuteRate: 3.99,
      bio: 'Professional reader with expertise in tarot and mediumship.'
    }
  },
  {
    email: 'emily81292@gmail.com',
    role: 'client',
    additionalMetadata: {}
  }
];

// Function to check if a user exists in our internal database
async function checkInternalUser(email: string) {
  try {
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    return users.length > 0;
  } catch (error) {
    console.error(`Error checking for user ${email} in internal database:`, error);
    return false;
  }
}

async function setupClerkUsers() {
  try {
    console.log('Setting up Clerk users with appropriate roles...\n');
    console.log('Clerk API Key:', process.env.CLERK_SECRET_KEY ? `${process.env.CLERK_SECRET_KEY.substring(0, 10)}...` : 'Not set');
    
    // Check database connection
    try {
      const result = await sql`SELECT 1 as connected`;
      if (result && result[0] && result[0].connected === 1) {
        console.log('✅ Database connection successful');
      } else {
        console.log('❌ Database connection returned unexpected result');
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      console.log('Continuing with Clerk setup anyway...');
    }
    
    // Process each user
    for (const userData of usersToSetup) {
      console.log(`\nProcessing user: ${userData.email}`);
      
      // Check if user exists in internal database
      const internalUserExists = await checkInternalUser(userData.email);
      if (internalUserExists) {
        console.log(`  ℹ️ User already exists in internal database: ${userData.email}`);
      } else {
        console.log(`  ⚠️ User does not exist in internal database: ${userData.email}`);
        console.log('  Note: This is OK if you're using Clerk for authentication only');
      }
      
      // Find the user by email in Clerk
      try {
        const users = await clerkClient.users.getUserList({
          emailAddress: [userData.email]
        });
        
        if (users.length === 0) {
          console.log(`  ⚠️ User not found in Clerk: ${userData.email}`);
          console.log('  Please make sure the user has been created in the Clerk Dashboard');
          continue;
        }
        
        const user = users[0];
        console.log(`  ✅ Found user in Clerk: ${user.id} (${user.emailAddresses[0]?.emailAddress})`);
        
        // Prepare the metadata to update
        const publicMetadata = {
          role: userData.role,
          ...userData.additionalMetadata
        };
        
        // Update the user's metadata
        await clerkClient.users.updateUser(user.id, {
          publicMetadata
        });
        
        console.log(`  ✅ Successfully updated role to '${userData.role}' and added metadata`);
        console.log(`  Updated metadata:`, JSON.stringify(publicMetadata, null, 2));
      } catch (error) {
        console.error(`  ❌ Error processing Clerk user ${userData.email}:`, error);
      }
    }
    
    console.log('\n✅ All users have been processed');
    console.log('\nSummary:');
    console.log('- Admin user: emilynn@angelic.com');
    console.log('- Reader user: emilynn992@gmail.com');
    console.log('- Client user: emily81292@gmail.com');
    
  } catch (error) {
    console.error('Error setting up Clerk users:', error);
    process.exit(1);
  }
}

// Run the function
setupClerkUsers().catch(console.error); 