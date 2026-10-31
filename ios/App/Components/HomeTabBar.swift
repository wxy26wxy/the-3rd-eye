import SwiftUI
import UIKit

/// Sky tab bar (Figma `Tab bar`), replacing the system TabView's bar: Create / My designs / Orders /
/// Messages, 56 pt tabs on white with a top border. The selected tab has an accent pill behind its
/// icon and a Semi Bold label (not colour alone); Orders and Messages carry an ink count badge.
///
/// Accessibility: the bar sits inside a `UITabBar` host (it draws nothing of its own), so VoiceOver
/// treats it as a tab bar and UI tests keep finding `app.tabBars.buttons["My designs"]`. Each tab is
/// one button element with the selected trait and "n new" as its value. Labels stay "Create",
/// "My designs", "Orders", "Messages".
struct HomeTabBar: View {
  @Binding var selection: HomeTab
  var ordersBadge: Int = 0
  var messagesBadge: Int = 0
  @Environment(\.themeColors) private var colors

  var body: some View {
    TabBarHost {
      HomeTabBarContent(selection: $selection, ordersBadge: ordersBadge, messagesBadge: messagesBadge)
        .environment(\.themeColors, colors)
    }
    .frame(height: ThemeEffects.tabHeight + ThemeEffects.tabTopPadding)
    .background {
      colors.surface
        .overlay(alignment: .top) { colors.border.frame(height: Theme.Border.thin) }
        .ignoresSafeArea(edges: .bottom)
    }
  }
}

/// The drawn bar.
private struct HomeTabBarContent: View {
  @Binding var selection: HomeTab
  var ordersBadge: Int
  var messagesBadge: Int
  @Environment(\.themeColors) private var colors

  var body: some View {
    HStack(spacing: 0) {
      item(.create, "Create", symbol: "plus.circle", badge: 0)
      item(.designs, "My designs", symbol: "square.grid.2x2", badge: 0)
      item(.orders, "Orders", symbol: "shippingbox", badge: ordersBadge)
      item(.messages, "Messages", symbol: "bubble.left", badge: messagesBadge)
    }
    .padding(.horizontal, Theme.Space.xs)
    .padding(.top, ThemeEffects.tabTopPadding)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }

  private func item(_ tab: HomeTab, _ label: LocalizedStringKey, symbol: String, badge: Int) -> some View {
    let selected = selection == tab
    return VStack(spacing: Theme.Border.icon) {
      Image(systemName: symbol)
        .resizable()
        .scaledToFit()
        .frame(width: ThemeEffects.tabIcon, height: ThemeEffects.tabIcon)
        .foregroundStyle(selected ? colors.accentInk : colors.textMuted)
        .frame(width: ThemeEffects.tabPill.width, height: ThemeEffects.tabPill.height)
        .background(Capsule().fill(selected ? colors.accent : .clear))
        .overlay(alignment: .topTrailing) {
          if badge > 0 {
            Text(verbatim: "\(badge)")
              .themeFont(.caption)
              .monospacedDigit()
              .foregroundStyle(colors.primaryText)
              .lineLimit(1)
              .minimumScaleFactor(0.5)
              .padding(.horizontal, Theme.Border.icon * 2)
              .frame(minWidth: ThemeEffects.tabBadge, minHeight: ThemeEffects.tabBadge)
              .background(Capsule().fill(colors.primary))
              .offset(x: -Theme.Border.icon * 2, y: -Theme.Border.icon * 2)
          }
        }
      Text(label)
        .themeFont(.caption)
        .fontWeight(selected ? TextRole.titleM.weight : TextRole.caption.weight)
        .foregroundStyle(selected ? colors.text : colors.textMuted)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, minHeight: ThemeEffects.tabHeight)
    .contentShape(Rectangle())
    .onTapGesture { selection = tab }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(label))
    .accessibilityValue(badge > 0 ? Text("\(badge) new") : Text(""))
    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    .accessibilityAction { selection = tab }
  }
}

/// Hosts SwiftUI content inside a `UITabBar` whose own drawing (background, glass platter) is hidden,
/// so assistive technologies and UI tests see a tab bar while the Sky bar is what shows.
private struct TabBarHost<Content: View>: UIViewRepresentable {
  @ViewBuilder var content: Content

  func makeUIView(context: Context) -> HostTabBar {
    let host = UIHostingController(rootView: content)
    host.view.backgroundColor = .clear
    host.safeAreaRegions = []
    context.coordinator.host = host
    return HostTabBar(hosted: host.view, height: ThemeEffects.tabHeight + ThemeEffects.tabTopPadding)
  }

  func updateUIView(_ bar: HostTabBar, context: Context) {
    context.coordinator.host?.rootView = content
  }

  func makeCoordinator() -> Coordinator { Coordinator() }

  final class Coordinator {
    var host: UIHostingController<Content>?
  }
}

final class HostTabBar: UITabBar {
  private let hosted: UIView
  private let height: CGFloat

  init(hosted: UIView, height: CGFloat) {
    self.hosted = hosted
    self.height = height
    super.init(frame: .zero)
    let appearance = UITabBarAppearance()
    appearance.configureWithTransparentBackground()
    standardAppearance = appearance
    scrollEdgeAppearance = appearance
    addSubview(hosted)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

  override func layoutSubviews() {
    super.layoutSubviews()
    for view in subviews where view !== hosted { view.isHidden = true }
    bringSubviewToFront(hosted)
    // UITabBar keeps its own (taller) height around the slot SwiftUI gives it; the Sky bar fills
    // exactly the slot, centred like the bar itself.
    hosted.frame = bounds.insetBy(dx: 0, dy: max(0, (bounds.height - height) / 2))
  }

  override func sizeThatFits(_ size: CGSize) -> CGSize { CGSize(width: size.width, height: height) }

  /// Touches outside the drawn bar go to the screen behind it.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard hosted.frame.contains(point) else { return nil }
    return super.hitTest(point, with: event)
  }

  override var accessibilityElements: [Any]? {
    get { [hosted] }
    set {}
  }
}
