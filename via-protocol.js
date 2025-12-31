const HID = require('node-hid');

// VIA Protocol Commands (CORRECT IDs from VIA app source)
const VIA_CMD = {
  GET_PROTOCOL_VERSION: 0x01,
  GET_KEYBOARD_VALUE: 0x02,
  SET_KEYBOARD_VALUE: 0x03,
  DYNAMIC_KEYMAP_GET_KEYCODE: 0x04,
  DYNAMIC_KEYMAP_SET_KEYCODE: 0x05,
  CUSTOM_MENU_SET_VALUE: 0x07,
  CUSTOM_MENU_GET_VALUE: 0x08,
  CUSTOM_MENU_SAVE: 0x09,
  DYNAMIC_KEYMAP_GET_ENCODER: 0x14,
  DYNAMIC_KEYMAP_SET_ENCODER: 0x15,
};

// RGB Matrix channel and value IDs
const RGB_MATRIX = {
  CHANNEL: 3,
  BRIGHTNESS: 1,
  EFFECT: 2,
  EFFECT_SPEED: 3,
  COLOR: 4,
};

const VENDOR_ID = 0xd010;
const PRODUCT_ID = 0x1601;
const HID_REPORT_SIZE = 32;

class ViaProtocol {
  constructor() {
    this.device = null;
  }

  findViaInterface() {
    const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
    return devices.find(d => d.usagePage === 0xFF60);
  }

  open() {
    const deviceInfo = this.findViaInterface();
    if (!deviceInfo) {
      throw new Error('DOIO keyboard not found');
    }
    this.device = new HID.HID(deviceInfo.path);
    return this;
  }

  close() {
    if (this.device) {
      this.device.close();
      this.device = null;
    }
  }

  sendCommand(cmd, data = []) {
    const buffer = Buffer.alloc(HID_REPORT_SIZE + 1);
    buffer[0] = 0x00; // Report ID
    buffer[1] = cmd;
    for (let i = 0; i < data.length && i < HID_REPORT_SIZE - 1; i++) {
      buffer[i + 2] = data[i];
    }
    this.device.write([...buffer]);
    return this.device.readTimeout(1000);
  }

  // === ENCODER FUNCTIONS ===

  getEncoderMapping(layer, encoderIdx, clockwise) {
    const response = this.sendCommand(VIA_CMD.DYNAMIC_KEYMAP_GET_ENCODER, [
      layer,
      encoderIdx,
      clockwise ? 1 : 0
    ]);
    if (response && response[0] === VIA_CMD.DYNAMIC_KEYMAP_GET_ENCODER) {
      return (response[4] << 8) | response[5];
    }
    return null;
  }

  setEncoderMapping(layer, encoderIdx, clockwise, keycode) {
    const response = this.sendCommand(VIA_CMD.DYNAMIC_KEYMAP_SET_ENCODER, [
      layer,
      encoderIdx,
      clockwise ? 1 : 0,
      (keycode >> 8) & 0xFF,
      keycode & 0xFF
    ]);
    return response && response[0] === VIA_CMD.DYNAMIC_KEYMAP_SET_ENCODER;
  }

  getAllEncoderMappings(numEncoders = 3, numLayers = 4) {
    const mappings = [];
    for (let layer = 0; layer < numLayers; layer++) {
      for (let enc = 0; enc < numEncoders; enc++) {
        const ccw = this.getEncoderMapping(layer, enc, false);
        const cw = this.getEncoderMapping(layer, enc, true);
        mappings.push({ layer, encoder: enc, ccw, cw });
      }
    }
    return mappings;
  }

  restoreEncoderMappings(mappings) {
    for (const m of mappings) {
      if (m.ccw !== null) {
        this.setEncoderMapping(m.layer, m.encoder, false, m.ccw);
      }
      if (m.cw !== null) {
        this.setEncoderMapping(m.layer, m.encoder, true, m.cw);
      }
    }
  }

  // === RGB MATRIX FUNCTIONS ===

  getRgbValue(valueId) {
    const response = this.sendCommand(VIA_CMD.CUSTOM_MENU_GET_VALUE, [
      RGB_MATRIX.CHANNEL,
      valueId
    ]);
    if (response && response[0] === VIA_CMD.CUSTOM_MENU_GET_VALUE) {
      return { value1: response[3], value2: response[4] };
    }
    return null;
  }

  setRgbValue(valueId, value1, value2 = 0) {
    return this.sendCommand(VIA_CMD.CUSTOM_MENU_SET_VALUE, [
      RGB_MATRIX.CHANNEL,
      valueId,
      value1,
      value2
    ]);
  }

  getRgbState() {
    const brightness = this.getRgbValue(RGB_MATRIX.BRIGHTNESS);
    const effect = this.getRgbValue(RGB_MATRIX.EFFECT);
    const speed = this.getRgbValue(RGB_MATRIX.EFFECT_SPEED);
    const color = this.getRgbValue(RGB_MATRIX.COLOR);
    return {
      brightness: brightness?.value1,
      effect: effect?.value1,
      speed: speed?.value1,
      hue: color?.value1,
      sat: color?.value2
    };
  }

  setRgbState(state) {
    if (state.effect !== undefined) {
      this.setRgbValue(RGB_MATRIX.EFFECT, state.effect);
    }
    if (state.hue !== undefined && state.sat !== undefined) {
      this.setRgbValue(RGB_MATRIX.COLOR, state.hue, state.sat);
    }
    if (state.brightness !== undefined) {
      this.setRgbValue(RGB_MATRIX.BRIGHTNESS, state.brightness);
    }
    if (state.speed !== undefined) {
      this.setRgbValue(RGB_MATRIX.EFFECT_SPEED, state.speed);
    }
  }

  saveRgb() {
    return this.sendCommand(VIA_CMD.CUSTOM_MENU_SAVE);
  }
}

module.exports = { ViaProtocol, VENDOR_ID, PRODUCT_ID, RGB_MATRIX };
