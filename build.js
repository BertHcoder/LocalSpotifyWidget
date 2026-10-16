import { build } from 'esbuild';
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'fs';

// Clean dist (tolerate locked files — just overwrite)
try { rmSync('dist', { recursive: true, force: true }); } catch { /* may be locked */ }
mkdirSync('dist', { recursive: true });

// Bundle server.js into a single CJS file (pkg needs CJS)
await build({
  entryPoints: ['server.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/server.cjs',
  banner: {
    js: [
      '// When running as a packaged exe, serve files from the exe directory',
      'if(typeof process.pkg!=="undefined"){process.chdir(require("path").dirname(process.execPath))}',
    ].join('\n'),
  },
});

console.log('Bundled server.js → dist/server.cjs');

// Create the exe with pkg
execSync(
  'npx @yao-pkg/pkg dist/server.cjs --targets node20-win-x64 --output dist/SpotifyWidget.exe --compress GZip',
  { stdio: 'inherit' },
);

// Copy static files alongside the exe
const staticFiles = ['overlay.html', 'settings.html', 'style.css', 'widget.js', 'colors.js'];
for (const file of staticFiles) {
  cpSync(file, `dist/${file}`);
}

// Short getting-started note for people who just unzipped the release
const readme = `Spotify Widget - "Now Playing" overlay for OBS Studio
=====================================================

1. Put this folder somewhere permanent, e.g. Documents\\SpotifyWidget.
   Your settings and Spotify login are saved in this folder,
   so don't run the widget from inside the zip file.

2. Double-click SpotifyWidget.exe.
   Windows may say "Windows protected your PC" because the app isn't
   code-signed. Click "More info" and then "Run anyway".

3. The settings page opens in your browser. Follow the steps there to
   connect Spotify and add the widget to OBS.

The widget keeps running in the system tray (green dot near the clock).
Double-click the dot to open the settings; right-click it to quit or to
start the widget together with Windows.

Help and troubleshooting:
https://github.com/BertHcoder/LocalSpotifyWidget#troubleshooting
`;
writeFileSync('dist/README.txt', readme.replace(/\n/g, '\r\n'));

console.log('\nBuild complete! dist/ contents:');
console.log('  SpotifyWidget.exe');
console.log('  README.txt');
staticFiles.forEach(f => console.log(`  ${f}`));
