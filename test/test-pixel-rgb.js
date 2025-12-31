#!/usr/bin/env node

// Test per-LED RGB control via VIA protocol
// Explores if DOIO KB16 supports individual LED color control

const HID = require('node-hid');

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;
const HID_REPORT_SIZE = 32;

// VIA Commands
const VIA_CMD = {
  CUSTOM_MENU_SET_VALUE: 0x07,
  CUSTOM_MENU_GET_VALUE: 0x08,
  LIGHTING_SET_VALUE: 0x09,
  LIGHTING_GET_VALUE: 0x0a,
  // QMK RGB Matrix per-LED commands (if supported)
  RGB_MATRIX_SET_LED: 0x28,  // Experimental
};

// RGB Matrix channel
const RGB_CHANNEL = 3;

class PixelTest {
  constructor() {
    this.device = null;
    this.originalColors = [];
  }

  open() {
    const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
    const via = devices.find(d => d.usagePage === 0xFF60);
    if (!via) throw new Error('Keyboard not found');
    this.device = new HID.HID(via.path);
    console.log('Connected to keyboard');
  }

  close() {
    if (this.device) {
      this.device.close();
      this.device = null;
    }
  }

  sendCommand(cmd, data = []) {
    const buffer = Buffer.alloc(HID_REPORT_SIZE + 1);
    buffer[0] = 0x00;
    buffer[1] = cmd;
    for (let i = 0; i < data.length; i++) {
      buffer[i + 2] = data[i];
    }
    this.device.write([...buffer]);
    return this.device.readTimeout(500);
  }

  // Try various approaches to per-LED control

  // Approach 1: Custom menu with LED index as sub-value
  tryCustomMenuLed(ledIndex, hue, sat) {
    console.log(`\nTrying custom menu LED ${ledIndex}: hue=${hue}, sat=${sat}`);

    // Try: channel=3, valueId=LED_index+offset, then hue/sat
    for (const offset of [0, 16, 32, 64, 128]) {
      const valueId = ledIndex + offset;
      const resp = this.sendCommand(VIA_CMD.CUSTOM_MENU_SET_VALUE, [
        RGB_CHANNEL, valueId, hue, sat
      ]);
      if (resp && resp[0] !== 0xff) {
        console.log(`  offset ${offset}: response ${[...resp].slice(0,8).map(b => b.toString(16)).join(' ')}`);
      }
    }
  }

  // Approach 2: Lighting commands (0x09/0x0a)
  tryLightingLed(ledIndex, hue, sat, brightness = 255) {
    console.log(`\nTrying lighting command LED ${ledIndex}`);

    // Format: [led_index, H, S, V]
    const resp = this.sendCommand(VIA_CMD.LIGHTING_SET_VALUE, [
      ledIndex, hue, sat, brightness
    ]);
    console.log(`  response: ${resp ? [...resp].slice(0,8).map(b => b.toString(16)).join(' ') : 'null'}`);
    return resp;
  }

  // Approach 3: Direct RGB matrix LED set (experimental)
  tryRgbMatrixLed(ledIndex, r, g, b) {
    console.log(`\nTrying RGB matrix LED ${ledIndex}: RGB(${r},${g},${b})`);

    const resp = this.sendCommand(VIA_CMD.RGB_MATRIX_SET_LED, [
      ledIndex, r, g, b
    ]);
    console.log(`  response: ${resp ? [...resp].slice(0,8).map(b => b.toString(16)).join(' ') : 'null'}`);
    return resp;
  }

  // Approach 4: Check if keyboard exposes LED count and per-LED via value IDs 5+
  probeValueIds() {
    console.log('\n=== Probing custom menu value IDs ===');

    for (let valueId = 0; valueId <= 20; valueId++) {
      const resp = this.sendCommand(VIA_CMD.CUSTOM_MENU_GET_VALUE, [
        RGB_CHANNEL, valueId
      ]);
      if (resp && resp[0] === VIA_CMD.CUSTOM_MENU_GET_VALUE) {
        const val1 = resp[3];
        const val2 = resp[4];
        if (val1 !== 0 || val2 !== 0 || valueId <= 4) {
          console.log(`  valueId ${valueId}: ${val1}, ${val2}`);
        }
      }
    }
  }

  // Get current global RGB state
  getGlobalRgb() {
    const brightness = this.sendCommand(VIA_CMD.CUSTOM_MENU_GET_VALUE, [RGB_CHANNEL, 1]);
    const effect = this.sendCommand(VIA_CMD.CUSTOM_MENU_GET_VALUE, [RGB_CHANNEL, 2]);
    const speed = this.sendCommand(VIA_CMD.CUSTOM_MENU_GET_VALUE, [RGB_CHANNEL, 3]);
    const color = this.sendCommand(VIA_CMD.CUSTOM_MENU_GET_VALUE, [RGB_CHANNEL, 4]);

    return {
      brightness: brightness?.[3],
      effect: effect?.[3],
      speed: speed?.[3],
      hue: color?.[3],
      sat: color?.[4]
    };
  }

  setGlobalRgb(state) {
    if (state.effect !== undefined) {
      this.sendCommand(VIA_CMD.CUSTOM_MENU_SET_VALUE, [RGB_CHANNEL, 2, state.effect, 0]);
    }
    if (state.hue !== undefined) {
      this.sendCommand(VIA_CMD.CUSTOM_MENU_SET_VALUE, [RGB_CHANNEL, 4, state.hue, state.sat || 255]);
    }
    if (state.brightness !== undefined) {
      this.sendCommand(VIA_CMD.CUSTOM_MENU_SET_VALUE, [RGB_CHANNEL, 1, state.brightness, 0]);
    }
  }

  async run() {
    try {
      this.open();

      // Save original state
      const original = this.getGlobalRgb();
      console.log('Original RGB state:', original);

      // Probe available value IDs
      this.probeValueIds();

      // Set to solid color mode (effect=1) for testing
      console.log('\n=== Setting solid color mode ===');
      this.setGlobalRgb({ effect: 1, brightness: 255, hue: 0, sat: 255 });

      // Wait a bit
      await new Promise(r => setTimeout(r, 500));

      // Try different per-LED approaches
      console.log('\n=== Testing per-LED control ===');

      // LED 0 = probably first key
      this.tryLightingLed(0, 85, 255);  // Green
      this.tryLightingLed(1, 170, 255); // Blue

      this.tryRgbMatrixLed(0, 0, 255, 0);   // Green
      this.tryRgbMatrixLed(1, 0, 0, 255);   // Blue

      // Try custom menu approach for LED 0
      this.tryCustomMenuLed(0, 85, 255);

      console.log('\n=== Waiting 3 seconds to observe changes ===');
      await new Promise(r => setTimeout(r, 3000));

      // Restore
      console.log('\n=== Restoring original state ===');
      this.setGlobalRgb(original);
      console.log('Restored');

    } finally {
      this.close();
    }
  }
}

const test = new PixelTest();
test.run().catch(e => {
  console.error('Error:', e.message);
  test.close();
});
