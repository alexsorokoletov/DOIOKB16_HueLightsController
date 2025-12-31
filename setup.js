#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { HueApi } = require('./hue-api');
const { ViaProtocol } = require('./via-protocol');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (q) => new Promise(resolve => rl.question(q, resolve));

async function setup() {
  console.log('=== DOIO Hue Controller Setup ===\n');

  let config = {};
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    console.log('Existing config found.\n');
  }

  // Test DOIO keyboard connection
  console.log('--- Testing DOIO Keyboard ---');
  try {
    const via = new ViaProtocol();
    via.open();
    const version = via.getProtocolVersion();
    console.log(`VIA Protocol version: ${version}`);

    // Test reading encoder mappings
    console.log('Testing encoder read...');
    const testMapping = via.getEncoderMapping(0, 0, true);
    console.log(`Encoder 0 CW keycode: 0x${testMapping?.toString(16) || 'null'}`);

    via.close();
    console.log('DOIO keyboard: OK\n');
  } catch (e) {
    console.log(`DOIO keyboard: FAILED - ${e.message}`);
    console.log('Make sure the keyboard is connected and VIA-compatible.\n');
  }

  // Hue Bridge setup
  console.log('--- Hue Bridge Setup ---');

  // Discover bridges
  console.log('Discovering Hue bridges...');
  try {
    const bridges = await HueApi.discoverBridges();
    if (bridges.length > 0) {
      console.log('Found bridges:');
      bridges.forEach((b, i) => console.log(`  ${i + 1}. ${b.internalipaddress} (${b.id})`));

      if (!config.bridgeIp) {
        if (bridges.length === 1) {
          config.bridgeIp = bridges[0].internalipaddress;
        } else {
          const choice = await question('Select bridge number: ');
          config.bridgeIp = bridges[parseInt(choice) - 1].internalipaddress;
        }
      }
      console.log(`Using bridge: ${config.bridgeIp}\n`);
    } else {
      console.log('No bridges found via discovery.');
      if (!config.bridgeIp) {
        config.bridgeIp = await question('Enter bridge IP manually: ');
      }
    }
  } catch (e) {
    console.log(`Discovery failed: ${e.message}`);
    if (!config.bridgeIp) {
      config.bridgeIp = await question('Enter bridge IP manually: ');
    }
  }

  // API Key setup
  if (!config.apiKey) {
    console.log('\n--- API Key Setup ---');
    console.log('You need a Hue API key. Options:');
    console.log('  1. Enter existing API key');
    console.log('  2. Create new key (requires pressing bridge button)');

    const choice = await question('Choice (1/2): ');

    if (choice === '1') {
      config.apiKey = await question('Enter API key: ');
    } else {
      console.log('\nPress the button on your Hue bridge, then press Enter...');
      await question('');
      try {
        config.apiKey = await HueApi.createUser(config.bridgeIp, 'doio-hue-controller');
        console.log(`API key created: ${config.apiKey}`);
      } catch (e) {
        console.log(`Failed to create key: ${e.message}`);
        config.apiKey = await question('Enter API key manually: ');
      }
    }
  }

  // Test connection
  console.log('\n--- Testing Connection ---');
  const api = new HueApi(config.bridgeIp, config.apiKey);
  const test = await api.testConnection();

  if (test.success) {
    console.log(`Connection OK! Found ${test.lightCount} lights.`);
  } else {
    console.log(`Connection failed: ${test.error}`);
    console.log('Please check your API key and try again.');
    rl.close();
    return;
  }

  // Get lights
  console.log('\n--- Light Selection ---');
  const lights = await api.getLights();
  console.log('Available lights:');
  Object.entries(lights).forEach(([id, light]) => {
    console.log(`  ${id}. ${light.name} (${light.type})`);
  });

  if (!config.bulb1Id) {
    config.bulb1Id = await question('Enter ID for Bulb 1 (small knob 1 controls hue): ');
  }
  if (!config.bulb2Id) {
    config.bulb2Id = await question('Enter ID for Bulb 2 (small knob 2 controls hue): ');
  }

  console.log(`\nBulb 1: ${lights[config.bulb1Id]?.name || config.bulb1Id}`);
  console.log(`Bulb 2: ${lights[config.bulb2Id]?.name || config.bulb2Id}`);
  console.log('Big knob: Controls brightness of both bulbs');

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`\nConfig saved to ${CONFIG_PATH}`);

  // Print current light states
  console.log('\n--- Current Light States ---');
  for (const id of [config.bulb1Id, config.bulb2Id]) {
    const light = await api.getLight(id);
    console.log(`${light.name}:`);
    console.log(`  On: ${light.state.on}`);
    console.log(`  Brightness: ${light.state.bri}`);
    console.log(`  Hue: ${light.state.hue}`);
    console.log(`  Saturation: ${light.state.sat}`);
  }

  console.log('\n=== Setup Complete ===');
  console.log('Run `node index.js` to start the controller.');

  rl.close();
}

setup().catch(e => {
  console.error('Setup error:', e);
  rl.close();
  process.exit(1);
});
