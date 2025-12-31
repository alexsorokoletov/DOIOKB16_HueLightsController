const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Vial Protocol Test ===\n');
const hid = new HID.HID(viaDevice.path);

function send(data) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  for (let i = 0; i < data.length; i++) buffer[i + 1] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

function hex(arr, len = 20) {
  if (!arr) return 'null';
  return [...arr].slice(0, len).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// Vial commands (prefix 0xFE)
const VIAL = {
  GET_KEYBOARD_ID: [0xFE, 0x00],
  GET_SIZE: [0xFE, 0x01],
  GET_DEF: [0xFE, 0x02],
  GET_ENCODER: [0xFE, 0x03],  // + layer, encoder, direction
  SET_ENCODER: [0xFE, 0x04],  // + layer, encoder, direction, keycode_hi, keycode_lo
  GET_UNLOCK_STATUS: [0xFE, 0x05],
};

console.log('--- Vial Detection ---');
let resp = send(VIAL.GET_KEYBOARD_ID);
console.log('Keyboard ID:', hex(resp));

resp = send(VIAL.GET_SIZE);
console.log('Size:', hex(resp));

resp = send(VIAL.GET_UNLOCK_STATUS);
console.log('Unlock status:', hex(resp));

// Get encoder mappings using Vial protocol
console.log('\n--- Encoder Mappings (Vial 0xFE 0x03) ---');
for (let enc = 0; enc < 3; enc++) {
  const ccw = send([0xFE, 0x03, 0, enc, 0]); // layer 0, encoder, CCW
  const cw = send([0xFE, 0x03, 0, enc, 1]);  // layer 0, encoder, CW

  // Parse keycode from response
  let ccwCode = null, cwCode = null;
  if (ccw && ccw[0] !== 0xff) {
    ccwCode = (ccw[4] << 8) | ccw[5];
  }
  if (cw && cw[0] !== 0xff) {
    cwCode = (cw[4] << 8) | cw[5];
  }

  console.log(`Encoder ${enc}:`);
  console.log(`  CCW: 0x${ccwCode?.toString(16) || 'null'} - raw: ${hex(ccw, 10)}`);
  console.log(`  CW:  0x${cwCode?.toString(16) || 'null'} - raw: ${hex(cw, 10)}`);
}

// Try to set encoder 0 to F13/F14 (safe keys)
console.log('\n--- Test Setting Encoder 0 to F13/F14 ---');
const F13 = 0x0068;
const F14 = 0x0069;

console.log('Setting encoder 0 CCW to F13 (0x0068)...');
resp = send([0xFE, 0x04, 0, 0, 0, (F13 >> 8) & 0xff, F13 & 0xff]);
console.log('Response:', hex(resp, 10));

console.log('Setting encoder 0 CW to F14 (0x0069)...');
resp = send([0xFE, 0x04, 0, 0, 1, (F14 >> 8) & 0xff, F14 & 0xff]);
console.log('Response:', hex(resp, 10));

// Read back
console.log('\nReading back encoder 0:');
const newCcw = send([0xFE, 0x03, 0, 0, 0]);
const newCw = send([0xFE, 0x03, 0, 0, 1]);
console.log('CCW:', hex(newCcw, 10));
console.log('CW:', hex(newCw, 10));

hid.close();
console.log('\nDone. Try rotating encoder 0 to see if it sends F13/F14!');
