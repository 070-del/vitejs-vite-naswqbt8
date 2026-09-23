import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {

    override var prefersStatusBarHidden: Bool {
        return false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .darkContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.insetsLayoutMarginsFromSafeArea = false
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        setNeedsStatusBarAppearanceUpdate()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.frame = view.bounds
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
    }
}
