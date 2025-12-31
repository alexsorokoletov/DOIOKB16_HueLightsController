const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Test SET_KEYCODE ===\n');
const hid = new HID.HID(viaDevice.path);

function send(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) buffer[i + 2] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

function getKey(layer, row, col) {
  const resp = send(0x04, [layer, row, col]);
  if (resp && resp[0] === 0x04) {
    return (resp[4] << 8) | resp[5];
  }
  return null;
}

function setKey(layer, row, col, keycode) {
  const resp = send(0x05, [layer, row, col, (keycode >> 8) & 0xff, keycode & 0xff]);
  return resp && resp[0] === 0x05;
}

// Test on key [1,0] which is currently KC_A (0x0004)
const testPos = { layer: 0, row: 1, col: 0 };

console.log('Reading key [1,0] on layer 0...');
const original = getKey(testPos.layer, testPos.row, testPos.col);
console.log(`Original keycode: 0x${original.toString(16).padStart(4, '0')} (KC_A = 0x0004)`);

// Try changing it to KC_Z (0x001D)
const newCode = 0x001D; // KC_Z
console.log(`\nSetting to KC_Z (0x001D)...`);
const setResult = setKey(testPos.layer, testPos.row, testPos.col, newCode);
console.log(`SET_KEYCODE result: ${setResult}`);

// Read it back
console.log('\nReading back...');
const afterSet = getKey(testPos.layer, testPos.row, testPos.col);
console.log(`New keycode: 0x${afterSet?.toString(16).padStart(4, '0')}`);

if (afterSet === newCode) {
  console.log('\n*** SUCCESS! SET_KEYCODE works! ***');
  console.log('>>> Press the top-left button to verify it sends "Z" <<<');
  console.log('(Will restore in 10 seconds...)');

  setTimeout(() => {
    console.log('\nRestoring original keycode...');
    setKey(testPos.layer, testPos.row, testPos.col, original);
    const restored = getKey(testPos.layer, testPos.row, testPos.col);
    console.log(`Restored to: 0x${restored?.toString(16).padStart(4, '0')}`);
    hid.close();
    console.log('Done.');
  }, 10000);
} else {
  console.log('\nSET_KEYCODE did not change the value.');
  hid.close();
}
