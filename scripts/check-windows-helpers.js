'use strict';

const assert = require('assert');
const path = require('path');
const {
  parsePrinterList,
  sumatraSettingsFromLpOptions,
} = require('../src/services/windowsPrintService');
const platform = require('../src/platform');
const { roleLpOptionsForJob } = require('../src/services/printerService');
const { normalizeOrigin } = require('../src/config');

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

function pdfBase64WithMediaBox(widthPt, heightPt) {
  return Buffer.from(
    `%PDF-1.4\n3 0 obj<< /Type /Page /MediaBox [0 0 ${widthPt} ${heightPt}] >>endobj\n%%EOF\n`,
    'latin1'
  ).toString('base64');
}

function testRoleMediaFromPdfSize() {
  const letter = pdfBase64WithMediaBox(612, 792);
  const roll80 = pdfBase64WithMediaBox(226.77, 425.19);

  assert.deepStrictEqual(roleLpOptionsForJob('factura', 'pdf', letter), [
    'media=Letter',
    'fit-to-page',
  ]);
  assert.deepStrictEqual(roleLpOptionsForJob('factura', 'pdf', roll80), [
    'fit-to-page',
    'media=Custom.80x150mm',
  ]);
  assert.deepStrictEqual(roleLpOptionsForJob('caja', 'pdf', roll80), [
    'fit-to-page',
    'media=Custom.80x150mm',
  ]);
  assert.deepStrictEqual(roleLpOptionsForJob('ticket', 'pdf', roll80), [
    'fit-to-page',
    'media=Custom.80x150mm',
  ]);
  assert.deepStrictEqual(roleLpOptionsForJob('estudio', 'pdf', roll80), [
    'media=Letter',
    'fit-to-page',
  ]);
  assert.deepStrictEqual(roleLpOptionsForJob('label', 'pdf', roll80), [
    'media=Custom.2x1in',
    'fit-to-page',
  ]);
  assert.deepStrictEqual(roleLpOptionsForJob('factura', 'pdf', 'bm90LWEtcGRm'), [
    'media=Letter',
    'fit-to-page',
  ]);
}

function testNormalizeOrigin() {
  assert.strictEqual(normalizeOrigin('https://pos.giganet-srl.com/'), 'https://pos.giganet-srl.com');
  assert.strictEqual(
    normalizeOrigin(' https://pos.giganet-srl.com/dashboard/facturas '),
    'https://pos.giganet-srl.com'
  );
  assert.strictEqual(normalizeOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(normalizeOrigin(''), '');
}

testParsePrinterList();
testNormalizeOrigin();
testSumatraSettings();
testPlatformOnThisHost();
testRoleMediaFromPdfSize();
console.log('check-windows-helpers: ok');
