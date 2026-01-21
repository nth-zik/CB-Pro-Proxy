const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to integrate VPN native module
 */
const withVPNModule = (config) => {
  return withDangerousMod(config, [
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

        // Add import statement for VPNPackage if not present
        if (!content.includes('import com.cbv.vpn.VPNPackage')) {
          // Find the last import statement and add our import after it
          const lastImportMatch = content.match(/import .*\n(?!import)/);
          if (lastImportMatch) {
            const lastImportIndex = content.indexOf(lastImportMatch[0]) + lastImportMatch[0].length;
            content = content.slice(0, lastImportIndex) + 
                      '\n// Import VPN package\nimport com.cbv.vpn.VPNPackage\n' +
                      content.slice(lastImportIndex);
          }
        }

        // Add VPNPackage to packages list if not present
        if (!content.includes('VPNPackage()')) {
          content = content.replace(
            /(PackageList\(this\)\.packages\.apply \{[\s\S]*?\/\/ add\(MyReactNativePackage\(\)\))/,
            '$1\n              add(VPNPackage())'
          );
        }

        fs.writeFileSync(mainApplicationPath, content);
        console.log('✅ Added VPNPackage import and registration to MainApplication.kt');
      }

      // Copy native files from template
      const templateDir = path.join(__dirname, '..', 'native-templates', 'android');
      
      if (fs.existsSync(templateDir)) {
        const files = ['VPNModule.kt', 'VPNPackage.kt', 'CBVVpnService.kt'];
        
        files.forEach(file => {
          const src = path.join(templateDir, file);
          const dest = path.join(javaDir, file);
          
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`✅ Copied ${file}`);
          }
        });
      }

      return config;
    },
  ]);
};

module.exports = withVPNModule;
