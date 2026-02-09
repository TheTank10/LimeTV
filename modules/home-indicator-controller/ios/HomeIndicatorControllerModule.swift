import ExpoModulesCore
import UIKit

public class HomeIndicatorControllerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HomeIndicatorController")
    
    // Function to set whether the home indicator should auto-hide
    Function("setAutoHidden") { (autoHidden: Bool) in
      DispatchQueue.main.async {
        self.setHomeIndicatorAutoHidden(autoHidden)
      }
    }
  }
  
  private func setHomeIndicatorAutoHidden(_ autoHidden: Bool) {
    guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
          let window = windowScene.windows.first,
          let rootViewController = window.rootViewController else {
      return
    }
    
    // Find the top-most presented view controller
    var topController = rootViewController
    while let presented = topController.presentedViewController {
      topController = presented
    }
    
    // Store the auto-hide preference
    objc_setAssociatedObject(
      topController,
      &AssociatedKeys.autoHideHomeIndicator,
      autoHidden,
      .OBJC_ASSOCIATION_RETAIN_NONATOMIC
    )
    
    // Trigger the update
    topController.setNeedsUpdateOfHomeIndicatorAutoHidden()
  }
}

// Associated object key for storing the auto-hide state
private struct AssociatedKeys {
  static var autoHideHomeIndicator = "autoHideHomeIndicator"
}

// Extension to swizzle prefersHomeIndicatorAutoHidden
extension UIViewController {
  @objc open override func prefersHomeIndicatorAutoHidden() -> Bool {
    // Check if we have a stored preference
    if let autoHide = objc_getAssociatedObject(self, &AssociatedKeys.autoHideHomeIndicator) as? Bool {
      return autoHide
    }
    // Fall back to default behavior
    return false
  }
}