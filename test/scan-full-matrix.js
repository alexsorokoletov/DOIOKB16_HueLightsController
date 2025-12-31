const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Full Matrix Scan ===\n');
const hid = new HID.HID(viaDevice.path);

function send(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) buffer[i + 2] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(200);
}

// QMK keycodes we're looking for
const KEYCODES = {
  0x0080: 'KC_VOLU',
  0x0081: 'KC_VOLD',
  0x00D4: 'KC_MS_WH_LEFT',
  0x00D5: 'KC_MS_WH_RIGHT',
  0x00D6: 'KC_MS_WH_UP',
  0x00D7: 'KC_MS_WH_DOWN',
};

console.log('Scanning layer 0, rows 0-16, cols 0-16...\n');

const found = [];
for (let row = 0; row < 16; row++) {
  for (let col = 0; col < 16; col++) {
    const resp = send(0x04, [0, row, col]);
    if (resp && resp[0] === 0x04) {
      const keycode = (resp[4] << 8) | resp[5];
      if (keycode !== 0) {
        const name = KEYCODES[keycode] || '';
        found.push({ row, col, keycode, name });
      }
    }
  }
}

console.log('All non-zero keycodes found:');
for (const { row, col, keycode, name } of found) {
  const marker = name ? ` <-- ${name} (ENCODER?)` : '';
  console.log(`  [${row},${col}] = 0x${keycode.toString(16).padStart(4, '0')}${marker}`);
}

console.log(`\nTotal: ${found.length} keys found`);

// Also check all 4 layers for the same positions
console.log('\n--- Checking all layers for encoder-like keycodes ---');
for (const { row, col } of found.filter(f => f.name)) {
  console.log(`Position [${row},${col}]:`);
  for (let layer = 0; layer < 4; layer++) {
    const resp = send(0x04, [layer, row, col]);
    if (resp && resp[0] === 0x04) {
      const keycode = (resp[4] << 8) | resp[5];
      const name = KEYCODES[keycode] || `0x${keycode.toString(16).padStart(4, '0')}`;
      console.log(`  Layer ${layer}: ${name}`);
    }
  }
}

hid.close();
console.log('\nDone.');
