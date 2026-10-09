import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {test} from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = path => statSync(new URL(`../${path}`, import.meta.url)).isFile();

test('metadata targets GNOME Shell 46 with expected UUID', () => {
  const metadata = JSON.parse(read('extension/metadata.json'));
  assert.equal(metadata.uuid, 'ai-usage-bar@local');
  assert.equal(metadata['settings-schema'], 'org.gnome.shell.extensions.ai-usage-bar');
  assert.ok(metadata['shell-version'].includes('46'));
});

test('required extension files exist', () => {
  for (const path of [
    'extension/extension.js',
    'extension/prefs.js',
    'extension/stylesheet.css',
    'extension/schemas/org.gnome.shell.extensions.ai-usage-bar.gschema.xml',
  ]) assert.ok(exists(path), `${path} should exist`);
});

test('schema contains appearance and refresh settings', () => {
  const schema = read('extension/schemas/org.gnome.shell.extensions.ai-usage-bar.gschema.xml');
  for (const key of ['popup-opacity', 'refresh-interval-seconds', 'merge-icons', 'compact-mode', 'enabled-providers'])
    assert.match(schema, new RegExp(`name="${key}"`));
});

test('install script uses UUID and compiles schemas', () => {
  const common = read('scripts/src/common.sh');
  const install = read('scripts/install.sh');
  assert.match(common, /UUID="ai-usage-bar@local"/);
  assert.match(install, /glib-compile-schemas/);
  assert.match(install, /gnome-extensions enable/);
});

test('README documents one-command install and tests', () => {
  const readme = read('README.md');
  assert.match(readme, /\.\/scripts\/install\.sh/);
  assert.match(readme, /npm test/);
  assert.match(readme, /transparency/i);
});
