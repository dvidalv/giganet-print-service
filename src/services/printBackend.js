'use strict';

const { isWindows } = require('../platform');

const backend = isWindows()
  ? require('./windowsPrintService')
  : require('./cupsService');

module.exports = backend;
