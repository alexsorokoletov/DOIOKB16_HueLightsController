const { ViaProtocol } = require('./via-protocol');

// QMK RGB Matrix keycodes (from quantum_keycodes.h)
const QK_RGB = {
  TOGGLE: 0x5CC2,
  MODE_NEXT: 0x5CC3,
  MODE_PREV: 0x5CC4,
  HUE_UP: 0x5CC5,
  HUE_DOWN: 0x5CC6,
  SAT_UP: 0x5CC7,
  SAT_DOWN: 0x5CC8,
  VAL_UP: 0x5CC9,
  VAL_DOWN: 0x5CCA,
};

// "Safe" keycodes that won't affect system
const KC = {
  F13: 0x0068,
  F14: 0x0069,
  F15: 0x006A,
  F16: 0x006B,
  F17: 0x006C,
  F18: 0x006D,
  NO: 0x0000,
};

console.log('=== Test Encoder Set ===\n');

const via = new ViaProtocol();
via.open();

// First, get current mappings
console.log('Current encoder 0 mappings:');
const orig_ccw = via.getEncoderMapping(0, 0, false);
const orig_cw = via.getEncoderMapping(0, 0, true);
console.log(`  CCW: 0x${orig_ccw?.toString(16) || 'null'}`);
console.log(`  CW: 0x${orig_cw?.toString(16) || 'null'}`);

// Try setting encoder 0 to RGB HUE control
console.log('\nSetting encoder 0 to RGB HUE UP/DOWN...');
const set1 = via.setEncoderMapping(0, 0, false, QK_RGB.HUE_DOWN);
const set2 = via.setEncoderMapping(0, 0, true, QK_RGB.HUE_UP);
console.log(`Set CCW to HUE_DOWN: ${set1}`);
console.log(`Set CW to HUE_UP: ${set2}`);

// Read back
console.log('\nReading back encoder 0:');
const new_ccw = via.getEncoderMapping(0, 0, false);
const new_cw = via.getEncoderMapping(0, 0, true);
console.log(`  CCW: 0x${new_ccw?.toString(16) || 'null'}`);
console.log(`  CW: 0x${new_cw?.toString(16) || 'null'}`);

console.log('\n>>> TRY ROTATING THE FIRST SMALL KNOB - does RGB hue change? <<<');
console.log('(waiting 10 seconds...)');

setTimeout(() => {
  // Restore original
  console.log('\nRestoring original mapping...');
  via.setEncoderMapping(0, 0, false, orig_ccw || 0);
  via.setEncoderMapping(0, 0, true, orig_cw || 0);

  via.close();
  console.log('Done.');
}, 10000);
