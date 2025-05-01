# Creating User Accounts in Clerk Dashboard

Since we're facing some technical issues with programmatically creating users through Clerk's API, the simplest approach is to create the user accounts directly through the Clerk Dashboard interface.

## Steps to Create Users:

1. Go to your Clerk Dashboard: https://dashboard.clerk.com/
2. Select your application
3. Navigate to the "Users" section in the sidebar
4. Click the "Create user" button in the top right

## Create the following users:

### Admin User
- **Email**: emilynn@angelic.com
- **Password**: JayJas1423!
- **First Name**: Admin
- **Last Name**: Emily
- **Additional Info**: 
  - After creating the user, click on their entry in the user list
  - Scroll down to "Public Metadata"
  - Add `{ "role": "admin" }` as JSON to track their admin role

### Reader User
- **Email**: emilynn992@gmail.com
- **Password**: JayJas1423!
- **First Name**: Reader
- **Last Name**: Emily
- **Additional Info**:
  - After creating the user, add to "Public Metadata": 
  ```json
  {
    "role": "reader",
    "bio": "Professional psychic reader with 10 years of experience",
    "specialties": ["tarot", "astrology", "medium"],
    "rating": 4.8,
    "rate_per_minute": 4.99,
    "verified": true
  }
  ```

### Client User
- **Email**: emily81292@gmail.com
- **Password**: Jade2014!
- **First Name**: Client
- **Last Name**: Emily
- **Additional Info**:
  - After creating the user, add to "Public Metadata": `{ "role": "client" }`

## Important Notes:

1. The Clerk Dashboard automatically verifies email addresses created this way
2. You can manage user metadata through the Dashboard interface
3. After creating users, you should verify they can log in through your application
4. User roles are stored in public metadata which can be accessed in your application to determine permissions
5. The user information will be accessible through Clerk's client and server-side APIs in your application

This approach provides a more reliable way to create users when API integration is challenging. 