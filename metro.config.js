/* eslint-disable no-undef */
const { getDefaultConfig } = require('expo/metro-config');
try {
  require('./dev-proxy').startProxy();
} catch (e) {
  console.warn('[Metro] Could not auto-start dev-proxy:', e);
}
const config = getDefaultConfig(__dirname);
module.exports = config;
