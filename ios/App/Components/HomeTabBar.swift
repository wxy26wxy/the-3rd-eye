import SwiftUI
import UIKit

/// Sky tab bar (Figma `Tab bar`), replacing the system TabView's bar: Create / My designs / Orders /
/// Messages, 56 pt tabs on white with a top border. The selected tab has an accent pill behind its
/// icon and a Semi Bold label (not colour alone); Orders and Messages carry an ink count badge.
///
/// Accessibility: the bar sits inside a `UITabBar` host (it draws nothing of its own) that exposes
/// exactly four elements, one per tab, as its direct children: label = tab name, button + selected
/// traits, value "n new" for a badge. UI tests keep finding `app.tabBars.buttons["My designs"]`.
/// Whether VoiceOver adds "tab, n of 4" for these elements is to be confirmed by ear on a device
/// (docs/accessibility.md).
struct HomeTabBar: View {
  @Binding var selection: HomeTab
  var ordersBadge: Int = 0
  var messagesBadge: Int = 0
  /// Tapping the tab that is already selected (the system bar pops that tab to its root).
  var reselect: (HomeTab) -> Void = { _ in }
  @Environment(\.themeColors) private var colors

  /// Tabs in order, with their visible names (also the VoiceOver labels and UI-test identifiers).
  static let tabs: [(tab: HomeTab, title: LocalizedStringResource, symbol: String)] = [
    (.create, "Create", "plus.circle"),
    (.designs, "My designs", "square.grid.2x2"),
    (.orders, "Orders", "shippingbox"),
    (.messages, "Messages", "bubble.left"),
  ]

  var body: some View {
    TabBarHost(items: Self.tabs.map { entry in
      let badge = entry.tab == .orders ? ordersBadge : (entry.tab == .messages ? messagesBadge : 0)
      return HostTabBar.Item(label: String(localized: entry.title), selected: selection == entry.tab,
                             value: badge > 0 ? String(localized: "\(badge) new") : nil)
    }, activate: { index in choose(Self.tabs[index].tab) }) {
      HomeTabBarContent(selection: $selection, ordersBadge: ordersBadge, messagesBadge: messagesBadge, choose: choose)
        .environment(\.themeColors, colors)
    }
    .frame(height: ThemeEffects.tabHeight + ThemeEffects.tabTopPadding)
    .background {
      colors.surface
        .overlay(alignment: .top) { colors.border.frame(height: Theme.Border.thin) }
        .ignoresSafeArea(edges: .bottom)
    }
  }

  private func choose(_ tab: HomeTab) {
    if selection == tab { reselect(tab) } else { selection = tab }
  }
}

/// The drawn bar. Hidden from accessibility: `HostTabBar` exposes one element per tab instead.
private struct HomeTabBarContent: View {
  @Binding var selection: HomeTab
  var ordersBadge: Int
  var messagesBadge: Int
  var choose: (HomeTab) -> Void
  @Environment(\.themeColors) private var colors

  var body: some View {
    HStack(spacing: 0) {
      ForEach(HomeTabBar.tabs, id: \.tab) { entry in
        let badge = entry.tab == .orders ? ordersBadge : (entry.tab == .messages ? messagesBadge : 0)
        item(entry.tab, Text(entry.title), symbol: entry.symbol, badge: badge)
      }
    }
    .padding(.horizontal, Theme.Space.xs)
    .padding(.top, ThemeEffects.tabTopPadding)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }

  private func item(_ tab: HomeTab, _ label: Text, symbol: String, badge: Int) -> some View {
    let selected = selection == tab
    return VStack(spacing: Theme.Border.icon) {
      Image(systemName: symbol)
        .resizable()
        .scaledToFit()
        .frame(width: ThemeEffects.tabIcon, height: ThemeEffects.tabIcon)
        .foregroundStyle(selected ? colors.accentInk : colors.textMuted)
        .accessibilityHidden(true)
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
      label
        .themeFont(.caption)
        .fontWeight(selected ? TextRole.titleM.weight : TextRole.caption.weight)
        .foregroundStyle(selected ? colors.text : colors.textMuted)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, minHeight: ThemeEffects.tabHeight)
    .contentShape(Rectangle())
    .onTapGesture { choose(tab) }
    .accessibilityShowsLargeContentViewer { Image(systemName: symbol); label }
    .accessibilityHidden(true)
  }
}

/// Hosts SwiftUI content inside a `UITabBar` whose own drawing (background, glass platter) is hidden,
/// so assistive technologies and UI tests see a tab bar while the Sky bar is what shows.
private struct TabBarHost<Content: View>: UIViewRepresentable {
  let items: [HostTabBar.Item]
  let activate: (Int) -> Void
  @ViewBuilder var content: Content

  func makeUIView(context: Context) -> HostTabBar {
    let host = UIHostingController(rootView: content)
    host.view.backgroundColor = .clear
    host.safeAreaRegions = []
    context.coordinator.host = host
    let bar = HostTabBar(hosted: host.view, height: ThemeEffects.tabHeight + ThemeEffects.tabTopPadding,
                         inset: Theme.Space.xs)
    bar.update(items: items, activate: activate)
    return bar
  }

  func updateUIView(_ bar: HostTabBar, context: Context) {
    context.coordinator.host?.rootView = content
    bar.update(items: items, activate: activate)
  }

  func makeCoordinator() -> Coordinator { Coordinator() }

  final class Coordinator {
    var host: UIHostingController<Content>?
  }
}

final class HostTabBar: UITabBar {
  /// What VoiceOver and UI tests get for one tab.
  struct Item: Equatable {
    var label: String
    var selected: Bool
    var value: String?
  }

  private let hosted: UIView
  private let height: CGFloat
  /// Horizontal padding of the drawn row (the tabs share the rest equally).
  private let inset: CGFloat
  private var tabElements: [TabElement] = []
  private var activate: (Int) -> Void = { _ in }

  init(hosted: UIView, height: CGFloat, inset: CGFloat) {
    self.hosted = hosted
    self.height = height
    self.inset = inset
    super.init(frame: .zero)
    accessibilityTraits = .tabBar
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
    // Only change what differs, so a layout pass never asks for another one.
    for view in subviews where view !== hosted && !view.isHidden { view.isHidden = true }
    if subviews.last !== hosted { bringSubviewToFront(hosted) }
    // UITabBar keeps its own (taller) height around the slot SwiftUI gives it; the Sky bar fills
    // exactly the slot, centred like the bar itself.
    let frame = bounds.insetBy(dx: 0, dy: max(0, (bounds.height - height) / 2))
    if hosted.frame != frame { hosted.frame = frame }
    layoutTabElements()
  }

  override func sizeThatFits(_ size: CGSize) -> CGSize { CGSize(width: size.width, height: height) }

  /// Touches outside the drawn bar go to the screen behind it.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard hosted.frame.contains(point) else { return nil }
    return super.hitTest(point, with: event)
  }

  /// One accessibility element per tab, direct children of the tab bar (no SwiftUI containers in
  /// between): label = tab name, button + selected traits, value "n new" for a badge, frame = the tab.
  func update(items: [Item], activate: @escaping (Int) -> Void) {
    self.activate = activate
    if tabElements.count != items.count {
      tabElements = items.indices.map { index in
        TabElement(container: self) { [weak self] in self?.activate(index) }
      }
    }
    for (element, item) in zip(tabElements, items) {
      let traits: UIAccessibilityTraits = item.selected ? [.button, .selected] : .button
      if element.accessibilityLabel != item.label { element.accessibilityLabel = item.label }
      if element.accessibilityIdentifier != item.label { element.accessibilityIdentifier = item.label }
      if element.accessibilityValue != item.value { element.accessibilityValue = item.value }
      if element.accessibilityTraits != traits { element.accessibilityTraits = traits }
    }
    layoutTabElements()
  }

  private func layoutTabElements() {
    guard !tabElements.isEmpty else { return }
    let row = hosted.frame.insetBy(dx: inset, dy: 0)
    let width = row.width / CGFloat(tabElements.count)
    for (index, element) in tabElements.enumerated() {
      let frame = CGRect(x: row.minX + width * CGFloat(index), y: row.minY, width: width, height: row.height)
      if element.accessibilityFrameInContainerSpace != frame { element.accessibilityFrameInContainerSpace = frame }
    }
  }

  override var accessibilityElements: [Any]? {
    get { tabElements }
    set {}
  }

  private final class TabElement: UIAccessibilityElement {
    private let onActivate: () -> Void

    init(container: Any, onActivate: @escaping () -> Void) {
      self.onActivate = onActivate
      super.init(accessibilityContainer: container)
    }

    override func accessibilityActivate() -> Bool {
      onActivate()
      return true
    }
  }
}
