#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const HID = require('node-hid');
const { ViaProtocol, VENDOR_ID, PRODUCT_ID } = require('./via-protocol');
const { BackupManager } = require('./backup-manager');
const { HueApi } = require('./hue-api');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Hue control constants
const HUE_STEP = 1000;  // Step for hue changes (0-65535) - smoother rotation
const BRI_STEP = 20;    // Step for brightness (1-254)

// "Hue mode" RGB: purple/magenta
const HUE_MODE_RGB = { effect: 1, hue: 200, sat: 255, brightness: 200 };

// Flash duration for RGB feedback
const FLASH_DURATION_MS = 200;

class DoioHueController {
  constructor() {
    this.config = null;
    this.hue = null;
    this.via = null;
    this.hidDevice = null;
    this.backupManager = new BackupManager();
    this.isShuttingDown = false;

    // Original RGB state for restore
    this.originalRgb = null;

    // Current Hue light states
    this.lightStates = {
      bulb1Hue: 0,
      bulb2Hue: 0,
      brightness: 127
    };

    // Debounce
    this.lastEventTime = {};
    this.debounceMs = 30;

    // RGB flash feedback
    this.flashTimeout = null;
    this.viaForFlash = null;
  }

  loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.error('Config not found. Run `node setup.js` first.');
      process.exit(1);
    }
    this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    console.log(`Config: Bridge ${this.config.bridgeIp}, Bulbs: ${this.config.bulb1Id}, ${this.config.bulb2Id}`);
  }

  async initHue() {
    this.hue = new HueApi(this.config.bridgeIp, this.config.apiKey);

    try {
      const light1 = await this.hue.getLight(this.config.bulb1Id);
      const light2 = await this.hue.getLight(this.config.bulb2Id);

      this.lightStates.bulb1Hue = light1.state.hue || 0;
      this.lightStates.bulb2Hue = light2.state.hue || 0;
      this.lightStates.brightness = Math.round((light1.state.bri + light2.state.bri) / 2);

      await this.hue.enableColorMode(this.config.bulb1Id);
      await this.hue.enableColorMode(this.config.bulb2Id);

      console.log(`Lights: Bulb1=${this.lightStates.bulb1Hue}, Bulb2=${this.lightStates.bulb2Hue}, Bri=${this.lightStates.brightness}`);
    } catch (e) {
      console.error('Hue init failed:', e.message);
      throw e;
    }
  }

  backupAndSetHueMode() {
    console.log('Backing up keyboard state...');
    this.via = new ViaProtocol();
    this.via.open();

    // Backup RGB state only (encoders stay as-is, we capture their events)
    this.originalRgb = this.via.getRgbState();

    // Save to rotating backup file
    this.backupManager.saveBackup({ rgb: this.originalRgb });
    this.backupManager.saveSessionBackup({ rgb: this.originalRgb });

    console.log(`Backed up RGB: hue=${this.originalRgb.hue}, effect=${this.originalRgb.effect}`);

    // Set HUE MODE - just change RGB color
    console.log('Setting Hue control mode...');
    this.via.setRgbState(HUE_MODE_RGB);

    // NOTE: We DON'T change encoder mappings!
    // Opening the Consumer HID interface captures the events
    // and prevents them from reaching the OS (no volume/zoom side effects)

    console.log('Keyboard RGB set to purple (Hue mode)');

    this.via.close();
    this.via = null;
  }

  restoreKeyboard() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('\nRestoring keyboard RGB...');

    const backup = this.backupManager.getSessionBackup();
    if (!backup) {
      console.log('No backup found.');
      return;
    }

    try {
      this.via = new ViaProtocol();
      this.via.open();

      // Restore RGB only
      if (backup.rgb) {
        this.via.setRgbState(backup.rgb);
      }

      this.via.close();
      console.log('Keyboard RGB restored.');
    } catch (e) {
      console.error('Restore failed:', e.message);
    }

    this.backupManager.clearSessionBackup();
  }

  // Flash keyboard RGB to show current bulb color
  flashBulbColor(hueValue) {
    // Convert Philips Hue (0-65535) to keyboard hue (0-255)
    const kbHue = Math.round((hueValue / 65535) * 255);

    try {
      if (!this.viaForFlash) {
        this.viaForFlash = new ViaProtocol();
        this.viaForFlash.open();
      }

      // Set to bulb's current color
      this.viaForFlash.setRgbState({ hue: kbHue, sat: 255 });

      // Clear existing timeout
      if (this.flashTimeout) {
        clearTimeout(this.flashTimeout);
      }

      // Restore to purple after delay
      this.flashTimeout = setTimeout(() => {
        try {
          if (this.viaForFlash) {
            this.viaForFlash.setRgbState({ hue: HUE_MODE_RGB.hue, sat: HUE_MODE_RGB.sat });
          }
        } catch (e) {
          // Ignore flash restore errors
        }
      }, FLASH_DURATION_MS);

    } catch (e) {
      // Ignore flash errors - don't disrupt main functionality
    }
  }

  findConsumerInterface() {
    const devices = HID.devices(VENDOR_ID, PRODUCT_ID);
    return devices.find(d => d.usagePage === 0x0c);
  }

  startHidListener() {
    console.log('Starting knob listener...');

    const consumerDevice = this.findConsumerInterface();
    if (!consumerDevice) {
      console.error('Consumer HID interface not found');
      process.exit(1);
    }

    this.hidDevice = new HID.HID(consumerDevice.path);

    this.hidDevice.on('data', (data) => {
      this.handleHidData(data);
    });

    this.hidDevice.on('error', (err) => {
      console.error('HID error:', err.message);
    });

    console.log('Listening for knob events...');
  }

  handleHidData(data) {
    const reportId = data[0];
    const code = data[1];
    const byte7 = data.length > 7 ? data[7] : 0;

    if (code === 0) return; // Release event

    // Debounce
    const eventKey = `${reportId}-${code}-${byte7}`;
    const now = Date.now();
    if (this.lastEventTime[eventKey] && (now - this.lastEventTime[eventKey]) < this.debounceMs) {
      return;
    }
    this.lastEventTime[eventKey] = now;

    // Even though encoders are set to KC_NO, the Consumer interface
    // might still receive events based on what was captured before.
    // We identify by reportId and code patterns:
    // Report 0x04: Volume (encoder 0) - code 0xe9=up, 0xea=down
    // Report 0x06, code 0x0a: Encoder 1 - byte7: 0x20=CCW, 0x40=CW
    // Report 0x06, code 0x03: Encoder 2 - byte7: 0x20=CCW, 0x40=CW

    if (reportId === 0x04) {
      // Small knob 1 (volume codes) -> Bulb 1 hue
      if (code === 0xe9) {
        this.adjustHue(1, HUE_STEP);
      } else if (code === 0xea) {
        this.adjustHue(1, -HUE_STEP);
      }
    } else if (reportId === 0x06) {
      const direction = byte7 === 0x40 ? 1 : byte7 === 0x20 ? -1 : 0;
      if (direction === 0) return;

      if (code === 0x0a) {
        // Small knob 2 -> Bulb 2 hue
        this.adjustHue(2, direction * HUE_STEP);
      } else if (code === 0x03) {
        // Large knob -> Brightness (both bulbs) - reversed direction
        this.adjustBrightness(-direction * BRI_STEP);
      }
    }
  }

  async adjustHue(bulbNum, delta) {
    try {
      if (bulbNum === 1) {
        this.lightStates.bulb1Hue = (this.lightStates.bulb1Hue + delta + 65536) % 65536;
        console.log(`Bulb 1 hue: ${this.lightStates.bulb1Hue}`);
        this.flashBulbColor(this.lightStates.bulb1Hue);
        await this.hue.setHue(this.config.bulb1Id, this.lightStates.bulb1Hue);
      } else {
        this.lightStates.bulb2Hue = (this.lightStates.bulb2Hue + delta + 65536) % 65536;
        console.log(`Bulb 2 hue: ${this.lightStates.bulb2Hue}`);
        this.flashBulbColor(this.lightStates.bulb2Hue);
        await this.hue.setHue(this.config.bulb2Id, this.lightStates.bulb2Hue);
      }
    } catch (e) {
      console.error('Hue error:', e.message);
    }
  }

  async adjustBrightness(delta) {
    try {
      this.lightStates.brightness = Math.max(1, Math.min(254, this.lightStates.brightness + delta));
      console.log(`Brightness: ${this.lightStates.brightness}`);
      await this.hue.setBrightnessMultiple(
        [this.config.bulb1Id, this.config.bulb2Id],
        this.lightStates.brightness
      );
    } catch (e) {
      console.error('Hue error:', e.message);
    }
  }

  setupSignalHandlers() {
    const shutdown = () => this.shutdown();
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGHUP', shutdown);
    process.on('exit', () => {
      if (!this.isShuttingDown) this.restoreKeyboard();
    });
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      this.shutdown();
    });
  }

  shutdown() {
    console.log('\nShutting down...');
    if (this.flashTimeout) {
      clearTimeout(this.flashTimeout);
    }
    if (this.viaForFlash) {
      try { this.viaForFlash.close(); } catch (e) {}
      this.viaForFlash = null;
    }
    if (this.hidDevice) {
      try { this.hidDevice.close(); } catch (e) {}
    }
    this.restoreKeyboard();
    process.exit(0);
  }

  async start() {
    console.log('=== DOIO Hue Controller ===\n');

    this.loadConfig();
    this.setupSignalHandlers();

    await this.initHue();
    this.backupAndSetHueMode();
    this.startHidListener();

    console.log('\nController running:');
    console.log('  Small knob 1: Bulb 1 hue');
    console.log('  Small knob 2: Bulb 2 hue');
    console.log('  Big knob: Brightness');
    console.log('\nPress Ctrl+C to exit and restore keyboard.');
  }
}

const controller = new DoioHueController();
controller.start().catch(e => {
  console.error('Fatal:', e);
  controller.shutdown();
});
