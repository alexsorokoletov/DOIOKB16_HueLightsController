#!/usr/bin/env node

// Test script to verify VIA protocol communication with DOIO keyboard

const HID = require('node-hid');
const { ViaProtocol, VENDOR_ID, PRODUCT_ID } = require('./via-protocol');

console.log('=== VIA Protocol Test ===\n');

// List all HID devices for DOIO
console.log('--- HID Devices ---');
const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
console.log(`Found ${devices.length} interfaces for DOIO keyboard:\n`);

devices.forEach((d, i) => {
  console.log(`Interface ${i}:`);
  console.log(`  Path: ${d.path}`);
  console.log(`  Interface: ${d.interface}`);
  console.log(`  Usage Page: 0x${d.usagePage?.toString(16) || 'N/A'}`);
  console.log(`  Usage: 0x${d.usage?.toString(16) || 'N/A'}`);
  console.log('');
});

// Test VIA protocol
console.log('--- VIA Protocol Test ---');
try {
  const via = new ViaProtocol();
  via.open();

  const version = via.getProtocolVersion();
  console.log(`VIA Protocol Version: ${version}`);

  console.log('\n--- Encoder Mappings (Layer 0) ---');
  for (let enc = 0; enc < 3; enc++) {
    const ccw = via.getEncoderMapping(0, enc, false);
    const cw = via.getEncoderMapping(0, enc, true);
    console.log(`Encoder ${enc}:`);
    console.log(`  CCW: 0x${ccw?.toString(16) || 'null'}`);
    console.log(`  CW:  0x${cw?.toString(16) || 'null'}`);
  }

  via.close();
  console.log('\nVIA test: SUCCESS');
} catch (e) {
  console.error(`VIA test: FAILED - ${e.message}`);
  console.error(e.stack);
}

// Test raw HID reading
console.log('\n--- Raw HID Test ---');
console.log('Attempting to read from keyboard interface...');
console.log('(Rotate a knob to see data, Ctrl+C to exit)\n');

try {
  const kbDevice = devices.find(d => d.interface === 0 || d.usagePage === 0x01);
  if (kbDevice) {
    const hid = new HID.HID(kbDevice.path);

    hid.on('data', (data) => {
      const hex = [...data].map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`Data: ${hex}`);
    });

    hid.on('error', (err) => {
      console.error('HID error:', err.message);
    });

    // Listen for 10 seconds
    setTimeout(() => {
      console.log('\nTest complete. Closing HID device.');
      hid.close();
      process.exit(0);
    }, 10000);
  } else {
    console.log('No keyboard interface found.');
  }
} catch (e) {
  console.error(`HID read test: ${e.message}`);
}
