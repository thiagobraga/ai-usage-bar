import assert from 'node:assert/strict';
import {readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

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

test('panel agent groups have 16px spacing without changing meter spacing', () => {
  const stylesheet = read('extension/stylesheet.css');
  assert.match(stylesheet, /\.ai-panel-box\s*\{[^}]*spacing:\s*16px;/);
  assert.match(stylesheet, /\.ai-provider-meters\s*\{[^}]*spacing:\s*6px;/);
});

test('schema contains appearance and refresh settings', () => {
  const schema = read('extension/schemas/org.gnome.shell.extensions.ai-usage-bar.gschema.xml');
  for (const key of ['refresh-interval-seconds', 'enabled-providers'])
    assert.match(schema, new RegExp(`name="${key}"`));
  for (const key of ['popup-opacity', 'merge-icons', 'compact-mode', 'openrouter-api-key'])
    assert.doesNotMatch(schema, new RegExp(`name="${key}"`));
  assert.match(schema, /<key name="white-icons" type="b">\s*<default>false<\/default>/);
  assert.match(schema, /<key name="meter-orientation" type="s">\s*<choices><choice value="horizontal"\/><choice value="vertical"\/><\/choices>\s*<default>'horizontal'<\/default>/);
  assert.match(schema, /<key name="panel-components" type="as">/);
  assert.match(schema, /<key name="panel-orientations" type="as">/);
});

test('native dashboard modules ship with the extension', () => {
  for (const module of ['panelMenu', 'dashboardWidgets', 'usageSummaryWidgets'])
    assert.ok(exists(`extension/ui/${module}.js`));
});

test('white icon variants keep the Claude and Antigravity outlines', () => {
  for (const name of ['claude', 'antigravity']) {
    const colored = read(`extension/icons/${name}.svg`);
    const white = read(`extension/icons/${name}-white.svg`);
    assert.equal(white.match(/viewBox="([^"]+)"/)[1], colored.match(/viewBox="([^"]+)"/)[1]);
    assert.equal(white.match(/<path[^>]* d="([^"]+)"/)[1], colored.match(/<path[^>]* d="([^"]+)"/)[1]);
    assert.match(white, /<path fill="#f6f5f1"/);
  }
});

test('OpenCode meters use the official compact logo instead of text or the Codex mark', () => {
  const logo = read('extension/icons/opencode.svg');
  assert.match(logo, /viewBox=['"]0 0 300 300['"]/);
  assert.match(logo, /transform="translate\(30 0\)"/);
  assert.match(logo, /M180 240H60V120H180V240Z/);
  assert.match(logo, /#F1ECEC/);
  assert.match(logo, /#4B4646/);

  const widgets = read('extension/ui/meterWidgets.js');
  assert.doesNotMatch(widgets, /opencode-openai/);
  assert.doesNotMatch(widgets, /text: 'OC'/);
  assert.match(widgets, /iconName}\.svg`\),[\s\S]*?if \(result\.id === 'opencode' && display\.activity\)/);
});

test('install script uses UUID and compiles schemas', () => {
  const common = read('scripts/src/common.sh');
  const install = read('scripts/install.sh');
  assert.match(common, /UUID="ai-usage-bar@local"/);
  assert.match(install, /glib-compile-schemas/);
  assert.match(install, /gnome-extensions enable/);
});

test('install and package archives exclude colocated tests and fixtures', () => {
  const root = mkdtempSync('/tmp/opencode/extension-archive-test-');
  try {
    const source = join(root, 'extension');
    mkdirSync(join(source, 'providers', 'fixtures'), {recursive: true});
    writeFileSync(join(source, 'extension.js'), 'export default class Extension {}');
    writeFileSync(join(source, 'metadata.test.js'), 'import {test} from "node:test";');
    writeFileSync(join(source, 'providers', 'fixtures', 'sample.json'), '{}');
    const install = read('scripts/install.sh');
    assert.match(install, /zip_extension "\$ZIP_FILE"/);
    assert.match(install, /rsync -a --delete --exclude '\*\.test\.js' --exclude 'providers\/fixtures\/'/);
    const run = spawnSync('bash', ['-c', 'glib-compile-schemas() { :; }; source "$1"; do_package',
      'bash', new URL('../scripts/src/package.sh', import.meta.url).pathname],
    {env: {...process.env, ROOT_DIR: root, SRC_DIR: source, UUID: 'sample'}, encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr);
    const listing = spawnSync('unzip', ['-Z1', join(root, 'sample.zip')], {encoding: 'utf8'});
    assert.equal(listing.status, 0, listing.stderr);
    assert.match(listing.stdout, /extension\.js/);
    assert.doesNotMatch(listing.stdout, /\.test\.js|fixtures/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

test('indicator aligns popup menu with panel icons', () => {
  const extension = read('extension/extension.js');
  assert.match(extension, /menu\.setSourceAlignment/);
});

test('README documents one-command install and tests', () => {
  const readme = read('README.md');
  assert.match(readme, /\.\/scripts\/install\.sh/);
  assert.match(readme, /npm test/);
  assert.match(readme, /transparency/i);
});
