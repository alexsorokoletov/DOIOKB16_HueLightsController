const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;

const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
const viaDevice = devices.find(d => d.usagePage === 0xFF60);

console.log('=== Deep Keymap Probe ===\n');
const hid = new HID.HID(viaDevice.path);

function send(cmd, data = []) {
  const buffer = Buffer.alloc(33);
  buffer[0] = 0x00;
  buffer[1] = cmd;
  for (let i = 0; i < data.length; i++) buffer[i + 2] = data[i];
  hid.write([...buffer]);
  return hid.readTimeout(500);
}

function hex(arr, len = 20) {
  return [...arr].slice(0, len).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// 1. Try all encoder indices on layer 0
console.log('--- Probing encoder indices 0-7, layer 0 ---');
for (let enc = 0; enc < 8; enc++) {
  const ccw = send(0x13, [0, enc, 0]); // GET_ENCODER layer=0, enc, ccw
  const cw = send(0x13, [0, enc, 1]);  // GET_ENCODER layer=0, enc, cw
  const ccwCode = ccw ? (ccw[4] << 8 | ccw[5]) : null;
  const cwCode = cw ? (cw[4] << 8 | cw[5]) : null;
  if (ccwCode || cwCode) {
    console.log(`Encoder ${enc}: CCW=0x${ccwCode?.toString(16)}, CW=0x${cwCode?.toString(16)}`);
  }
}

// 2. Dump keymap buffer (first 256 bytes)
console.log('\n--- Keymap buffer dump (first 256 bytes) ---');
let keymapDump = [];
for (let offset = 0; offset < 256; offset += 28) {
  const size = Math.min(28, 256 - offset);
  const resp = send(0x11, [offset >> 8, offset & 0xff, size]); // GET_BUFFER
  if (resp && resp[0] === 0x11) {
    const chunk = [...resp].slice(4, 4 + size);
    keymapDump.push(...chunk);
  }
}
// Print non-zero regions
console.log('Non-zero regions in keymap buffer:');
for (let i = 0; i < keymapDump.length; i += 2) {
  const code = (keymapDump[i] << 8) | keymapDump[i + 1];
  if (code !== 0) {
    console.log(`  offset ${i}: 0x${code.toString(16).padStart(4, '0')}`);
  }
}

// 3. Try to find encoder buffer (VIA protocol v11+ has separate encoder buffer)
console.log('\n--- Probing custom commands for encoders ---');
// Try command 0x15-0x1F (potential custom commands)
for (let cmd = 0x15; cmd <= 0x1F; cmd++) {
  const resp = send(cmd, [0, 0, 0, 0]);
  if (resp && resp[0] !== 0xff) {
    console.log(`Command 0x${cmd.toString(16)}: ${hex(resp)}`);
  }
}

// 4. Get keyboard ID/info
console.log('\n--- Keyboard info ---');
const uptime = send(0x02, [0x01]); // GET_KEYBOARD_VALUE - uptime
console.log('Uptime response:', hex(uptime));

const layoutOpts = send(0x02, [0x02]); // GET_KEYBOARD_VALUE - layout options
console.log('Layout options:', hex(layoutOpts));

const switchMatrix = send(0x02, [0x03]); // GET_KEYBOARD_VALUE - switch matrix state
console.log('Switch matrix:', hex(switchMatrix));

hid.close();
console.log('\nDone.');
