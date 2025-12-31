const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Vial/Custom Protocol Probe ===\n');
const hid = new HID.HID(viaDevice.path);

function send(data) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  for (let i = 0; i < data.length; i++) buffer[i + 1] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

function hex(arr, len = 32) {
  if (!arr) return 'null';
  return [...arr].slice(0, len).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// Check if it's Vial
console.log('--- Vial detection ---');
const vialId = send([0xFE, 0x00]); // Vial get keyboard ID
console.log('Vial ID (0xFE 0x00):', hex(vialId));

const vialSize = send([0xFE, 0x01]); // Vial get size
console.log('Vial size (0xFE 0x01):', hex(vialSize));

const vialDef = send([0xFE, 0x02, 0, 0, 0, 0]); // Vial get definition
console.log('Vial def (0xFE 0x02):', hex(vialDef));

// Try VIA v3 custom channel format
console.log('\n--- VIA3 custom channels ---');
for (let channel = 0; channel < 4; channel++) {
  const resp = send([0x20 + channel, 0x00, 0x00]);
  if (resp && resp[0] !== 0xff) {
    console.log(`Channel ${channel} (0x${(0x20 + channel).toString(16)}):`);
    console.log('  ', hex(resp));
  }
}

// Try to read encoder config at different buffer offsets
console.log('\n--- Extended keymap buffer ---');
const offsets = [0, 128, 256, 384, 512, 640, 768, 896, 1024];
for (const offset of offsets) {
  const resp = send([0x11, offset >> 8, offset & 0xff, 28]); // GET_BUFFER
  if (resp && resp[0] === 0x11) {
    const hasData = [...resp].slice(4, 32).some(b => b !== 0);
    if (hasData) {
      console.log(`Offset ${offset}: ${hex(resp.slice(4, 20))}`);
    }
  }
}

// Try direct key read for various positions
console.log('\n--- Key matrix probe (layer 0) ---');
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 4; col++) {
    const resp = send([0x04, 0, row, col]); // GET_KEYCODE layer, row, col
    if (resp && resp[0] === 0x04) {
      const keycode = (resp[4] << 8) | resp[5];
      if (keycode !== 0) {
        console.log(`Key [${row},${col}]: 0x${keycode.toString(16).padStart(4, '0')}`);
      }
    }
  }
}

// Probe for encoder-specific keys (maybe they're in the matrix)
console.log('\n--- Extended matrix positions ---');
for (let row = 4; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    const resp = send([0x04, 0, row, col]);
    if (resp && resp[0] === 0x04) {
      const keycode = (resp[4] << 8) | resp[5];
      if (keycode !== 0) {
        console.log(`Key [${row},${col}]: 0x${keycode.toString(16).padStart(4, '0')}`);
      }
    }
  }
}

hid.close();
console.log('\nDone.');
