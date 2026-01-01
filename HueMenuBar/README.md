# HueMenuBar

A minimal macOS menubar app to control Philips Hue bulbs.

## Features

- Menubar-only (no dock icon)
- Independent control of two bulbs
- On/off toggle per bulb
- Brightness slider (1-254)
- Color/hue slider with live preview
- Fetches bulb names from bridge

## Requirements

- macOS 13.0+
- Swift 5.0+ (included with Xcode Command Line Tools)
- Philips Hue Bridge on local network

## Configuration

The app reads from `config.json` in the parent philips-hue directory (created by `npm run setup`):

```json
{
  "bridgeIp": "192.168.0.6",
  "apiKey": "your-api-key",
  "bulb1Id": "6",
  "bulb2Id": "8"
}
```

To create this config, run setup in the parent project:
```bash
cd .. && npm run setup
```

## Build

```bash
./build.sh
```

Or manually:
```bash
cd HueMenuBar
swiftc -O -o HueMenuBar -framework SwiftUI -framework AppKit HueMenuBarApp.swift HueController.swift
cd ..
mkdir -p HueMenuBar.app/Contents/MacOS
mkdir -p HueMenuBar.app/Contents/Resources
mv HueMenuBar/HueMenuBar HueMenuBar.app/Contents/MacOS/
cp HueMenuBar/Info.plist HueMenuBar.app/Contents/
```

## Run

```bash
open HueMenuBar.app
```

## Install

Copy to Applications:
```bash
cp -r HueMenuBar.app /Applications/
```

## Auto-Start on Login

Create launch agent:
```bash
cat > ~/Library/LaunchAgents/com.alex.HueMenuBar.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.alex.HueMenuBar</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/HueMenuBar.app/Contents/MacOS/HueMenuBar</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.alex.HueMenuBar.plist
```

Disable auto-start:
```bash
launchctl unload ~/Library/LaunchAgents/com.alex.HueMenuBar.plist
rm ~/Library/LaunchAgents/com.alex.HueMenuBar.plist
```

## License

MIT
