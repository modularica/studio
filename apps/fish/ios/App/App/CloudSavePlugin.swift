import Foundation
import Capacitor

/// A second and third copy of the game's save, kept outside the web view's storage:
/// - iCloud key-value storage: the same Apple account's iPhone and iPad share it, and it survives deleting the app.
/// - UserDefaults: survives iOS clearing the web view's storage when the device runs low on space.
/// The save is one JSON string; apps/fish/uygulama.js decides what goes in it and how copies are merged.
@objc(CloudSavePlugin)
public class CloudSavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudSavePlugin"
    public let jsName = "CloudSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]
    private let key = "koi.kayit"

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(cloudChanged(_:)),
                                               name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                               object: NSUbiquitousKeyValueStore.default)
        NSUbiquitousKeyValueStore.default.synchronize()
    }

    /// Another device saved (or iCloud finished downloading this account's save): tell the page.
    @objc private func cloudChanged(_ note: Notification) {
        var data: [String: Any] = [:]
        if let s = NSUbiquitousKeyValueStore.default.string(forKey: key) { data["cloud"] = s }
        notifyListeners("change", data: data)
    }

    /// Resolves { cloud?, device? }: whichever copies exist.
    @objc func get(_ call: CAPPluginCall) {
        var result: [String: Any] = [:]
        if let s = NSUbiquitousKeyValueStore.default.string(forKey: key) { result["cloud"] = s }
        if let s = UserDefaults.standard.string(forKey: key) { result["device"] = s }
        call.resolve(result)
    }

    /// { data }: writes both copies. iCloud uploads on its own schedule; works offline and without iCloud too.
    @objc func set(_ call: CAPPluginCall) {
        guard let data = call.getString("data") else {
            call.reject("data is required")
            return
        }
        UserDefaults.standard.set(data, forKey: key)
        NSUbiquitousKeyValueStore.default.set(data, forKey: key)
        NSUbiquitousKeyValueStore.default.synchronize()
        call.resolve()
    }
}
