const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Test CORRECT Lighting Commands ===\n');
const hid = new HID.HID(viaDevice.path);

function send(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) buffer[i + 2] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

function hex(arr, len = 15) {
  if (!arr) return 'null';
  return [...arr].slice(0, len).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// CORRECT command IDs from VIA app
const CMD = {
  SET_VALUE: 0x07,
  GET_VALUE: 0x08,
  SAVE: 0x09,
};

const VALUE_ID = {
  BRIGHTNESS: 0x09,
  EFFECT: 0x0a,
  COLOR_1: 0x0c,
  COLOR_2: 0x0d,
};

console.log('--- GET Current Lighting State ---');

// Get brightness
let resp = send(CMD.GET_VALUE, [VALUE_ID.BRIGHTNESS]);
console.log(`Brightness (0x09): ${hex(resp)}`);

// Get effect
resp = send(CMD.GET_VALUE, [VALUE_ID.EFFECT]);
console.log(`Effect (0x0a): ${hex(resp)}`);

// Get color 1
resp = send(CMD.GET_VALUE, [VALUE_ID.COLOR_1]);
console.log(`Color 1 (0x0c): ${hex(resp)}`);

// Get color 2
resp = send(CMD.GET_VALUE, [VALUE_ID.COLOR_2]);
console.log(`Color 2 (0x0d): ${hex(resp)}`);

// Try setting color to purple (hue ~213 on 0-255 scale)
console.log('\n--- SET Lighting Test ---');
console.log('Setting effect to 0 (solid)...');
resp = send(CMD.SET_VALUE, [VALUE_ID.EFFECT, 0]);
console.log(`Response: ${hex(resp)}`);

console.log('Setting color to purple (hue=180, sat=255)...');
resp = send(CMD.SET_VALUE, [VALUE_ID.COLOR_1, 180, 255]);
console.log(`Response: ${hex(resp)}`);

console.log('Setting brightness to 200...');
resp = send(CMD.SET_VALUE, [VALUE_ID.BRIGHTNESS, 200]);
console.log(`Response: ${hex(resp)}`);

console.log('\n>>> Check if keyboard RGB changed! <<<');
console.log('Waiting 5 seconds before restoring...\n');

setTimeout(() => {
  // Try reading back
  console.log('Reading back values:');
  resp = send(CMD.GET_VALUE, [VALUE_ID.EFFECT]);
  console.log(`Effect: ${hex(resp)}`);
  resp = send(CMD.GET_VALUE, [VALUE_ID.COLOR_1]);
  console.log(`Color: ${hex(resp)}`);
  resp = send(CMD.GET_VALUE, [VALUE_ID.BRIGHTNESS]);
  console.log(`Brightness: ${hex(resp)}`);

  hid.close();
  console.log('\nDone.');
}, 5000);
