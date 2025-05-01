require('dotenv').config();
const axios = require('axios');

async function createClerkUsers() {
  try {
    console.log('Creating users in Clerk...');
    
    // Clerk API Key
    const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_K62Kt1rn96jF7LynnyrnEtSoZJ6GcBVHtFTU2Sffy4';
    console.log('Using Clerk API Key:', CLERK_SECRET_KEY?.substring(0, 15) + '...');
    
    const headers = {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Create admin user
    const adminUserParams = {
      email_addresses: [{
        email_address: 'emilynn@angelic.com',
        primary: true,
        verified: true
      }],
      password: 'JayJas1423!',
      username: 'emilynn_admin',
      first_name: 'Admin',
      last_name: 'Emily',
      public_metadata: {
        role: 'admin'
      }
    };
    
    // Create reader user
    const readerUserParams = {
      email_addresses: [{
        email_address: 'emilynn992@gmail.com',
        primary: true,
        verified: true
      }],
      password: 'JayJas1423!',
      username: 'emilynn_reader',
      first_name: 'Reader',
      last_name: 'Emily',
      public_metadata: {
        role: 'reader',
        bio: 'Professional psychic reader with 10 years of experience',
        specialties: ['tarot', 'astrology', 'medium'],
        rating: 4.8,
        rate_per_minute: 4.99,
        verified: true
      }
    };
    
    // Create client user
    const clientUserParams = {
      email_addresses: [{
        email_address: 'emily81292@gmail.com',
        primary: true,
        verified: true
      }],
      password: 'Jade2014!',
      username: 'emily_client',
      first_name: 'Client',
      last_name: 'Emily',
      public_metadata: {
        role: 'client'
      }
    };
    
    // Create the users
    try {
      console.log('Creating admin user...');
      const adminResponse = await axios.post(
        'https://api.clerk.com/v1/users',
        adminUserParams,
        { headers }
      );
      console.log('Admin user created:', adminResponse.data.id);
    } catch (error) {
      if (error.response && error.response.data) {
        console.error('Error creating admin user:', error.response.data);
        console.error('Status code:', error.response.status);
      } else {
        console.error('Error creating admin user:', error.message);
      }
    }
    
    try {
      console.log('Creating reader user...');
      const readerResponse = await axios.post(
        'https://api.clerk.com/v1/users',
        readerUserParams,
        { headers }
      );
      console.log('Reader user created:', readerResponse.data.id);
    } catch (error) {
      if (error.response && error.response.data) {
        console.error('Error creating reader user:', error.response.data);
        console.error('Status code:', error.response.status);
      } else {
        console.error('Error creating reader user:', error.message);
      }
    }
    
    try {
      console.log('Creating client user...');
      const clientResponse = await axios.post(
        'https://api.clerk.com/v1/users',
        clientUserParams,
        { headers }
      );
      console.log('Client user created:', clientResponse.data.id);
    } catch (error) {
      if (error.response && error.response.data) {
        console.error('Error creating client user:', error.response.data);
        console.error('Status code:', error.response.status);
      } else {
        console.error('Error creating client user:', error.message);
      }
    }
    
    console.log('User creation in Clerk complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createClerkUsers(); 