import { clerkClient } from '@clerk/clerk-sdk-node';

// Set Clerk API key directly in environment
process.env.CLERK_SECRET_KEY = 'sk_test_K62Kt1rn96jF7LynnyrnEtSoZJ6GcBVHtFTU2Sffy4';

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

async function setupClerkUsers() {
  try {
    console.log('Setting up Clerk users with appropriate roles...\n');
    console.log('Clerk API Key:', process.env.CLERK_SECRET_KEY ? `${process.env.CLERK_SECRET_KEY.substring(0, 10)}...` : 'Not set');
    
    // Process each user
    for (const userData of usersToSetup) {
      console.log(`\nProcessing user: ${userData.email}`);
      
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
        console.error('  Error details:', error.message);
      }
    }
    
    console.log('\n✅ All users have been processed');
    console.log('\nSummary:');
    console.log('- Admin user: emilynn@angelic.com');
    console.log('- Reader user: emilynn992@gmail.com');
    console.log('- Client user: emily81292@gmail.com');
    
  } catch (error) {
    console.error('Error setting up Clerk users:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the function
setupClerkUsers().catch(console.error); 