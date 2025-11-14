const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAdaptiveIconInset = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );

      const drawableDir = path.join(resDir, 'drawable');
      const insetXmlPath = path.join(drawableDir, 'ic_launcher_foreground.xml');
      if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
      const insetXml = `<?xml version="1.0" encoding="utf-8"?>\n<inset xmlns:android="http://schemas.android.com/apk/res/android"\n    android:drawable="@mipmap/ic_launcher_foreground"\n    android:insetLeft="24dp"\n    android:insetRight="24dp"\n    android:insetTop="24dp"\n    android:insetBottom="24dp" />\n`;
      fs.writeFileSync(insetXmlPath, insetXml);

      const mipmapDir = path.join(resDir, 'mipmap-anydpi-v26');
      const files = ['ic_launcher.xml', 'ic_launcher_round.xml'];
      files.forEach((f) => {
        const p = path.join(mipmapDir, f);
        if (fs.existsSync(p)) {
          let content = fs.readFileSync(p, 'utf-8');
          content = content.replace('@mipmap/ic_launcher_foreground', '@drawable/ic_launcher_foreground');
          fs.writeFileSync(p, content);
        }
      });

      return config;
    },
  ]);
};

module.exports = withAdaptiveIconInset;