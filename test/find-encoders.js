const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Find Encoder Data in Buffer ===\n');
const hid = new HID.HID(viaDevice.path);

function send(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) buffer[i + 2] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

// Known keycodes from user's layout to search for
const KNOWN_ENCODER_CODES = {
  'KC_VOLU': 0x0080,       // Volume up
  'KC_MS_WH_LEFT': 0x00D4, // Mouse wheel left
  'KC_MS_WH_RIGHT': 0x00D5,// Mouse wheel right
  'KC_NO': 0x0000,         // No action
};

console.log('Looking for encoder keycodes in buffer...');
console.log('Expected: KC_VOLU=0x0080, KC_MS_WH_LEFT=0x00D4, KC_MS_WH_RIGHT=0x00D5\n');

// Dump entire keymap buffer (up to 512 bytes)
let fullBuffer = [];
for (let offset = 0; offset < 512; offset += 28) {
  const size = Math.min(28, 512 - offset);
  const resp = send(0x11, [offset >> 8, offset & 0xff, size]); // GET_BUFFER
  if (resp && resp[0] === 0x11) {
    const chunk = [...resp].slice(4, 4 + size);
    fullBuffer.push(...chunk);
  }
}

console.log(`Buffer size read: ${fullBuffer.length} bytes\n`);

// Find non-zero regions
console.log('Non-zero 16-bit values in buffer:');
for (let i = 0; i < fullBuffer.length; i += 2) {
  const code = (fullBuffer[i] << 8) | fullBuffer[i + 1];
  if (code !== 0) {
    let name = '';
    if (code === 0x0080) name = ' <- KC_VOLU!';
    if (code === 0x00D4) name = ' <- KC_MS_WH_LEFT!';
    if (code === 0x00D5) name = ' <- KC_MS_WH_RIGHT!';
    console.log(`  offset ${i}: 0x${code.toString(16).padStart(4, '0')}${name}`);
  }
}

// Also try reading at higher offsets (encoder data might be separate)
console.log('\n--- Checking higher offsets (512-1024) ---');
for (let offset = 512; offset < 1024; offset += 28) {
  const size = Math.min(28, 1024 - offset);
  const resp = send(0x11, [offset >> 8, offset & 0xff, size]);
  if (resp && resp[0] === 0x11) {
    const chunk = [...resp].slice(4, 4 + size);
    const hasData = chunk.some(b => b !== 0);
    if (hasData) {
      console.log(`Offset ${offset}: ${chunk.slice(0,16).map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
    }
  }
}

hid.close();
console.log('\nDone.');
