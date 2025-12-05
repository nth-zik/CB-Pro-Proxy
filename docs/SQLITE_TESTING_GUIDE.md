
# SQLite Storage Testing Guide

This guide provides comprehensive testing procedures for the SQLite profile management feature in CB Pro Proxy.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Testing Scenarios](#testing-scenarios)
  - [1. Migration Testing](#1-migration-testing)
  - [2. CRUD Operations Testing](#2-crud-operations-testing)
  - [3. Bulk Operations Performance Testing](#3-bulk-operations-performance-testing)
  - [4. Native Sync Testing](#4-native-sync-testing)
  - [5. Rollback Testing](#5-rollback-testing)
  - [6. Data Integrity Testing](#6-data-integrity-testing)
- [Performance Benchmarking](#performance-benchmarking)
- [Troubleshooting](#troubleshooting)
- [Test Data Generation](#test-data-generation)

---

## Prerequisites

Before testing the SQLite storage feature, ensure you have:

- **Node.js 18+** installed
- **Yarn** package manager (v4.10.3 or compatible)
- **Android Studio** with Android SDK (for Android testing)
- **Xcode** (for iOS testing, when available)
- **Expo CLI** (`npx expo`)
- A physical Android device or emulator
- **ADB** (Android Debug Bridge) installed and configured

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd CB-Pro-Proxy
yarn install
```

This will install all required dependencies including:
- `expo-sqlite` (v15.0.4) - SQLite database support
- `@react-native-async-storage/async-storage` (v2.2.0) - Legacy storage
- `expo-secure-store` (v15.0.7) - Secure credential storage

### 2. Verify Installation

Check that SQLite dependencies are properly installed:

```bash
# Check package.json
cat package.json | grep expo-sqlite

# Expected output:
# "expo-sqlite": "^15.0.4"
```

### 3. Build Development Client

```bash
# For Android
npx expo run:android

# For iOS (when available)
npx expo run:ios
```

---

## Testing Scenarios

### 1. Migration Testing

Test the automatic migration from AsyncStorage to SQLite.

#### Test 1.1: Fresh Installation (No Migration Needed)

**Objective:** Verify SQLite works correctly on fresh install.

**Steps:**
1. Install the app on a clean device/emulator
2. Enable SQLite storage (see User Guide)
3. Create a few test profiles
4. Verify profiles are stored in SQLite

**Expected Results:**
- No migration runs (no existing data)
- Profiles are created directly in SQLite
- App logs show: `"No profiles to migrate"`

**Verification:**
```javascript
// Check migration status via app logs
// Look for: "Migration already completed, skipping"
```

#### Test 1.2: Migration from AsyncStorage

**Objective:** Test migration of existing profiles from AsyncStorage to SQLite.

**Prerequisites:**
- App with existing profiles in AsyncStorage (SQLite disabled)
- At least 10-20 profiles with various configurations

**Steps:**
1. Verify profiles exist in AsyncStorage mode
2. Enable SQLite storage via Settings
3. Restart the app
4. Observe migration progress
5. Verify all profiles migrated successfully

**Expected Results:**
- Migration progress indicator appears
- All profiles successfully migrated
- Profile count matches before/after
- Credentials preserved (test by connecting)
- Migration flag set to prevent re-migration

**Verification Commands:**
```bash
# Check app logs for migration
adb logcat | grep -i "migration"

# Expected logs:
# "Starting migration from AsyncStorage to SQLite"
# "Found X profiles to migrate"
# "Migration completed successfully"
```

#### Test 1.3: Migration with Large Dataset

**Objective:** Test migration performance with 500+ profiles.

**Steps:**
1. Generate 500+ test profiles (see [Test Data Generation](#test-data-generation))
2. Enable SQLite storage
3. Measure migration time
4. Verify data integrity

**Expected Results:**
- Migration completes in reasonable time (< 30 seconds for 500 profiles)
- All profiles migrated successfully
- No data loss or corruption
- App remains responsive

**Performance Metrics:**
```
Expected migration times:
- 100 profiles: ~3-5 seconds
- 500 profiles: ~15-25 seconds
- 1000 profiles: ~30-45 seconds
```

---

### 2. CRUD Operations Testing

Test Create, Read, Update, Delete operations in both storage modes.

#### Test 2.1: Create Profile (SQLite Mode)

**Steps:**
1. Enable SQLite storage
2. Create a new profile with:
   - Name: "Test SOCKS5"
   - Host: "proxy.example.com"
   - Port: 1080
   - Type: SOCKS5
   - Username: "testuser"
   - Password: "testpass"
3. Verify profile appears in list
4. Check database directly

**Expected Results:**
- Profile created successfully
- Appears in profile list immediately
- Credentials stored in SecureStore
- Profile metadata in SQLite database

**Verification:**
```bash
# Check logs
adb logcat | grep "Profile created in database"

# Expected: Profile ID and name logged
```

#### Test 2.2: Read Profiles (Both Modes)

**Steps:**
1. Test in AsyncStorage mode:
   - Load profiles
   - Measure load time
2. Test in SQLite mode:
   - Load same profiles
   - Measure load time
   - Compare performance

**Expected Results:**
- SQLite mode loads faster (especially with 100+ profiles)
- All profile data intact
- Credentials accessible when needed

**Performance Comparison:**
```
AsyncStorage (500 profiles): ~2-3 seconds
SQLite (500 profiles): ~0.5-1 second
Improvement: 2-3x faster
```

#### Test 2.3: Update Profile

**Steps:**
1. Select an existing profile
2. Update fields:
   - Change host
   - Change port
   - Update credentials
3. Save changes
4. Verify updates persisted

**Expected Results:**
- Updates saved successfully
- Changes reflected immediately
- Updated timestamp changed
- Native module synced (if applicable)

#### Test 2.4: Delete Profile

**Steps:**
1. Delete a single profile
2. Verify deletion
3. Check if active profile, verify VPN stopped

**Expected Results:**
- Profile removed from list
- Database record deleted
- Credentials removed from SecureStore
- Native module synced

---

### 3. Bulk Operations Performance Testing

Test the performance improvements of bulk operations.

#### Test 3.1: Bulk Delete Performance (AsyncStorage)

**Objective:** Measure baseline performance with AsyncStorage.

**Steps:**
1. Disable SQLite storage
2. Create 500 test profiles
3. Select all profiles
4. Measure time to delete all
5. Record results

**Expected Results:**
```
AsyncStorage bulk delete (500 profiles):
- Time: ~45-60 seconds
- Method: Sequential deletion
- Performance: Baseline
```

**Measurement Code:**
```javascript
const startTime = Date.now();
await storageService.bulkDeleteProfiles(profileIds);
const duration = Date.now() - startTime;
console.log(`Bulk delete took ${duration}ms`);
```

#### Test 3.2: Bulk Delete Performance (SQLite)

**Objective:** Measure improved performance with SQLite.

**Steps:**
1. Enable SQLite storage
2. Create 500 test profiles
3. Select all profiles
4. Measure time to delete all
5. Compare with AsyncStorage results

**Expected Results:**
```
SQLite bulk delete (500 profiles):
- Time: ~1.5-3 seconds
- Method: Transaction-based batch deletion
- Performance: 15-40x faster than AsyncStorage
```

**Performance Comparison Table:**

| Operation | Profile Count | AsyncStorage | SQLite | Improvement |
|-----------|--------------|--------------|---------|-------------|
| Bulk Delete | 100 | ~10s | ~0.5s | 20x |
| Bulk Delete | 500 | ~50s | ~2s | 25x |
| Bulk Delete | 1000 | ~100s | ~3.5s | 28x |

#### Test 3.3: Bulk Create Performance

**Steps:**
1. Test bulk creation in both modes
2. Create 100 profiles at once
3. Measure and compare times

**Expected Results:**
```
AsyncStorage: ~8-12 seconds
SQLite: ~0.5-1 second
Improvement: 8-12x faster
```

#### Test 3.4: Bulk Update Performance

**Steps:**
1. Update 100 profiles simultaneously
2. Measure performance in both modes

**Expected Results:**
```
AsyncStorage: ~10-15 seconds
SQLite: ~0.8-1.5 seconds
Improvement: 10-15x faster
```

---

### 4. Native Sync Testing

Test synchronization between SQLite and native Android module.

#### Test 4.1: Profile Creation Sync

**Steps:**
1. Enable SQLite storage
2. Create a profile via UI
3. Verify native module receives update
4. Check sync log table

**Expected Results:**
- Sync operation queued
- Native module updated successfully
- Sync log shows "success" status
- Profile accessible via ADB commands

**Verification:**
```bash
# Test via ADB
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.GET_STATUS

# Should show the new profile
```

#### Test 4.2: Sync Queue Processing

**Steps:**
1. Create multiple profiles quickly
2. Observe sync queue processing
3. Verify all operations synced

**Expected Results:**
- Operations queued in order
- Processed sequentially
- All operations succeed
- No sync failures

#### Test 4.3: Sync Failure Handling

**Steps:**
1. Simulate native module unavailable
2. Create a profile
3. Observe retry mechanism
4. Restore native module
5. Verify sync completes

**Expected Results:**
- Sync marked as "failed"
- Retry count incremented
- Eventually succeeds when native available
- Error logged appropriately

---

### 5. Rollback Testing

Test migration rollback on failure.

#### Test 5.1: Simulated Migration Failure

**Objective:** Verify rollback works correctly.

**Steps:**
1. Prepare test data in AsyncStorage
2. Simulate migration failure (e.g., database error)
3. Verify rollback occurs
4. Check data integrity

**Expected Results:**
- Migration fails gracefully
- SQLite data cleared (rollback)
- AsyncStorage data intact
- App falls back to AsyncStorage mode
- User notified of failure

**Verification:**
```bash
# Check logs
adb logcat | grep "Rolling back migration"
adb logcat | grep "Migration rolled back successfully"
```

#### Test 5.2: Partial Migration Rollback

**Steps:**
1. Start migration with 100 profiles
2. Interrupt migration mid-way
3. Verify partial data rolled back
4. Retry migration

**Expected Results:**
- Partial data cleaned up
- No orphaned records
- Retry succeeds completely
- Final count matches source

---

### 6. Data Integrity Testing

Verify data integrity across operations.

#### Test 6.1: Credential Security

**Steps:**
1. Create profiles with credentials
2. Verify credentials in SecureStore (not SQLite)
3. Test credential retrieval
4. Verify encryption

**Expected Results:**
- Credentials never in SQLite database
- Stored securely in SecureStore
- Retrieved correctly when needed
- No plaintext exposure

**Verification:**
```javascript
// Credentials should NOT be in SQLite
// Check database schema - no password fields
```

#### Test 6.2: Foreign Key Constraints

**Steps:**
1. Create profile with tags
2. Delete profile
3. Verify tags automatically deleted (CASCADE)

**Expected Results:**
- Tags deleted with profile
- No orphaned tag records
- Foreign key constraints enforced

#### Test 6.3: Data Consistency

**Steps:**
1. Perform multiple operations
2. Verify counts match
3. Check for duplicates
4. Validate relationships

**Expected Results:**
- No duplicate profiles
- Tag relationships intact
- Counts accurate
- No data corruption

---

## Performance Benchmarking

### Benchmark Suite

Run comprehensive performance tests:

#### Setup Benchmark Environment

```javascript
// Create test profiles
const generateTestProfiles = (count) => {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    profiles.push({
      id: `test-${i}`,
      name: `Test Profile ${i}`,
      host: `proxy${i}.example.com`,
      port: 1080 + i,
      type: i % 2 === 0 ? 'socks5' : 'http',
      username: `user${i}`,
      password: `pass${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return profiles;
};
```

#### Run Benchmarks

```javascript
// Benchmark bulk operations
const benchmarkBulkDelete = async (profileCount) => {
  console.log(`\n=== Benchmarking ${profileCount} profiles ===`);
  
  // AsyncStorage mode
  await storageService.disableSQLite();
  const profiles = generateTestProfiles(profileCount);
  await storageService.saveProfiles(profiles);
  
  const asyncStart = Date.now();
  await storageService.bulkDeleteProfiles(profiles.map(p => p.id));
  const asyncDuration = Date.now() - asyncStart;
  
  // SQLite mode
  await storageService.enableSQLite();
  await storageService.saveProfiles(profiles);
  
  const sqliteStart = Date.now();
  await storageService.bulkDeleteProfiles(profiles.map(p => p.id));
  const sqliteDuration = Date.now() - sqliteStart;
  
  const improvement = (asyncDuration / sqliteDuration).toFixed(1);
  
  console.log(`AsyncStorage: ${asyncDuration}ms`);
  console.log(`SQLite: ${sqliteDuration}ms`);
  console.log(`Improvement: ${improvement}x faster`);
};

// Run benchmarks
await benchmarkBulkDelete(100);
await benchmarkBulkDelete(500);
await benchmarkBulkDelete(1000);
```

### Expected Benchmark Results

```
=== Benchmarking 100 profiles ===
AsyncStorage: 9500ms
SQLite: 450ms
Improvement: 21.1x faster

=== Benchmarking 500 profiles ===
AsyncStorage: 48000ms
SQLite: 1800ms
Improvement: 26.7x faster

=== Benchmarking 1000 profiles ===
AsyncStorage: 95000ms
SQLite: 3200ms
Improvement: 29.7x faster
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Migration Fails

**Symptoms:**
- Migration error message
- Profiles not appearing
- App falls back to AsyncStorage

**Solutions:**
1. Check app logs for specific error
2. Verify database permissions
3. Ensure sufficient storage space
4. Try force migration:
   ```javascript
   await migrationService.forceMigration();
   ```

#### Issue 2: Slow Performance

**Symptoms:**
- Operations take longer than expected
- UI freezes during operations

**Solutions:**
1. Verify SQLite is actually enabled
2. Check device storage performance
3. Ensure indexes are created
4. Run VACUUM to optimize database:
   ```javascript
   await databaseService.vacuum();
   ```

#### Issue 3: Data Not Syncing to Native

**Symptoms:**
- Profiles not accessible via ADB
- VPN connection fails

**Solutions:**
1. Check sync queue status
2. Verify native module is responsive
3. Check sync logs:
   ```bash
   adb logcat | grep "sync"
   ```
4. Manually trigger sync:
   ```javascript
   await nativeSyncService.processSyncQueue();
   ```

#### Issue 4: Credentials Not Loading

**Symptoms:**
- Authentication fails
- Credentials appear empty

**Solutions:**
1. Verify SecureStore is accessible
2. Check credential keys are sanitized
3

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Migration Fails

**Symptoms:**
- Migration error message
- Profiles not appearing
- App falls back to AsyncStorage

**Solutions:**
1. Check app logs for specific error
2. Verify database permissions
3. Ensure sufficient storage space
4. Try force migration:
   ```javascript
   await migrationService.forceMigration();
   ```

#### Issue 2: Slow Performance

**Symptoms:**
- Operations take longer than expected
- UI freezes during operations

**Solutions:**
1. Verify SQLite is actually enabled
2. Check device storage performance
3. Ensure indexes are created
4. Run VACUUM to optimize database:
   ```javascript
   await databaseService.vacuum();
   ```

#### Issue 3: Data Not Syncing to Native

**Symptoms:**
- Profiles not accessible via ADB
- VPN connection fails

**Solutions:**
1. Check sync queue status
2. Verify native module is responsive
3. Check sync logs:
   ```bash
   adb logcat | grep "sync"
   ```
4. Manually trigger sync:
   ```javascript
   await nativeSyncService.processSyncQueue();
   ```

#### Issue 4: Credentials Not Loading

**Symptoms:**
- Authentication fails
- Credentials appear empty

**Solutions:**
1. Verify SecureStore is accessible
2. Check credential keys are sanitized
3. Test credential retrieval manually
4. Verify profile has `has_auth` flag set

#### Issue 5: Database Locked Error

**Symptoms:**
- "Database is locked" error
- Operations fail intermittently

**Solutions:**
1. Ensure only one database connection
2. Check for long-running transactions
3. Close and reinitialize database:
   ```javascript
   await databaseService.close();
   await databaseService.initialize();
   ```

---

## Test Data Generation

### Generate Test Profiles

Use this script to generate test data for performance testing:

```javascript
/**
 * Generate test profiles for performance testing
 */
const generateTestProfiles = (count, options = {}) => {
  const {
    prefix = 'Test',
    startPort = 1080,
    withAuth = true,
    withTags = false,
  } = options;

  const profiles = [];
  
  for (let i = 0; i < count; i++) {
    const profile = {
      id: `test-profile-${Date.now()}-${i}`,
      name: `${prefix} Profile ${i + 1}`,
      host: `proxy${i}.example.com`,
      port: startPort + (i % 1000),
      type: i % 2 === 0 ? 'socks5' : 'http',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (withAuth) {
      profile.username = `user${i}`;
      profile.password = `pass${i}`;
    }

    if (withTags) {
      profile.tags = [
        `region-${i % 5}`,
        `type-${profile.type}`,
        i % 10 === 0 ? 'premium' : 'standard',
      ];
    }

    profiles.push(profile);
  }

  return profiles;
};

// Usage examples:
// Generate 500 basic profiles
const basicProfiles = generateTestProfiles(500);

// Generate 1000 profiles with authentication and tags
const fullProfiles = generateTestProfiles(1000, {
  prefix: 'Premium',
  withAuth: true,
  withTags: true,
});

// Save to storage
await storageService.saveProfiles(basicProfiles);
```

### Bulk Import Test Data

```javascript
/**
 * Import test data for migration testing
 */
const importTestData = async (count) => {
  console.log(`Importing ${count} test profiles...`);
  
  // Disable SQLite to use AsyncStorage
  await storageService.disableSQLite();
  
  // Generate and save profiles
  const profiles = generateTestProfiles(count, {
    withAuth: true,
    withTags: true,
  });
  
  await storageService.saveProfiles(profiles);
  
  console.log(`✅ Imported ${count} profiles to AsyncStorage`);
  console.log('Ready for migration testing');
};

// Import 500 profiles for testing
await importTestData(500);
```

### Clean Test Data

```javascript
/**
 * Clean up test data after testing
 */
const cleanTestData = async () => {
  console.log('Cleaning test data...');
  
  const profiles = await storageService.getProfiles();
  const testProfiles = profiles.filter(p => 
    p.name.startsWith('Test') || p.id.startsWith('test-')
  );
  
  if (testProfiles.length > 0) {
    const ids = testProfiles.map(p => p.id);
    await storageService.bulkDeleteProfiles(ids);
    console.log(`✅ Cleaned ${testProfiles.length} test profiles`);
  } else {
    console.log('No test profiles found');
  }
};

// Clean up after testing
await cleanTestData();
```

---

## Verification Checklist

Use this checklist to verify all features are working correctly:

### ✅ Basic Functionality
- [ ] SQLite can be enabled/disabled
- [ ] Profiles can be created in SQLite mode
- [ ] Profiles can be read from SQLite
- [ ] Profiles can be updated in SQLite mode
- [ ] Profiles can be deleted in SQLite mode
- [ ] Credentials stored securely (not in SQLite)

### ✅ Migration
- [ ] Migration runs automatically on first enable
- [ ] All profiles migrated successfully
- [ ] Credentials preserved after migration
- [ ] Migration flag prevents re-migration
- [ ] Migration progress displayed to user
- [ ] Failed migration triggers rollback

### ✅ Performance
- [ ] Bulk delete 15-40x faster than AsyncStorage
- [ ] Bulk create 8-12x faster
- [ ] Profile loading 2-3x faster
- [ ] UI remains responsive during operations
- [ ] Large datasets (500+) handled efficiently

### ✅ Native Sync
- [ ] Profiles sync to native module
- [ ] Sync queue processes correctly
- [ ] Failed syncs retry automatically
- [ ] Sync status tracked in database
- [ ] ADB commands work with synced profiles

### ✅ Data Integrity
- [ ] No data loss during migration
- [ ] Foreign key constraints enforced
- [ ] No duplicate profiles created
- [ ] Tags properly associated
- [ ] Timestamps accurate

### ✅ Error Handling
- [ ] Migration failures handled gracefully
- [ ] Database errors logged properly
- [ ] Rollback works correctly
- [ ] User notified of errors
- [ ] App doesn't crash on errors

---

## Test Reports

### Sample Test Report Template

```markdown
# SQLite Storage Test Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Device:** [Device Model]
**OS Version:** Android [Version]
**App Version:** [Version]

## Test Summary

- Total Tests: X
- Passed: X
- Failed: X
- Skipped: X

## Performance Results

### Bulk Delete Performance
- 100 profiles: AsyncStorage Xms, SQLite Xms (Xx improvement)
- 500 profiles: AsyncStorage Xms, SQLite Xms (Xx improvement)
- 1000 profiles: AsyncStorage Xms, SQLite Xms (Xx improvement)

### Migration Performance
- Profile count: X
- Migration time: Xs
- Success rate: X%

## Issues Found

1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce
   - Expected vs Actual behavior

## Recommendations

- [Recommendation 1]
- [Recommendation 2]

## Conclusion

[Overall assessment of SQLite storage feature]
```

---

## Additional Resources

### Useful ADB Commands

```bash
# View app logs
adb logcat | grep -i "cbv\|vpn\|sqlite\|database"

# Clear app data (reset for testing)
adb shell pm clear com.cbv.vpn

# Check app storage usage
adb shell du -sh /data/data/com.cbv.vpn

# Pull database file for inspection
adb pull /data/data/com.cbv.vpn/databases/cbv_vpn.db

# View database schema
adb shell "sqlite3 /data/data/com.cbv.vpn/databases/cbv_vpn.db '.schema'"

# Count profiles in database
adb shell "sqlite3 /data/data/com.cbv.vpn/databases/cbv_vpn.db 'SELECT COUNT(*) FROM profiles;'"
```

### Database Inspection

```bash
# Connect to database
adb shell
cd /data/data/com.cbv.vpn/databases
sqlite3 cbv_vpn.db

# Useful queries
.tables                          # List all tables
.schema profiles                 # Show table schema
SELECT COUNT(*) FROM profiles;   # Count profiles
SELECT * FROM profiles LIMIT 5;  # View sample data
SELECT * FROM sync_log;          # Check sync status
.quit                            # Exit
```

### Log Filtering

```bash
# Migration logs
adb logcat | grep -i "migration"

# Database logs
adb logcat | grep -i "database"

# Performance logs
adb logcat | grep -i "bulk\|performance"

# Error logs
adb logcat | grep -E "ERROR|WARN"

# Sync logs
adb logcat | grep -i "sync"
```

---

## Automated Testing (Future)

### Unit Test Examples

```typescript
// Example unit tests for SQLite operations
describe('ProfileRepository', () => {
  beforeEach(async () => {
    await databaseService.initialize();
    await databaseService.dropAllTables();
    await databaseService.initialize();
  });

  test('should create profile', async () => {
    const profile = createTestProfile();
    await profileRepository.create(profile);
    
    const retrieved = await profileRepository.getById(profile.id);
    expect(retrieved).toEqual(profile);
  });

  test('should bulk delete profiles', async () => {
    const profiles = generateTestProfiles(100);
    await profileRepository.bulkCreate(profiles);
    
    const ids = profiles.map(p => p.id);
    const result = await profileRepository.bulkDelete(ids);
    
    expect(result.success).toBe(true);
    expect(result.successCount).toBe(100);
    
    const count = await profileRepository.count();
    expect(count).toBe(0);
  });
});
```

---

## Support

If you encounter issues during testing:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review app logs for error details
3. Consult the [User Guide](./SQLITE_USER_GUIDE.md)
4. Report issues with:
   - Device information
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant log excerpts

---

## Conclusion

This testing guide covers comprehensive testing scenarios for the SQLite storage feature. Follow the procedures systematically to ensure the feature works correctly and delivers the expected performance improvements.

**Key Testing Focus Areas:**
1. ✅ Migration reliability
2. ✅ Performance improvements (15-40x faster)
3. ✅ Data integrity
4. ✅ Native synchronization
5. ✅ Error handling and rollback

For user-facing documentation, see the [SQLite User Guide](./SQLITE_USER_GUIDE.md).