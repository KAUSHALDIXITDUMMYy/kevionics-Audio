# Delete @sportsmagician Users Script

This document provides instructions for deleting all users with the `@sportsmagician` email domain from both Firebase Authentication and Firestore.

## Prerequisites

Before running the deletion script, you need to set up Firebase Admin SDK credentials:

### 1. Generate Service Account Key

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **kevonics-audio**
3. Click on **Project Settings** (gear icon)
4. Navigate to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the downloaded JSON file as `serviceAccountKey.json` in the project root directory

### 2. Install Firebase Admin SDK

If not already installed, add the Firebase Admin SDK:

```bash
npm install firebase-admin
```

## Running the Script

### Option 1: Using npm script

```bash
npm run delete-sportsmagician-users
```

### Option 2: Using node directly

```bash
node delete-sportsmagician-users.js
```

## What the Script Does

The script performs the following operations:

1. **Fetches all users** from Firestore with `@sportsmagician` email domain
2. **Displays a list** of users that will be deleted
3. **Waits 5 seconds** to allow cancellation (Press Ctrl+C to abort)
4. **Deletes each user** from:
   - Firebase Authentication
   - Firestore `users` collection
   - Related stream permissions (as subscriber)
   - Related stream permissions (as publisher)
   - Stream sessions
   - Subscriber assignments

5. **Provides a summary** of successful deletions and any errors

## Safety Features

- ⏱️ **5-second delay** before starting deletion (press Ctrl+C to cancel)
- 📊 **Preview of users** before deletion
- 🔍 **Detailed logging** of each step
- ❌ **Error handling** with detailed error messages
- ✅ **Summary report** at the end

## Example Output

```
🔍 Starting deletion process for @sportsmagician users...

📋 Fetching users from Firestore...
📊 Found 3 users with @sportsmagician domain

👥 Users to be deleted:
─────────────────────────────────────────────────────────────
1. Email: user1@sportsmagician
   Display Name: User One
   Role: subscriber
   UID: abc123...
─────────────────────────────────────────────────────────────

⚠️  WARNING: This action cannot be undone!
⚠️  Press Ctrl+C within 5 seconds to cancel...

🗑️  Starting deletion process...

Processing: user1@sportsmagician...
  ✓ Deleted from Authentication
  ✓ Deleted from Firestore
  ✓ Deleted related data
✅ Successfully deleted: user1@sportsmagician

═══════════════════════════════════════════════════════════
📊 DELETION SUMMARY
═══════════════════════════════════════════════════════════
✅ Successfully deleted: 3 users
❌ Failed deletions: 0 users
═══════════════════════════════════════════════════════════

✨ Deletion process completed!
🎉 Script finished successfully!
```

## Important Notes

⚠️ **WARNING**: This operation is **irreversible**! Once users are deleted:
- They cannot be recovered
- All their data is permanently removed
- They will need to be recreated manually if needed

💡 **Recommendation**: Before running this script:
1. Backup your Firestore database
2. Verify the list of users to be deleted
3. Ensure you're running this on the correct Firebase project

## Troubleshooting

### Error: "Cannot find module './serviceAccountKey.json'"

**Solution**: You need to download the Firebase service account key and place it in the project root. See "Prerequisites" section above.

### Error: "Insufficient permissions"

**Solution**: Ensure the service account has the following permissions:
- Firebase Authentication Admin
- Cloud Firestore Admin

### Error: "auth/user-not-found"

This is normal if a user was already deleted from Firebase Auth but still exists in Firestore. The script will continue and clean up the Firestore data.

## Admin Panel Updates

The admin panel has been enhanced with user role filtering:

### New Features

1. **Role Filter Dropdown**: Located in the Users Table header
   - Filter by: All Users, Admins, Publishers, or Subscribers
   - Shows count for each category

2. **Dynamic Display**: 
   - Shows filtered user count vs total users
   - Empty state message when no users match filter

3. **Statistics Cards**: 
   - Total Users
   - Active Users
   - Publishers count
   - Subscribers count

### Usage

1. Navigate to Admin Dashboard → User Management tab
2. Click the "Filter by Role" dropdown in the Users Table section
3. Select the desired role (or "All Users" to show everyone)
4. The table will update to show only users with that role

## Support

If you encounter any issues or need assistance, please contact the development team.


