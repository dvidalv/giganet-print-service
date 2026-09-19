'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { SERVICE_NAME, SERVICE_VERSION, getConfig } = require('../config');
const { platformId, platformLabel } = require('../platform');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const ASSET_FILES = [
  'settings.html',
  'sw.js',
  'manifest.webmanifest',
  path.join('icons', 'icon-192.png'),
  path.join('icons', 'icon-512.png'),
];

function publicAssetsStamp() {
  return ASSET_FILES.map((name) => {
    try {
      return String(fs.statSync(path.join(PUBLIC_DIR, name)).mtimeMs);
    } catch {
      return '0';
    }
  }).join('.');
}

router.get('/', (req, res) => {
  const paused = getConfig().paused === true;
  res.json({
    status: paused ? 'paused' : 'online',
    paused,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    platform: process.platform,
    os: platformLabel(),
    osId: platformId(),
    assets: publicAssetsStamp(),
  });
});

module.exports = router;
