#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Compiling HueMenuBar..."
cd HueMenuBar
swiftc -O -o HueMenuBar -framework SwiftUI -framework AppKit HueMenuBarApp.swift HueController.swift
cd ..

echo "Creating app bundle..."
rm -rf HueMenuBar.app
mkdir -p HueMenuBar.app/Contents/MacOS
mkdir -p HueMenuBar.app/Contents/Resources
mv HueMenuBar/HueMenuBar HueMenuBar.app/Contents/MacOS/
cp HueMenuBar/Info.plist HueMenuBar.app/Contents/

echo "Done! App is at HueMenuBar.app"
echo "Run: open HueMenuBar.app"
