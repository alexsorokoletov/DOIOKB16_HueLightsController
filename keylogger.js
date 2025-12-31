#!/usr/bin/env node

// DOIO KB16 Keypress/Encoder Logger
// Use this to diagnose HID events from keys and encoders

const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

console.log('=== DOIO KB16 Event Logger ===\n');

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
console.log(`Found ${devices.length} HID interfaces:\n`);

devices.forEach((d, i) => {
  console.log(`[${i}] Interface ${d.interface}, UsagePage 0x${d.usagePage?.toString(16)}, Usage 0x${d.usage?.toString(16)}`);
});

// Open all readable interfaces
const openDevices = [];

// Consumer interface (0x0c) - volume, media, zoom
const consumer = devices.find(d => d.usagePage === 0x0c);
if (consumer) {
  try {
    const hid = new HID.HID(consumer.path);
    hid.on('data', (data) => {
      if (data[1] !== 0) { // Skip release events
        const hex = [...data].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[Consumer] ${hex}`);
        parseConsumer(data);
      }
    });
    hid.on('error', (e) => console.log('[Consumer] Error:', e.message));
    openDevices.push(hid);
    console.log('\n✓ Consumer interface opened (volume, media, zoom)');
  } catch (e) {
    console.log('✗ Consumer interface failed:', e.message);
  }
}

// Mouse interface (0x01, usage 0x02)
const mouse = devices.find(d => d.usagePage === 0x01 && d.usage === 0x02);
if (mouse) {
  try {
    const hid = new HID.HID(mouse.path);
    hid.on('data', (data) => {
      const hex = [...data].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`[Mouse] ${hex}`);
    });
    hid.on('error', (e) => console.log('[Mouse] Error:', e.message));
    openDevices.push(hid);
    console.log('✓ Mouse interface opened');
  } catch (e) {
    console.log('✗ Mouse interface failed:', e.message);
  }
}

// VIA interface (0xFF60) - for layer state monitoring
const via = devices.find(d => d.usagePage === 0xFF60);
if (via) {
  console.log('✓ VIA interface available (0xFF60)');
}

console.log('\n--- Press keys or rotate encoders to see events ---');
console.log('Press Ctrl+C to exit\n');

function parseConsumer(data) {
  const reportId = data[0];
  const code = data[1];
  const byte7 = data[7] || 0;

  if (reportId === 0x04) {
    // Volume/media codes
    const names = {
      0xe9: 'Volume Up',
      0xea: 'Volume Down',
      0xcd: 'Play/Pause',
      0xb5: 'Next Track',
      0xb6: 'Prev Track',
    };
    console.log(`  -> Report 0x04: ${names[code] || 'Code 0x' + code.toString(16)}`);
  } else if (reportId === 0x06) {
    // System/app control
    const dir = byte7 === 0x40 ? 'CW' : byte7 === 0x20 ? 'CCW' : '?';
    const codeNames = {
      0x0a: 'Encoder 1 (zoom/scroll)',
      0x03: 'Encoder 2 (zoom/scroll)',
    };
    console.log(`  -> Report 0x06: ${codeNames[code] || 'Code 0x' + code.toString(16)}, Direction: ${dir}`);
  }
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\nClosing...');
  openDevices.forEach(d => { try { d.close(); } catch(e) {} });
  process.exit(0);
});
