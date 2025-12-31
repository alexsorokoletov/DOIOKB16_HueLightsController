const https = require('https');
const http = require('http');

class HueApi {
  constructor(bridgeIp, apiKey) {
    this.bridgeIp = bridgeIp;
    this.apiKey = apiKey;
  }

  // Discover bridges on local network via meethue.com
  static async discoverBridges() {
    return new Promise((resolve, reject) => {
      https.get('https://discovery.meethue.com/', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const bridges = JSON.parse(data);
            resolve(bridges);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  // Make API request to bridge
  async request(method, endpoint, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.bridgeIp,
        port: 80,
        path: `/api/${this.apiKey}${endpoint}`,
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        // Ignore self-signed cert issues
        rejectUnauthorized: false
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // Get all lights
  async getLights() {
    return this.request('GET', '/lights');
  }

  // Get specific light
  async getLight(lightId) {
    return this.request('GET', `/lights/${lightId}`);
  }

  // Set light state
  async setLightState(lightId, state) {
    return this.request('PUT', `/lights/${lightId}/state`, state);
  }

  // Set hue (0-65535)
  async setHue(lightId, hue) {
    // Ensure hue wraps around
    const normalizedHue = ((hue % 65536) + 65536) % 65536;
    return this.setLightState(lightId, { hue: Math.round(normalizedHue), on: true });
  }

  // Set brightness (1-254)
  async setBrightness(lightId, brightness) {
    const clampedBri = Math.max(1, Math.min(254, brightness));
    return this.setLightState(lightId, { bri: Math.round(clampedBri), on: true });
  }

  // Set brightness for multiple lights
  async setBrightnessMultiple(lightIds, brightness) {
    const clampedBri = Math.max(1, Math.min(254, brightness));
    const promises = lightIds.map(id =>
      this.setLightState(id, { bri: Math.round(clampedBri), on: true })
    );
    return Promise.all(promises);
  }

  // Turn on light with saturation for vivid colors
  async enableColorMode(lightId) {
    return this.setLightState(lightId, { on: true, sat: 254 });
  }

  // Create new user (requires bridge button press)
  static async createUser(bridgeIp, appName = 'doio-hue-controller') {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ devicetype: appName });
      const options = {
        hostname: bridgeIp,
        port: 80,
        path: '/api',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed[0]?.success?.username) {
              resolve(parsed[0].success.username);
            } else if (parsed[0]?.error) {
              reject(new Error(parsed[0].error.description));
            } else {
              reject(new Error('Unknown response: ' + data));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // Test connection
  async testConnection() {
    try {
      const lights = await this.getLights();
      if (lights.error) {
        return { success: false, error: lights.error.description };
      }
      return { success: true, lightCount: Object.keys(lights).length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = { HueApi };
