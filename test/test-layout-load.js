const HID = require('node-hid');
const fs = require('fs');

// Load user's layout
const layout = JSON.parse(fs.readFileSync('/Users/alex/Desktop/kb16_01.layout.json', 'utf-8'));

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;
const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Test Layout Buffer Write ===\n');
const hid = new HID.HID(viaDevice.path);

function send(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) buffer[i + 2] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

// VIA calculates encoder buffer separately
// Encoder layout: [encoder][layer][direction] = keycode
// Format: 3 encoders × 4 layers × 2 directions × 2 bytes = 48 bytes

console.log('Encoder mappings from layout JSON:');
console.log(JSON.stringify(layout.encoders, null, 2));

// QMK keycode mapping (simplified)
const KC = {
  'KC_NO': 0x0000,
  'KC_VOLU': 0x0080,
  'KC_VOLD': 0x0081,
  'KC_MS_WH_UP': 0x00CD,
  'KC_MS_WH_DOWN': 0x00CE,
  'KC_MS_WH_LEFT': 0x00CF,
  'KC_MS_WH_RIGHT': 0x00D0,
  'KC_F13': 0x0068,
  'KC_F14': 0x0069,
  'KC_F15': 0x006A,
  'KC_F16': 0x006B,
  'KC_F17': 0x006C,
  'KC_F18': 0x006D,
};

// Try using SET_BUFFER at different offsets to write encoder data
// Key buffer size = rows × cols × layers × 2 bytes
// For KB16: probably 4×5×4×2 = 160 bytes for keys, then encoders after

console.log('\nTrying SET_BUFFER at offset 160 (after keys)...');

// Create test encoder data: all F13/F14 (safe keys)
const testEncoderData = [];
for (let enc = 0; enc < 3; enc++) {
  for (let layer = 0; layer < 4; layer++) {
    // CCW = F13, CW = F14
    testEncoderData.push(0x00, KC.KC_F13 & 0xff); // CCW
    testEncoderData.push(0x00, KC.KC_F14 & 0xff); // CW
  }
}

console.log('Test data (first 20 bytes):', testEncoderData.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' '));

// Try writing at offset 160
const offset = 160;
const resp = send(0x12, [offset >> 8, offset & 0xff, 28, ...testEncoderData.slice(0, 28)]);
console.log('SET_BUFFER response:', resp ? [...resp].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ') : 'null');

// Verify by reading back
const readResp = send(0x11, [offset >> 8, offset & 0xff, 28]);
console.log('GET_BUFFER response:', readResp ? [...readResp].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ') : 'null');

hid.close();
console.log('\nDone.');
