import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  
  var secureView: UIVisualEffectView?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    
    NotificationCenter.default.addObserver(self, selector: #selector(appWillResignActive), name: UIApplication.willResignActiveNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  @objc func appWillResignActive() {
    if let window = self.window {
        let blurEffect = UIBlurEffect(style: .dark)
        secureView = UIVisualEffectView(effect: blurEffect)
        secureView?.frame = window.bounds
        window.addSubview(secureView!)
    }
  }

  @objc func appDidBecomeActive() {
    secureView?.removeFromSuperview()
  }
}
