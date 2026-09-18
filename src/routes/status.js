'use strict';

const express = require('express');
const { SERVICE_NAME, SERVICE_VERSION, getConfig } = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  const paused = getConfig().paused === true;
  res.json({
    status: paused ? 'paused' : 'online',
    paused,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
  });
});

module.exports = router;
