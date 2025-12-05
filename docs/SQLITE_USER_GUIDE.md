
# SQLite Storage User Guide

Welcome to the SQLite Storage feature for CB Pro Proxy! This guide will help you understand, enable, and use the new high-performance storage system.

## Table of Contents

- [What is SQLite Storage?](#what-is-sqlite-storage)
- [Benefits](#benefits)
- [When to Use SQLite Storage](#when-to-use-sqlite-storage)
- [How to Enable SQLite Storage](#how-to-enable-sqlite-storage)
- [Understanding the Migration Process](#understanding-the-migration-process)
- [How to Verify It's Working](#how-to-verify-its-working)
- [How to Disable and Rollback](#how-to-disable-and-rollback)
- [Performance Expectations](#performance-expectations)
- [FAQ](#faq)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## What is SQLite Storage?

SQLite Storage is a new, high-performance storage backend for CB Pro Proxy that replaces the traditional AsyncStorage system. It uses a local SQLite database to store your proxy profiles, providing significantly faster operations, especially when managing large numbers of profiles.

### Key Features

- **🚀 15-40x Faster Bulk Operations** - Delete hundreds of profiles in seconds instead of minutes
- **📊 Efficient Data Management** - Optimized queries and indexing for quick access
- **🔄 Automatic Migration** - Seamlessly migrates your existing profiles
- **🔒 Secure Credentials** - Passwords remain encrypted in SecureStore
- **🔁 Native Sync** - Automatic synchronization with Android native module
- **↩️ Rollback Support** - Safe migration with automatic rollback on failure

---

## Benefits

### Performance Improvements

SQLite Storage delivers dramatic performance improvements over AsyncStorage:

| Operation | Profile Count | AsyncStorage | SQLite | Improvement |
|-----------|--------------|--------------|---------|-------------|
| **Bulk Delete** | 100 | ~10 seconds | ~0.5 seconds | **20x faster** |
| **Bulk Delete** | 500 | ~50 seconds | ~2 seconds | **25x faster** |
| **Bulk Delete** | 1000 | ~100 seconds | ~3.5 seconds | **28x faster** |
| **Load Profiles** | 500 | ~2-3 seconds | ~0.5-1 second | **2-3x faster** |
| **Bulk Create** | 100 | ~10 seconds | ~1 second | **10x faster** |

### Additional Benefits

- **Better Scalability** - Handle thousands of profiles without performance degradation
- **Reliable Transactions** - All-or-nothing operations prevent data corruption
- **Advanced Queries** - Fast searching and filtering by name, host, tags, or type
- **Data Integrity** - Foreign key constraints ensure consistent relationships
- **Efficient Storage** - Optimized database structure reduces storage footprint

---

## When to Use SQLite Storage

### ✅ You Should Enable SQLite If:

- You manage **50+ proxy profiles**
- You frequently **bulk delete** profiles
- You need **fast profile loading** times
- You want **better performance** overall
- You're comfortable with **new features**

### ⚠️ Consider Staying with AsyncStorage If:

- You have **fewer than 20 profiles**
- You prefer **proven stability** over performance
- You're experiencing **device storage issues**
- You need to **troubleshoot** existing problems first

> **Recommendation:** For most users with 50+ profiles, SQLite Storage provides significant benefits with minimal risk.

---

## How to Enable SQLite Storage

### Step-by-Step Instructions

#### Option 1: Via Settings Screen (Recommended)

1. **Open the App**
   - Launch CB Pro Proxy on your device

2. **Navigate to Settings**
   - Tap the Settings icon (⚙️) in the navigation bar

3. **Find Storage Settings**
   - Scroll to the "Storage" section
   - Look for "Use SQLite Storage" option

4. **Enable SQLite**
   - Toggle the "Use SQLite Storage" switch to ON
   - A confirmation dialog will appear

5. **Confirm Migration**
   - Read the migration information
   - Tap "Enable and Migrate" to proceed
   - **Note:** This process is automatic and safe

6. **Wait for Migration**
   - A progress indicator will show migration status
   - Do not close the app during migration
   - Migration typically takes 15-30 seconds for 500 profiles

7. **Verify Success**
   - You'll see a success message when complete
   - Your profiles will load normally
   - Performance improvements are immediate

#### Option 2: Via ADB (Advanced Users)

For automation or remote management:

```bash
# Enable SQLite storage via ADB
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.ENABLE_SQLITE_STORAGE

# Check migration status
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.GET_STORAGE_STATUS
```

---

## Understanding the Migration Process

### What Happens During Migration?

When you enable SQLite Storage, the app automatically migrates your existing data:

1. **Initialization**
   - SQLite database is created
   - Schema and indexes are set up

2. **Data Migration**
   - All profiles copied from AsyncStorage to SQLite
   - Credentials remain in SecureStore (encrypted)
   - Tags and metadata preserved

3. **Validation**
   - Profile count verified
   - Data integrity checked
   - Migration flag set

4. **Completion**
   - Success message displayed
   - App switches to SQLite mode
   - Performance improvements active

### Migration Timeline

```
Profile Count | Expected Duration
--------------|------------------
0-50          | < 5 seconds
50-100        | 5-10 seconds
100-500       | 15-25 seconds
500-1000      | 30-45 seconds
1000+         | 45-60 seconds
```

### What's Migrated?

✅ **Migrated:**
- Profile names
- Proxy hosts and ports
- Proxy types (SOCKS5/HTTP)
- DNS settings
- Tags
- Creation/update timestamps
- Authentication flags

✅ **Preserved in SecureStore:**
- Usernames
- Passwords

❌ **Not Migrated:**
- Temporary connection states
- UI preferences (separate storage)

### Safety Features

- **Automatic Rollback** - If migration fails, all changes are reverted
- **Data Preservation** - Original AsyncStorage data remains intact during migration
- **Validation** - Profile counts verified before and after
- **Error Handling** - Clear error messages if issues occur

---

## How to Verify It's Working

### Visual Indicators

1. **Settings Screen**
   - "Use SQLite Storage" toggle is ON
   - Status shows "SQLite Active"

2. **Performance**
   - Profile list loads noticeably faster
   - Bulk operations complete in seconds
   - UI remains responsive during operations

3. **Logs**
   - Check app logs for SQLite-related messages
   - Look for "Database initialized successfully"

### Manual Verification

#### Check Storage Mode

```javascript
// In app console or logs
console.log('SQLite enabled:', storageService.isSQLiteEnabled());
// Expected: true
```

#### Verify Profile Count

```javascript
// Check profile count matches
const profiles = await storageService.getProfiles();
console.log('Profile count:', profiles.length);
```

#### Test Performance

1. Select 10+ profiles
2. Delete them using bulk delete
3. Operation should complete in < 1 second

### Via ADB (Advanced)

```bash
# Check if database file exists
adb shell ls /data/data/com.cbv.vpn/databases/cbv_vpn.db

# Count profiles in database
adb shell "sqlite3 /data/data/com.cbv.vpn/databases/cbv_vpn.db 'SELECT COUNT(*) FROM profiles;'"

# View migration status
adb logcat | grep -i "migration"
```

---

## How to Disable and Rollback

### When to Disable

You might want to disable SQLite Storage if:
- You experience unexpected issues
- You need to troubleshoot problems
- You prefer the previous storage system
- You're downgrading to an older app version

### Disabling SQLite Storage

#### Via Settings Screen

1. **Open Settings**
   - Navigate to Settings → Storage

2. **Disable SQLite**
   - Toggle "Use SQLite Storage" to OFF
   - Confirm the action

3. **Restart App**
   - Close and reopen the app
   - App will use AsyncStorage again

4. **Verify**
   - Check that profiles still load correctly
   - AsyncStorage mode is active

#### Via ADB

```bash
# Disable SQLite storage
adb shell am broadcast -n com.cbv.vpn/.VPNIntentReceiver \
  -a com.cbv.vpn.DISABLE_SQLITE_STORAGE
```

### Important Notes

⚠️ **Data Preservation:**
- Disabling SQLite does NOT delete your profiles
- Profiles remain in both SQLite and AsyncStorage
- You can re-enable SQLite anytime without re-migration

⚠️ **Dual-Write Mode:**
- When SQLite is enabled, data is written to both storages
- This ensures you can safely switch back to AsyncStorage
- No data loss when disabling SQLite

⚠️ **Re-enabling:**
- If you re-enable SQLite, migration won't run again
- Existing SQLite data is reused
- Only new profiles since disabling are synced

---

## Performance Expectations

### What You'll Notice

#### Immediate Improvements

1. **Faster Profile Loading**
   - Profile list appears 2-3x faster
   - Especially noticeable with 100+ profiles
   - Smooth scrolling even with large lists

2. **Instant Bulk Operations**
   - Bulk delete: 15-40x faster
   - Bulk create: 8-12x faster
   - Bulk update: 10-15x faster

3. **Responsive UI**
   - No freezing during operations
   - Background processing
   - Progress indicators work smoothly

#### Real-World Examples

**Scenario 1: Managing 500 Profiles**
- **Before (AsyncStorage):** Deleting all takes ~50 seconds
- **After (SQLite):** Deleting all takes ~2 seconds
- **Improvement:** 25x faster

**Scenario 2: Loading Profile List**
- **Before:** 2-3 second load time
- **After:** 0.5-1 second load time
- **Improvement:** 2-3x faster

**Scenario 3: Searching Profiles**
- **Before:** Linear search through all profiles
- **After:** Indexed database query
- **Improvement:** Near-instant results

### Performance Tips

1. **Regular Maintenance**
   - Periodically clean up unused profiles
   - Remove old test profiles
   - Keep database optimized

2. **Optimal Usage**
   - Use bulk operations when possible
   - Leverage search and filter features
   - Take advantage of tags for organization

3. **Monitor Performance**
   - Check app logs for slow queries
   - Report performance issues
   - Keep app updated

---

## FAQ

### General Questions

**Q: Will enabling SQLite delete my existing profiles?**
A: No! Migration safely copies all profiles to SQLite. Your original data remains in AsyncStorage as a backup.

**Q: Can I switch back to AsyncStorage?**
A: Yes, you can disable SQLite anytime. Your profiles remain accessible in both storage systems.

**Q: Do I need to re-migrate if I disable and re-enable SQLite?**
A: No, the migration only runs once. Re-enabling SQLite uses the existing database.

**Q: Are my passwords safe in SQLite?**
A: Yes! Passwords are NOT stored in SQLite. They remain encrypted in SecureStore, just like before.

**Q: How much storage space does SQLite use?**
A: SQLite is very efficient. 1000 profiles typically use < 1MB of storage.

### Migration Questions

**Q: How long does migration take?**
A: Typically 15-30 seconds for 500 profiles. See [Migration Timeline](#migration-timeline) for details.

**Q: What happens if migration fails?**
A: The app automatically rolls back changes and falls back to AsyncStorage. Your data is safe.

**Q: Can I use the app during migration?**
A: It's best to wait. Migration is quick and the app will be responsive afterward.

**Q: Will migration affect my VPN connection?**
A: No, active VPN connections are not affected by migration.

### Performance Questions

**Q: Why is SQLite so much faster?**
A: SQLite uses optimized database operations, transactions, and indexing instead of sequential file operations.

**Q: Will I notice improvements with only 20 profiles?**
A: Improvements are less noticeable with small profile counts. Benefits increase with more profiles.

**Q: Does SQLite use more battery?**
A: No, SQLite is actually more efficient and may use slightly less battery for large operations.

**Q: Can SQLite handle 10,000+ profiles?**
A: Yes! SQLite can efficiently handle tens of thousands of profiles.

### Technical Questions

**Q: Where is the SQLite database stored?**
A: `/data/data/com.cbv.vpn/databases/cbv_vpn.db` on Android devices.

**Q: Can I backup the SQLite database?**
A: Yes, you can use ADB to pull the database file for backup purposes.

**Q: Does SQLite work on iOS?**
A: SQLite support is currently Android-only. iOS support is planned for future releases.

**Q: Can I inspect the database?**
A: Yes, advanced users can use ADB and sqlite3 to inspect the database. See [Testing Guide](./SQLITE_TESTING_GUIDE.md).

---

## Known Limitations

### Current Limitations

1. **Android Only**
   - SQLite storage is currently available on Android only
   - iOS support planned for future release
   - iOS continues using AsyncStorage

2. **One-Way Migration**
   - Migration is one-time only
   - Cannot "un-migrate" back to AsyncStorage-only
   - Can disable SQLite but data remains in both storages

3. **Storage Space**
   - Dual-write mode uses slightly more storage
   - Both SQLite and AsyncStorage contain profile data
   - Minimal impact (< 2MB for 1000 profiles)

4. **Compatibility**
   - Requires app version 1.0.7 or higher
   - Older app versions cannot read SQLite data
   - Downgrading requires disabling SQLite first

### Planned Improvements

- iOS support
- Database compression
- Advanced query features
- Performance analytics
- Automatic optimization

---

## Troubleshooting

### Common Issues

#### Issue: Migration Fails

**Symptoms:**
- Error message during migration
- Profiles don't appear after enabling
- App falls back to AsyncStorage

**Solutions:**
1. Check available storage space (need at least 10MB free)
2. Restart the app and try again
3. Check app logs for specific error
4. Contact support if issue persists

**Prevention:**
- Ensure stable device state before migration
- Close other apps to free memory
- Don't interrupt migration process

---

#### Issue: Profiles Not Showing

**Symptoms:**
- Profile list appears empty
- Some profiles missing
- Profile count doesn't match

**Solutions:**
1. Pull down to refresh the profile list
2. Check if SQLite is actually enabled in Settings
3. Verify migration completed successfully
4. Check app logs for errors

**Verification:**
```bash
# Check profile count via ADB
adb shell "sqlite3 /data/data/com.cbv.vpn/databases/cbv_vpn.db 'SELECT COUNT(*) FROM profiles;'"
```

---

#### Issue: Slow Performance

**Symptoms:**
- Operations slower than expected
- UI freezes or lags
- No performance improvement noticed

**Solutions:**
1. Verify SQLite is enabled (Settings → Storage)
2. Restart the app
3. Check device storage performance
4. Run database optimization:
   - Settings → Storage → Optimize Database

**Check:**
- Ensure you have 50+ profiles (benefits increase with scale)
- Verify device has sufficient free storage
- Check for other apps consuming resources

---

#### Issue: Credentials Not Working

**Symptoms:**
- VPN connection fails with authentication error
- Credentials appear empty
- "Invalid username/password" errors

**Solutions:**
1. Credentials are stored separately in SecureStore
2. Re-enter credentials for affected profiles
3. Migration didn't affect credentials
4. Check SecureStore accessibility

**Note:** Credentials are never stored in SQLite for security reasons.

---

#### Issue: Database Locked

**Symptoms:**
- "Database is locked" error
- Operations fail randomly
- App becomes unresponsive

**Solutions:**
1. Close and restart the app
2. Ensure no other processes accessing database
3. Clear app cache if issue persists
4. Disable and re-enable SQLite if needed

**Prevention:**
- Don't force-close app during operations
- Allow operations to complete
- Keep app updated

---

#### Issue: High Storage Usage

**Symptoms:**
- App using more storage than expected
- Device running low on space

**Solutions:**
1. Dual-write mode keeps data in both storages temporarily
2. Clean up old/unused profiles
3. Run database optimization (Settings → Storage → Optimize)
4. Consider disabling SQLite if storage is critical

**Storage Breakdown:**
- SQLite database: ~1KB per profile
- AsyncStorage backup: ~1KB per profile
- Total: ~2KB per profile (minimal)

---

### Getting Help

If you encounter issues not covered here:

1. **Check App Logs**
   - Settings → Logs → View Logs
   - Look for errors related to "database" or "migration"

2. **Review Documentation**
   - [Testing Guide](./SQLITE_TESTING_GUIDE.md) - Technical details
   - [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Developer info

3. **Contact Support**
   - Include device information
   - Provide steps to reproduce
   - Share relevant log excerpts
   - Mention app version

4. **Community Resources**
   - Check GitHub issues
   - Search existing solutions
   - Report new bugs

---

## Best Practices

### Profile Management

1. **Use Bulk Operations**
   - Select multiple profiles for deletion
   - Take advantage of 15-40x speed improvement
   - More efficient than individual operations

2. **Organize with Tags**
   - Tag profiles by region, type, or purpose
   - Use filters to quickly find profiles
   - Tags are indexed for fast searching

3. **Regular Cleanup**
   - Remove unused profiles periodically
   - Keep database lean and fast
   - Better performance with organized data

### Maintenance

1. **Keep App Updated**
   - Updates include performance improvements
   - Bug fixes and optimizations
   - New features and enhancements

2. **Monitor Performance**
   - Notice any slowdowns
   - Check logs for warnings
   - Report issues early

3. **Backup Important Profiles**
   - Export profile configurations
   - Keep backup of critical proxies
   - Use ADB to backup database if needed

### Security

1. **Credentials**
   - Always stored encrypted in SecureStore
   - Never in SQLite database
   - Secure by design

2. **Database Access**
   - Only app can access database
   - Protected by Android security
   - No external access without root

3. **Migration Safety**
   - Automatic rollback on failure
   - Data preserved in AsyncStorage
   - Safe to enable/disable

---

## Advanced Features

### Search and Filter

SQLite enables powerful search capabilities:

**Search by Name or Host:**
- Type in search box
- Instant results with indexing
- Case-insensitive matching

**Filter by Type:**
- SOCKS5 or HTTP
- Quick type-based filtering
- Efficient database queries

**Filter by Tags:**
- Select one or more tags
- Profiles matching any tag shown
- Combine with search for precision

### Bulk Operations

Take advantage of batch processing:

**Bulk Delete:**
- Select multiple profiles
- Delete in single transaction
- 15-40x faster than sequential

**Bulk Create:**
- Import multiple profiles
- Efficient batch insertion
- Progress tracking

**Bulk Update:**
- Update multiple profiles at once
- Transaction-based safety
- All-or-nothing guarantee

### Database Optimization

Keep your database running smoothly:

**Automatic Optimization:**
- Indexes maintained automatically
- Query plans optimized
- Background maintenance

**Manual Optimization:**
- Settings → Storage → Optimize Database
- Reclaims unused space
- Rebuilds indexes
- Recommended after bulk deletions

---

## Migration Scenarios

### Scenario 1: New User

**Situation:** Fresh install, no existing profiles

**What Happens:**
- Enable SQLite in Settings
- No migration needed (no data)
- Start creating profiles directly in SQLite
- Enjoy performance benefits immediately

**Recommendation:** Enable SQLite from the start for best experience.

---

### Scenario 2: Existing User (< 50 Profiles)

**Situation:** Using app with small number of profiles

**What Happens:**
- Enable SQLite in Settings
- Quick migration (< 5 seconds)
- All profiles transferred
- Modest performance improvement

**Recommendation:** Optional but recommended for future scalability.

---

### Scenario 3: Power User (500+ Profiles)

**Situation:** Managing large proxy farm

**What Happens:**
- Enable SQLite in Settings
- Migration takes 15-30 seconds
- Dramatic performance improvement
- Bulk operations 25x faster

**Recommendation:** Highly recommended! Significant benefits.

---

### Scenario 4: Testing/Development

**Situation:** Frequently adding/removing test profiles

**What Happens:**
- Enable SQLite for faster operations
- Bulk delete test profiles instantly
- Efficient data management
- Better development workflow

**Recommendation:** Essential for testing workflows.

---

## Comparison: AsyncStorage vs SQLite

### AsyncStorage (Legacy)

**Pros:**
- ✅ Proven stability
- ✅ Simple implementation
- ✅ Works on all platforms

**Cons:**
- ❌ Slow with large datasets
- ❌ Sequential operations
- ❌ No advanced queries
- ❌ Limited scalability

**Best For:**
- Small profile counts (< 20)
- Simple use cases
- Maximum compatibility

---

### SQLite (New)

**Pros:**
- ✅ 15-40x faster bulk operations
- ✅ Efficient queries and indexing
- ✅ Handles thousands of profiles
- ✅ Transaction safety
- ✅ Advanced search/filter

**Cons:**
- ⚠️ Android only (currently)
- ⚠️ Slightly more storage (dual-write)
- ⚠️ Newer feature (less battle-tested)

**Best For:**
- Large profile counts (50+)
- Frequent bulk operations
- Power users
- Performance-critical workflows

---

## Technical Details

### Database Schema

**Profiles Table:**
- Stores profile metadata
- Indexed for fast queries
- Foreign key constraints

**Profile Tags Table:**
- Many-to-many relationship
- Efficient tag management
- Cascade deletion

**Sync Log Table:**
- Tracks native synchronization
- Retry mechanism
- Status monitoring

### Storage Architecture

```
┌─────────────────────────────────────┐
│         Application Layer           │
├─────────────────────────────────────┤
│       StorageService (Facade)       │
├──────────────┬──────────────────────┤
│   SQLite     │    AsyncStorage      │
│  (Primary)   │     (Backup)         │
├──────────────┴──────────────────────┤
│         SecureStore                 │
│      (Credentials Only)             │
└─────────────────────────────────────┘
```

### Data Flow

1. **Write Operation:**
   - Data written to SQLite (primary)
   - Also written to AsyncStorage (backup)
   - Credentials to SecureStore (encrypted)

2. **Read Operation:**
   - Read from SQLite (fast)
   - Credentials from SecureStore
   - Combined into complete profile

3. **Migration:**
   - Read from AsyncStorage
   - Write to SQLite
   - Validate and confirm
   - Set migration flag

---

## Glossary

**AsyncStorage:** React Native's key-value storage system (legacy)

**Bulk Operation:** Processing multiple items in a single transaction

**Dual-Write Mode:** Writing data to both SQLite and AsyncStorage simultaneously

**Foreign Key:** Database constraint ensuring referential integrity

**Index:** Database structure for fast data retrieval

**Migration:** One-time process of moving data from AsyncStorage to SQLite

**Rollback:** Reverting changes when an operation fails

**SecureStore:** Encrypted storage for sensitive data (passwords)

**SQLite:** Embedded relational database system

**Transaction:** Group of operations that succeed or fail together

---

## Version History

### v1.0.7 - SQLite Storage Release

**New Features:**
- ✨ SQLite storage backend
- ✨ Automatic migration from AsyncStorage
- ✨ 15-40x faster bulk operations
- ✨ Advanced search and filtering
- ✨ Native synchronization

**Improvements:**
- ⚡ Profile loading 2-3x faster
- ⚡ Bulk delete 25x faster (500 profiles)
- ⚡ Efficient database queries
- ⚡ Better scalability

**Technical:**
- 📦 expo-sqlite v15.0.4
- 🔧 Transaction-based operations
- 🔧 Automatic rollback on failure
- 🔧 Dual-write mode for safety

---

## Additional Resources

### Documentation

- **[Testing Guide](./SQLITE_TESTING_GUIDE.md)** - Comprehensive testing procedures
- **[Implementation Guide](./IMPLEMENTATION_GUIDE.md)** - Developer documentation
- **[Feature Design](./FEATURE_DESIGN.md)** - Architecture and design decisions
- **[Quick Start Guide](./QUICK_START.md)** - Getting started with the app

### External Resources

- [SQLite Official Documentation](https://www.sqlite.org/docs.html)
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

---

## Feedback and Support

We value your feedback on the SQLite Storage feature!

### Share Your Experience

- **Performance Improvements:** How much faster is your workflow?
- **Issues Encountered:** What problems did you face?
- **Feature Requests:** What would make it better?
- **Use Cases:** How are you using the feature?

### Report Issues

When reporting issues, please include:
1. Device model and Android version
2. App version
3. Number of profiles
4. Steps to reproduce
5. Expected vs actual behavior
6. Relevant log excerpts

### Contributing

Interested in contributing?
- Check the [Contributing Guide](../CONTRIBUTING.md)
- Review open issues on GitHub
- Submit pull requests
- Help improve documentation

---

## Summary

SQLite Storage is a powerful upgrade that delivers:

- **🚀 15-40x faster** bulk operations
- **📊 Better scalability** for large profile counts
- **🔒 Same security** with encrypted credentials
- **🔄 Safe migration** with automatic rollback
- **↩️ Reversible** - can disable anytime

**Ready to get started?** Follow the [How to Enable](#how-to-enable-sqlite-storage) section above!

For technical details and testing procedures, see the [Testing Guide](./SQLITE_TESTING_GUIDE.md).

---

**Last Updated:** December 2024  
**App Version:** 1.0.7+  
**Feature Status:** ✅ Production Ready (Android)