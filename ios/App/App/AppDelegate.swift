import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UIScrollViewDelegate {

    var window: UIWindow?
    private var scrollDelegateConfigured = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.configureWebViewScrollBehavior()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        configureWebViewScrollBehavior()
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func configureWebViewScrollBehavior() {
        guard let rootVC = window?.rootViewController as? CAPBridgeViewController,
              let wv = rootVC.webView else { return }
        wv.scrollView.alwaysBounceHorizontal = false
        wv.scrollView.showsHorizontalScrollIndicator = false
        wv.scrollView.isDirectionalLockEnabled = true
        if wv.scrollView.contentOffset.x != 0 {
            wv.scrollView.contentOffset.x = 0
        }
        if !scrollDelegateConfigured {
            wv.scrollView.delegate = self
            scrollDelegateConfigured = true
        }
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        if scrollView.contentOffset.x != 0 {
            scrollView.contentOffset.x = 0
        }
    }

}
