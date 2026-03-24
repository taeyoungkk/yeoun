const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-css-interop',
  'dist',
  'runtime',
  'components.js',
);

const targetLine =
  '(0, api_1.cssInterop)(react_native_1.SafeAreaView, { className: "style" });';

try {
  if (!fs.existsSync(targetPath)) {
    console.log('[postinstall] SafeArea patch skipped: target file not found.');
    process.exit(0);
  }

  const original = fs.readFileSync(targetPath, 'utf8');
  if (!original.includes(targetLine)) {
    console.log('[postinstall] SafeArea patch already applied.');
    process.exit(0);
  }

  const patched = original.replace(`${targetLine}\n`, '');
  fs.writeFileSync(targetPath, patched, 'utf8');
  console.log('[postinstall] Removed deprecated SafeAreaView interop registration.');
} catch (error) {
  console.warn('[postinstall] SafeArea patch failed:', error.message);
  process.exit(0);
}
