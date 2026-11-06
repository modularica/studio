import Foundation
import UIKit
import GameKit
import Capacitor

/// Game Center for the game's web page: sign in, send a score, show the leaderboard.
/// JS side: Capacitor.registerPlugin('GameCenter') in apps/fish/uygulama.js.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise)
    ]

    /// Resolves { signedIn } once. If the player isn't signed in, iOS hands us its sign-in screen to show first.
    @objc func signIn(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(["signedIn": true])
            return
        }
        var answered = false
        DispatchQueue.main.async {
            player.authenticateHandler = { [weak self] viewController, error in
                if let viewController = viewController {
                    self?.bridge?.viewController?.present(viewController, animated: true)
                    return
                }
                if answered { return }
                answered = true
                var result: [String: Any] = ["signedIn": player.isAuthenticated]
                if let error = error { result["error"] = error.localizedDescription }
                call.resolve(result)
            }
        }
    }

    /// { leaderboardId, score } — score is an integer (Little Koi: length in mm).
    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["sent": false])
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["sent": true])
            }
        }
    }

    /// { leaderboardId } — opens Apple's leaderboard screen on top of the game.
    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let leaderboardId = call.getString("leaderboardId")
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else {
                call.resolve(["shown": false])
                return
            }
            let controller: GKGameCenterViewController
            if let leaderboardId = leaderboardId {
                controller = GKGameCenterViewController(leaderboardID: leaderboardId, playerScope: .global, timeScope: .allTime)
            } else {
                controller = GKGameCenterViewController(state: .leaderboards)
            }
            controller.gameCenterDelegate = self
            self.bridge?.viewController?.present(controller, animated: true)
            call.resolve(["shown": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
