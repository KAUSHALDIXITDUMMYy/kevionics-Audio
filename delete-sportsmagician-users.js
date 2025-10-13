/**
 * Script to delete all users with @sportsmagician domain
 * This script removes users from both Firebase Authentication and Firestore
 * 
 * Usage: node delete-sportsmagician-users.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin (using service account for admin privileges)
// NOTE: You need to download your Firebase service account key and place it in the project root
// Download from: Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key
const serviceAccount = require('./serviceAccountKey.json');

const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Delete users with @sportsmagician domain from both Auth and Firestore
 */
async function deleteSportsMagicianUsers() {
  console.log('🔍 Starting deletion process for @sportsmagician users...\n');
  
  let deletedCount = 0;
  let errorCount = 0;
  const deletedUsers = [];
  const errors = [];

  try {
    // Step 1: Get all users from Firestore
    console.log('📋 Fetching users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    const usersToDelete = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.email && userData.email.endsWith('@sportsmagician.com')) {
        usersToDelete.push({
          uid: doc.id,
          email: userData.email,
          displayName: userData.displayName || 'N/A',
          role: userData.role || 'N/A'
        });
      }
    });

    console.log(`📊 Found ${usersToDelete.length} users with @sportsmagician domain\n`);

    if (usersToDelete.length === 0) {
      console.log('✅ No users found with @sportsmagician domain.');
      return;
    }

    // Step 2: Confirm deletion
    console.log('👥 Users to be deleted:');
    console.log('─────────────────────────────────────────────────────────────');
    usersToDelete.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Display Name: ${user.displayName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   UID: ${user.uid}`);
      console.log('─────────────────────────────────────────────────────────────');
    });

    console.log('\n⚠️  WARNING: This action cannot be undone!');
    console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');

    // Wait 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Starting deletion process...\n');

    // Step 3: Delete each user
    for (const user of usersToDelete) {
      try {
        console.log(`Processing: ${user.email}...`);

        // Delete from Firebase Authentication
        try {
          await auth.deleteUser(user.uid);
          console.log(`  ✓ Deleted from Authentication`);
        } catch (authError) {
          if (authError.code === 'auth/user-not-found') {
            console.log(`  ⚠ User not found in Authentication (may have been already deleted)`);
          } else {
            throw authError;
          }
        }

        // Delete from Firestore
        await db.collection('users').doc(user.uid).delete();
        console.log(`  ✓ Deleted from Firestore`);

        // Delete related data (stream permissions, sessions, etc.)
        // Delete stream permissions where user is subscriber
        const subscriberPermissions = await db.collection('streamPermissions')
          .where('subscriberId', '==', user.uid)
          .get();
        
        for (const doc of subscriberPermissions.docs) {
          await doc.ref.delete();
        }

        // Delete stream permissions where user is publisher
        const publisherPermissions = await db.collection('streamPermissions')
          .where('publisherId', '==', user.uid)
          .get();
        
        for (const doc of publisherPermissions.docs) {
          await doc.ref.delete();
        }

        // Delete stream sessions if publisher
        const streamSessions = await db.collection('streamSessions')
          .where('publisherId', '==', user.uid)
          .get();
        
        for (const doc of streamSessions.docs) {
          await doc.ref.delete();
        }

        // Delete subscriber assignments
        const subscriberAssignments = await db.collection('subscriberAssignments')
          .where('subscriberId', '==', user.uid)
          .get();
        
        for (const doc of subscriberAssignments.docs) {
          await doc.ref.delete();
        }

        const publisherAssignments = await db.collection('subscriberAssignments')
          .where('publisherId', '==', user.uid)
          .get();
        
        for (const doc of publisherAssignments.docs) {
          await doc.ref.delete();
        }

        console.log(`  ✓ Deleted related data`);
        console.log(`✅ Successfully deleted: ${user.email}\n`);
        
        deletedUsers.push(user);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting ${user.email}:`, error.message);
        errors.push({ user, error: error.message });
        errorCount++;
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 DELETION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Successfully deleted: ${deletedCount} users`);
    console.log(`❌ Failed deletions: ${errorCount} users`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (deletedUsers.length > 0) {
      console.log('✅ Deleted users:');
      deletedUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.role})`);
      });
      console.log('');
    }

    if (errors.length > 0) {
      console.log('❌ Failed deletions:');
      errors.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.user.email}: ${item.error}`);
      });
      console.log('');
    }

    console.log('✨ Deletion process completed!\n');

  } catch (error) {
    console.error('❌ Fatal error during deletion process:', error);
    process.exit(1);
  }
}

// Run the script
deleteSportsMagicianUsers()
  .then(() => {
    console.log('🎉 Script finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

