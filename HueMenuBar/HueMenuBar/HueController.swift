import SwiftUI
import Foundation

class Bulb: ObservableObject, Identifiable {
    let id: String
    @Published var name: String
    @Published var isOn: Bool = false
    @Published var brightness: Int = 254
    @Published var hue: Int = 0
    @Published var saturation: Int = 254

    init(id: String, name: String) {
        self.id = id
        self.name = name
    }

    var currentColor: Color {
        Color(hue: Double(hue) / 65535.0, saturation: Double(saturation) / 254.0, brightness: Double(brightness) / 254.0)
    }
}

struct HueConfig: Codable {
    let bridgeIp: String
    let apiKey: String
    let bulb1Id: String
    let bulb2Id: String
}

class HueController: ObservableObject {
    private var bridgeIP: String = ""
    private var apiKey: String = ""

    @Published var bulbs: [Bulb] = []
    @Published var configError: String?

    init() {
        loadConfig()
    }

    private func loadConfig() {
        // Look for config.json in parent directory (philips-hue project root)
        let configPaths = [
            FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("work/ai/philips-hue/config.json"),
            Bundle.main.bundleURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("config.json")
        ]

        for configURL in configPaths {
            if let data = try? Data(contentsOf: configURL),
               let config = try? JSONDecoder().decode(HueConfig.self, from: data) {
                bridgeIP = config.bridgeIp
                apiKey = config.apiKey
                bulbs = [
                    Bulb(id: config.bulb1Id, name: "Bulb 1"),
                    Bulb(id: config.bulb2Id, name: "Bulb 2")
                ]
                return
            }
        }

        configError = "config.json not found. Run 'npm run setup' in philips-hue directory."
    }

    private var baseURL: String {
        "http://\(bridgeIP)/api/\(apiKey)"
    }

    func refreshAll() async {
        for bulb in bulbs {
            await refreshBulb(bulb)
        }
    }

    func refreshBulb(_ bulb: Bulb) async {
        guard !bridgeIP.isEmpty else { return }
        guard let url = URL(string: "\(baseURL)/lights/\(bulb.id)") else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let state = json["state"] as? [String: Any],
               let name = json["name"] as? String {

                await MainActor.run {
                    bulb.name = name
                    bulb.isOn = state["on"] as? Bool ?? false
                    bulb.brightness = state["bri"] as? Int ?? 254
                    bulb.hue = state["hue"] as? Int ?? 0
                    bulb.saturation = state["sat"] as? Int ?? 254
                }
            }
        } catch {
            print("Error refreshing bulb \(bulb.id): \(error)")
        }
    }

    func setOn(bulb: Bulb, on: Bool) async {
        await sendState(bulb: bulb, state: ["on": on])
        await MainActor.run { bulb.isOn = on }
    }

    func setBrightness(bulb: Bulb, brightness: Int) async {
        await sendState(bulb: bulb, state: ["bri": brightness])
    }

    func setHue(bulb: Bulb, hue: Int) async {
        await sendState(bulb: bulb, state: ["hue": hue, "sat": 254, "on": true])
        await MainActor.run {
            bulb.saturation = 254
            bulb.isOn = true
        }
    }

    private func sendState(bulb: Bulb, state: [String: Any]) async {
        guard !bridgeIP.isEmpty else { return }
        guard let url = URL(string: "\(baseURL)/lights/\(bulb.id)/state") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: state)
            let (_, _) = try await URLSession.shared.data(for: request)
        } catch {
            print("Error setting state for bulb \(bulb.id): \(error)")
        }
    }
}
