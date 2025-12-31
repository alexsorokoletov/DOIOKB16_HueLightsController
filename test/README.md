# Test & Diagnostic Scripts

These scripts were used during development to explore the DOIO KB16's HID interfaces and VIA protocol.

## Scripts

| Script | Purpose |
|--------|---------|
| `find-encoders.js` | Find encoder positions in VIA keymap |
| `probe-keymap.js` | Probe VIA keymap commands |
| `probe-lighting.js` | Probe RGB lighting commands |
| `probe-raw.js` | Raw HID packet inspection |
| `probe-vial.js` | Test VIAL protocol commands |
| `scan-full-matrix.js` | Scan full key matrix |
| `test-correct-encoder.js` | Test correct encoder command IDs (0x14/0x15) |
| `test-correct-lighting.js` | Test correct RGB command IDs |
| `test-encoder-set.js` | Test encoder mapping get/set |
| `test-hue.js` | Test Philips Hue API connection |
| `test-layout-load.js` | Test VIA layout loading |
| `test-pixel-rgb.js` | Test per-LED RGB control (not supported) |
| `test-set-key.js` | Test keycode get/set |
| `test-via.js` | Test VIA protocol connection |
| `test-via-keys.js` | Test VIA key commands |
| `test-vial.js` | Test VIAL protocol |

## Running

```bash
node test/<script-name>.js
```

Or use npm scripts:

```bash
npm run test:via   # Test VIA protocol
npm run test:hue   # Test Hue API
```

## Key Findings

1. **VIA Command IDs**: The correct encoder commands are `0x14` (GET) and `0x15` (SET), not `0x13`/`0x14` as some documentation suggests.

2. **RGB Control**: Uses Custom Menu channel 3 with value IDs 1-4 for brightness, effect, speed, and color.

3. **Per-LED Control**: Not supported on this keyboard's firmware - only global RGB settings are available.

4. **HID Capture**: Opening the Consumer HID interface (usagePage 0x0C) captures encoder events, preventing OS side effects like volume/zoom changes.
