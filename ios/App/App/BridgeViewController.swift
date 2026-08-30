import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {

    override var prefersStatusBarHidden: Bool {
        return false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .darkContent
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(InAppPurchasePlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.insetsLayoutMarginsFromSafeArea = false
        setNeedsStatusBarAppearanceUpdate()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.frame = view.bounds
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}
