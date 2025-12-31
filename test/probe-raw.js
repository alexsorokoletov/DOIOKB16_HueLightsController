const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('Opening VIA interface:', viaDevice.path);
const hid = new HID.HID(viaDevice.path);

function sendCommand(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00; // Report ID
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) {
    buffer[i + 2] = data[i];
  }
  console.log('TX:', [...buffer.slice(0, 10)].map(b => b.toString(16).padStart(2, '0')).join(' '));
  hid.write([...buffer]);
  const response = hid.readTimeout(1000);
  if (response) {
    console.log('RX:', [...response.slice(0, 15)].map(b => b.toString(16).padStart(2, '0')).join(' '));
  } else {
    console.log('RX: null');
  }
  return response;
}

console.log('\n--- Testing VIA Commands ---\n');

// Get protocol version
console.log('GET_PROTOCOL_VERSION (0x01):');
sendCommand(0x01);

// Get keyboard value
console.log('\nGET_KEYBOARD_VALUE (0x02):');
sendCommand(0x02, [0x01]); // uptime

// Lighting get value - try different approaches
console.log('\nLIGHTING_GET_VALUE (0x08) with id 0x40:');
sendCommand(0x08, [0x40]);

console.log('\nLIGHTING_GET_VALUE (0x08) with id 0x41:');
sendCommand(0x08, [0x41]);

// Try custom via channel for lighting (some keyboards use this)
console.log('\nCUSTOM_CHANNEL (0x20-0x2F):');
for (let i = 0x20; i <= 0x25; i++) {
  console.log(`Command 0x${i.toString(16)}:`);
  sendCommand(i, [0x00, 0x00]);
}

hid.close();
console.log('\nDone.');
