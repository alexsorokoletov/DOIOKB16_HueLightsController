const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Test CORRECT Encoder Commands ===\n');
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

// CORRECT command IDs from VIA app source!
const CMD = {
  GET_ENCODER: 0x14,  // Was using 0x13 - WRONG!
  SET_ENCODER: 0x15,  // Was using 0x14 - WRONG!
};

console.log('Using CORRECT command IDs:');
console.log('  GET_ENCODER = 0x14');
console.log('  SET_ENCODER = 0x15\n');

// Test GET_ENCODER with correct command
console.log('--- GET_ENCODER (0x14) ---');
for (let enc = 0; enc < 3; enc++) {
  // Format: [layer, id, isClockwise]
  const ccw = send(CMD.GET_ENCODER, [0, enc, 0]); // layer 0, encoder, CCW
  const cw = send(CMD.GET_ENCODER, [0, enc, 1]);  // layer 0, encoder, CW

  console.log(`Encoder ${enc}:`);
  console.log(`  CCW: ${hex(ccw)}`);
  console.log(`  CW:  ${hex(cw)}`);

  // Parse keycode from response bytes 4-5
  if (ccw && ccw[0] === CMD.GET_ENCODER) {
    const kcCCW = (ccw[4] << 8) | ccw[5];
    const kcCW = (cw[4] << 8) | cw[5];
    console.log(`  Parsed: CCW=0x${kcCCW.toString(16).padStart(4,'0')}, CW=0x${kcCW.toString(16).padStart(4,'0')}`);
  }
}

// Test SET_ENCODER
console.log('\n--- SET_ENCODER (0x15) Test ---');
console.log('Setting encoder 0 to F13/F14 (safe keys)...');

const F13 = 0x0068;
const F14 = 0x0069;

// Format: [layer, id, isClockwise, keycode_hi, keycode_lo]
const setCCW = send(CMD.SET_ENCODER, [0, 0, 0, (F13 >> 8) & 0xff, F13 & 0xff]);
const setCW = send(CMD.SET_ENCODER, [0, 0, 1, (F14 >> 8) & 0xff, F14 & 0xff]);

console.log(`SET CCW response: ${hex(setCCW)}`);
console.log(`SET CW response: ${hex(setCW)}`);

// Read back
console.log('\nReading back encoder 0:');
const newCCW = send(CMD.GET_ENCODER, [0, 0, 0]);
const newCW = send(CMD.GET_ENCODER, [0, 0, 1]);
console.log(`CCW: ${hex(newCCW)}`);
console.log(`CW:  ${hex(newCW)}`);

if (newCCW && newCCW[0] === CMD.GET_ENCODER) {
  const kcCCW = (newCCW[4] << 8) | newCCW[5];
  const kcCW = (newCW[4] << 8) | newCW[5];
  console.log(`Parsed: CCW=0x${kcCCW.toString(16).padStart(4,'0')}, CW=0x${kcCW.toString(16).padStart(4,'0')}`);

  if (kcCCW === F13 && kcCW === F14) {
    console.log('\n*** SUCCESS! Encoder commands work! ***');
  }
}

hid.close();
console.log('\nDone.');
