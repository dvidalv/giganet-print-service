'use strict';

const express = require('express');
const { SERVICE_NAME, SERVICE_VERSION } = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
  });
});

module.exports = router;
