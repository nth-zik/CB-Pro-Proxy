import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  private let launchUrlKey = "cbvproxy.launchUrl"
  private let launchUrlEnvKey = "CBVPROXY_URL"
  private let launchUrlEnvB64Key = "CBVPROXY_URL_B64"

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    cacheLaunchUrlFromLaunchContext()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  private func cacheLaunchUrlFromLaunchContext() {
    if let urlString = extractLaunchUrl() {
      UserDefaults.standard.set(urlString, forKey: launchUrlKey)
    }
  }

  private func extractLaunchUrl() -> String? {
    let args = ProcessInfo.processInfo.arguments
    if let urlString = args.first(where: { $0.lowercased().hasPrefix("cbvproxy://") }) {
      return urlString
    }

    let env = ProcessInfo.processInfo.environment
    if let rawUrl = env[launchUrlEnvKey], rawUrl.lowercased().hasPrefix("cbvproxy://") {
      return rawUrl
    }

    if let encoded = env[launchUrlEnvB64Key],
       let data = Data(base64Encoded: encoded),
       let decoded = String(data: data, encoding: .utf8),
       decoded.lowercased().hasPrefix("cbvproxy://") {
      return decoded
    }

    return nil
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
