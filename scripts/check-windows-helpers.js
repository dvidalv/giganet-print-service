'use strict';

const assert = require('assert');
const path = require('path');
const {
  parsePrinterList,
  sumatraSettingsFromLpOptions,
} = require('../src/services/windowsPrintService');
const platform = require('../src/platform');

function testParsePrinterList() {
  assert.deepStrictEqual(parsePrinterList(''), []);
  assert.deepStrictEqual(parsePrinterList('not-json'), []);
  const one = parsePrinterList(
    JSON.stringify({ name: 'HP LaserJet', default: true, status: 'idle', enabled: true })
  );
  assert.strictEqual(one.length, 1);
  assert.strictEqual(one[0].name, 'HP LaserJet');
  assert.strictEqual(one[0].default, true);

  const many = parsePrinterList(
    JSON.stringify([
      { name: 'Zebra', default: false, status: 'idle', enabled: true },
      { name: 'Epson', default: true, status: 'offline', enabled: false },
    ])
  );
  assert.strictEqual(many.length, 2);
  assert.strictEqual(many[1].enabled, false);
}

function testSumatraSettings() {
  assert.strictEqual(sumatraSettingsFromLpOptions(['fit-to-page'], 1), 'fit');
  assert.strictEqual(
    sumatraSettingsFromLpOptions(['media=Letter', 'orientation-requested=4'], 2),
    '2x,paper=Letter,portrait'
  );
  assert.strictEqual(
    sumatraSettingsFromLpOptions(['media=Custom.2x1in', 'fit-to-page'], 1),
    'fit'
  );
}

function testPlatformOnThisHost() {
  assert.strictEqual(typeof platform.getSupportDir(), 'string');
  assert.strictEqual(typeof platform.getLogDir(), 'string');
  assert.ok(platform.getConfigPath().endsWith(`${path.sep}config.json`));
  if (process.platform === 'linux') {
    assert.strictEqual(platform.isWindows(), false);
    assert.ok(platform.getSupportDir().includes('Library'));
  }
}

testParsePrinterList();
testSumatraSettings();
testPlatformOnThisHost();
console.log('check-windows-helpers: ok');
