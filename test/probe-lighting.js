const { ViaProtocol } = require('./via-protocol');

console.log('=== Probing VIA Lighting IDs ===\n');

const via = new ViaProtocol();
via.open();

// Try different value IDs to find what the keyboard supports
const ids = [
  { id: 0x80, name: 'qmk_rgblight_brightness' },
  { id: 0x81, name: 'qmk_rgblight_effect' },
  { id: 0x82, name: 'qmk_rgblight_effect_speed' },
  { id: 0x83, name: 'qmk_rgblight_color' },
  { id: 0x40, name: 'qmk_rgb_matrix_brightness' },
  { id: 0x41, name: 'qmk_rgb_matrix_effect' },
  { id: 0x42, name: 'qmk_rgb_matrix_effect_speed' },
  { id: 0x43, name: 'qmk_rgb_matrix_color' },
  { id: 0x00, name: 'backlight_brightness' },
  { id: 0x01, name: 'backlight_effect' },
];

for (const { id, name } of ids) {
  const result = via.getLightingValue(id);
  console.log(`0x${id.toString(16).padStart(2, '0')} (${name}): ${JSON.stringify(result)}`);
}

// Try setting RGB Matrix effect to solid
console.log('\nTrying RGB Matrix set (effect=0, solid):');
via.setLightingValue(0x41, 0); // RGB Matrix effect = solid

console.log('Trying RGB Matrix color (purple):');
via.setLightingValue(0x43, 213, 255); // hue, sat

console.log('Trying RGB Matrix brightness:');
via.setLightingValue(0x40, 200);

via.close();
console.log('\nCheck if keyboard changed color.');
