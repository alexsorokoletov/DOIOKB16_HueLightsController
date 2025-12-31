# DOIO KB16 Hue Controller

## Device Info
- **Vendor ID**: 0xD010
- **Product ID**: 0x1601
- **Model**: DOIO KB16-01 (16 keys + 3 encoders)

## VIA Protocol Commands (CORRECT IDs)
```
GET_ENCODER = 0x14  (NOT 0x13!)
SET_ENCODER = 0x15  (NOT 0x14!)
CUSTOM_MENU_GET_VALUE = 0x08
CUSTOM_MENU_SET_VALUE = 0x07
```

## RGB Matrix Control
- **Channel ID**: 3
- **Value IDs**:
  - Brightness = 1
  - Effect = 2
  - Speed = 3
  - Color = 4 (hue, sat as 2 bytes)

## HID Interfaces
| UsagePage | Usage | Purpose |
|-----------|-------|---------|
| 0xFF60    | 0x61  | VIA protocol (read/write config) |
| 0x0C      | 0x01  | Consumer (volume, media, zoom) - READABLE |
| 0x01      | 0x06  | Keyboard - macOS BLOCKS access |
| 0x01      | 0x02  | Mouse - readable |

## Encoder HID Events (Consumer Interface)
When encoders are mapped to Consumer codes:
- **Report 0x04**: Volume knob
  - 0xE9 = Volume Up
  - 0xEA = Volume Down
- **Report 0x06**: Other encoders
  - Code 0x0A = Encoder 1 (small knob 1)
  - Code 0x03 = Encoder 2 (small knob 2)
  - Byte 7: 0x20 = CCW, 0x40 = CW

## Layer Switching
- User's keyboard has 4 layers (0-3)
- TG(1) toggles layer 1
- TO(x) switches to layer x
- VIA SET_KEYBOARD_VALUE for default layer might work (command 0x03, value 0x05)

## Key Findings
1. **HID Capture**: Opening Consumer HID interface CAPTURES events - they don't reach OS!
   - No volume/zoom side effects when script is running
   - This is the key insight that makes the solution work
2. **Encoder KC_NO**: If encoder set to KC_NO (0x0000), NO HID events are sent - can't detect rotation
3. **Keyboard interface**: macOS blocks direct access to keyboard HID interface (0x01)
   - KC_A, KC_B etc. go through keyboard interface, not Consumer
4. **Layer switching**: Internal to keyboard firmware, no HID event sent
   - TG(x) toggles layer, no way to detect or control via HID

## Diagnostic Scripts
- `node keylogger.js` - Log all HID events from keyboard
- `node test-via.js` - Test VIA protocol
- `node test-correct-encoder.js` - Test encoder get/set
- `node test-correct-lighting.js` - Test RGB Matrix

## User's Layout File
`~/Desktop/kb16_01.layout.json` - VIA layout backup
