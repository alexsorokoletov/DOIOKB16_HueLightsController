const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== VIA Keymap Test ===\n');
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

// Test getting a regular key (not encoder)
// Key at layer 0, row 0, col 0
console.log('--- Regular Key Test ---');
console.log('GET_KEYCODE layer=0, row=0, col=0:');
let resp = send(0x04, [0, 0, 0]); // layer, row, col
console.log('Response:', hex(resp));

console.log('\nGET_KEYCODE layer=0, row=0, col=1:');
resp = send(0x04, [0, 0, 1]);
console.log('Response:', hex(resp));

// Try getting keys at different positions to map the matrix
console.log('\n--- Matrix Scan ---');
for (let row = 0; row < 6; row++) {
  for (let col = 0; col < 6; col++) {
    resp = send(0x04, [0, row, col]);
    if (resp && resp[0] === 0x04) {
      const keycode = (resp[4] << 8) | resp[5];
      if (keycode !== 0) {
        console.log(`[${row},${col}] = 0x${keycode.toString(16).padStart(4, '0')}`);
      }
    }
  }
}

// Try encoder positions (they might be in the matrix)
console.log('\n--- Looking for encoders in matrix ---');
// Encoders might be at special row/col positions
for (let row = 5; row < 10; row++) {
  for (let col = 0; col < 4; col++) {
    resp = send(0x04, [0, row, col]);
    if (resp && resp[0] === 0x04) {
      const keycode = (resp[4] << 8) | resp[5];
      if (keycode !== 0) {
        console.log(`[${row},${col}] = 0x${keycode.toString(16).padStart(4, '0')}`);
      }
    }
  }
}

// Check for encoder count in keyboard value
console.log('\n--- Keyboard Config ---');
resp = send(0x02, [0x05]); // encoder count
console.log('Encoder count query:', hex(resp));

hid.close();
console.log('\nDone.');
