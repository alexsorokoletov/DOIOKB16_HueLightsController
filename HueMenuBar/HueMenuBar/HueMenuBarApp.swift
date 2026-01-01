import SwiftUI

@main
struct HueMenuBarApp: App {
    @StateObject private var hueController = HueController()

    var body: some Scene {
        MenuBarExtra("Hue", systemImage: "lightbulb.fill") {
            MenuContentView(controller: hueController)
        }
        .menuBarExtraStyle(.window)
    }
}

struct MenuContentView: View {
    @ObservedObject var controller: HueController

    var body: some View {
        VStack(spacing: 16) {
            ForEach(controller.bulbs) { bulb in
                BulbControlView(bulb: bulb, controller: controller)
            }

            Divider()

            HStack {
                Button("Refresh") {
                    Task { await controller.refreshAll() }
                }
                Spacer()
                Button("Quit") {
                    NSApplication.shared.terminate(nil)
                }
            }
        }
        .padding()
        .frame(width: 280)
        .task {
            await controller.refreshAll()
        }
    }
}

struct BulbControlView: View {
    @ObservedObject var bulb: Bulb
    @ObservedObject var controller: HueController

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(bulb.currentColor)
                    .frame(width: 12, height: 12)
                Text(bulb.name)
                    .font(.headline)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { bulb.isOn },
                    set: { newValue in
                        Task { await controller.setOn(bulb: bulb, on: newValue) }
                    }
                ))
                .toggleStyle(.switch)
                .labelsHidden()
            }

            if bulb.isOn {
                VStack(spacing: 6) {
                    HStack {
                        Image(systemName: "sun.min")
                            .foregroundColor(.secondary)
                        Slider(value: Binding(
                            get: { Double(bulb.brightness) },
                            set: { newValue in
                                bulb.brightness = Int(newValue)
                            }
                        ), in: 1...254, step: 1) { editing in
                            if !editing {
                                Task { await controller.setBrightness(bulb: bulb, brightness: bulb.brightness) }
                            }
                        }
                        Image(systemName: "sun.max")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Image(systemName: "paintpalette")
                            .foregroundColor(.secondary)
                        Slider(value: Binding(
                            get: { Double(bulb.hue) },
                            set: { newValue in
                                bulb.hue = Int(newValue)
                            }
                        ), in: 0...65535, step: 100) { editing in
                            if !editing {
                                Task { await controller.setHue(bulb: bulb, hue: bulb.hue) }
                            }
                        }
                        .tint(bulb.currentColor)
                        Circle()
                            .fill(bulb.currentColor)
                            .frame(width: 16, height: 16)
                    }
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.controlBackgroundColor)))
    }
}
