import { build } from 'esbuild';
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync } from 'fs';

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
const staticFiles = ['overlay.html', 'style.css', 'widget.js', 'colors.js'];
for (const file of staticFiles) {
  cpSync(file, `dist/${file}`);
}

console.log('\nBuild complete! dist/ contents:');
console.log('  SpotifyWidget.exe');
staticFiles.forEach(f => console.log(`  ${f}`));
