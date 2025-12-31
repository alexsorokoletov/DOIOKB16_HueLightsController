#!/usr/bin/env node

// Test script to verify Hue Bridge connection

const fs = require('fs');
const path = require('path');
const { HueApi } = require('./hue-api');

const CONFIG_PATH = path.join(__dirname, 'config.json');

async function testHue() {
  console.log('=== Hue Bridge Test ===\n');

  // Discover bridges
  console.log('--- Bridge Discovery ---');
  try {
    const bridges = await HueApi.discoverBridges();
    if (bridges.length > 0) {
      console.log('Found bridges:');
      bridges.forEach(b => console.log(`  ${b.internalipaddress} (${b.id})`));
    } else {
      console.log('No bridges found via discovery');
    }
  } catch (e) {
    console.log(`Discovery failed: ${e.message}`);
  }

  // Test with config
  console.log('\n--- Config Test ---');
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('No config.json found. Run `npm run setup` first.');
    console.log('\nTo test manually, create config.json:');
    console.log(JSON.stringify({
      bridgeIp: "YOUR_BRIDGE_IP",
      apiKey: "YOUR_API_KEY",
      bulb1Id: "1",
      bulb2Id: "2"
    }, null, 2));
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  console.log(`Bridge IP: ${config.bridgeIp}`);
  console.log(`API Key: ${config.apiKey?.slice(0, 10)}...`);

  const api = new HueApi(config.bridgeIp, config.apiKey);

  // Test connection
  console.log('\n--- Connection Test ---');
  const test = await api.testConnection();
  if (test.success) {
    console.log(`Connection: OK (${test.lightCount} lights)`);
  } else {
    console.log(`Connection: FAILED - ${test.error}`);
    return;
  }

  // List lights
  console.log('\n--- Available Lights ---');
  const lights = await api.getLights();
  for (const [id, light] of Object.entries(lights)) {
    console.log(`[${id}] ${light.name}`);
    console.log(`     Type: ${light.type}`);
    console.log(`     On: ${light.state.on}, Bri: ${light.state.bri}, Hue: ${light.state.hue}`);
  }

  // Test light control
  if (config.bulb1Id) {
    console.log(`\n--- Testing Light ${config.bulb1Id} ---`);
    console.log('Setting hue to red (0)...');
    await api.setHue(config.bulb1Id, 0);
    await new Promise(r => setTimeout(r, 1000));

    console.log('Setting hue to green (21845)...');
    await api.setHue(config.bulb1Id, 21845);
    await new Promise(r => setTimeout(r, 1000));

    console.log('Setting hue to blue (43690)...');
    await api.setHue(config.bulb1Id, 43690);
    await new Promise(r => setTimeout(r, 1000));

    // Restore
    const original = await api.getLight(config.bulb1Id);
    console.log('Test complete.');
  }
}

testHue().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
