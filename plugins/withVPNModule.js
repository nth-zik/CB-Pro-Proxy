const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  IOSConfig
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to integrate VPN native module
 */
const withVPNModule = (config) => {
  // Android configuration
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const javaDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'cbv',
        'vpn'
      );

      const mainApplicationPath = path.join(javaDir, 'MainApplication.kt');

      // Check if MainApplication.kt exists
      if (fs.existsSync(mainApplicationPath)) {
        let content = fs.readFileSync(mainApplicationPath, 'utf-8');

        // Add VPNPackage to packages list if not present
        if (!content.includes('VPNPackage()')) {
          content = content.replace(
            /(PackageList\(this\)\.packages\.apply \{[\s\S]*?\/\/ add\(MyReactNativePackage\(\)\))/,
            '$1\n              add(VPNPackage())'
          );
        }

        fs.writeFileSync(mainApplicationPath, content);
        console.log('✅ Added VPNPackage to MainApplication.kt');
      }

      return config;
    },
  ]);

  // iOS configuration
  // Add entitlements
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.networking.networkextension'] = [
      'packet-tunnel-provider'
    ];
    config.modResults['com.apple.security.application-groups'] = [
      'group.com.cbv.vpn'
    ];
    console.log('✅ Added iOS VPN entitlements');
    return config;
  });

  // Update Info.plist for background modes if needed
  config = withInfoPlist(config, (config) => {
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    if (!config.modResults.UIBackgroundModes.includes('network-authentication')) {
      config.modResults.UIBackgroundModes.push('network-authentication');
    }
    console.log('✅ Added iOS background modes');
    return config;
  });

  // Copy iOS source files to project
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName || 'CBVVPN';
      const projectDir = path.join(iosProjectRoot, projectName);

      // Ensure project directory exists
      if (!fs.existsSync(projectDir)) {
        console.warn('⚠️ iOS project directory not found, skipping file copy');
        return config;
      }

      // Copy VPN module files
      const sourceFiles = [
        'VPNModule.swift',
        'VPNModule.m',
        'VPNManager.swift',
        'VPNProfile.swift',
        'ProfileStorage.swift',
        'SOCKS5ProxyHandler.swift',
        'HTTPProxyHandler.swift'
      ];

      sourceFiles.forEach(file => {
        const sourcePath = path.join(iosProjectRoot, projectName, file);
        if (fs.existsSync(sourcePath)) {
          console.log(`✅ iOS file already exists: ${file}`);
        } else {
          console.log(`⚠️ iOS file missing: ${file} (will be added during prebuild)`);
        }
      });

      // Update bridging header
      const bridgingHeaderPath = path.join(projectDir, `${projectName}-Bridging-Header.h`);
      if (fs.existsSync(bridgingHeaderPath)) {
        let content = fs.readFileSync(bridgingHeaderPath, 'utf-8');

        const imports = [
          '#import <React/RCTBridgeModule.h>',
          '#import <React/RCTEventEmitter.h>'
        ];

        let modified = false;
        imports.forEach(importStatement => {
          if (!content.includes(importStatement)) {
            content += `\n${importStatement}`;
            modified = true;
          }
        });

        if (modified) {
          fs.writeFileSync(bridgingHeaderPath, content);
          console.log('✅ Updated iOS bridging header');
        }
      }

      console.log('\n📝 Note: iOS Network Extension target must be configured manually in Xcode');
      console.log('   See: ios/XCODE_SETUP_REQUIRED.md for instructions\n');

      return config;
    },
  ]);

  return config;
};

module.exports = withVPNModule;
