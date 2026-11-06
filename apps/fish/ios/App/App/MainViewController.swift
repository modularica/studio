import UIKit
import Capacitor

/// The app's web view. SceneDelegate creates it (Main.storyboard names it too, but the scene doesn't load the storyboard).
/// Registers plugins that live in this app rather than in a package.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
