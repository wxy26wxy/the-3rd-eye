import SwiftUI

/// Sky creator-flow layout on the white page: a top row (44 pt Back when the screen has a back action,
/// else the logo mark), the headline and description and the content scroll; the actions are pinned
/// in the bottom `ActionBar` (T103 fix round 1). The old step pill is a VoiceOver hint on the headline.
struct FlowScreen<Content: View, Actions: View>: View {
  var title: LocalizedStringKey
  var subtitle: LocalizedStringKey?
  var step: (Int, Int)?
  var showsBack = true
  var trailing: AnyView?
  /// Actions in the pinned bottom bar (default). False for screens whose actions are a long list
  /// (Design detail): they then follow the content and scroll with it.
  var pinsActions = true
  @ViewBuilder var content: Content
  @ViewBuilder var actions: Actions
  @Environment(\.dismiss) private var dismiss
  @Environment(\.themeColors) private var colors

  var body: some View {
    let page = ScrollView {
      VStack(alignment: .leading, spacing: Theme.Space.xxl) {
        VStack(alignment: .leading, spacing: Theme.Space.l) {
          HStack {
            if showsBack {
              IconButton(asset: Tokens.Asset.iconChevronRight, label: "Back", hint: "Goes to the previous screen",
                         size: Theme.Size.minTarget, mirrored: true) { dismiss() }
            } else {
              LogoMark()
            }
            Spacer()
            if let trailing { trailing }
          }
          .frame(minHeight: Theme.Size.minTarget)
          DisplayText(title)
            .accessibilityHint(step.map { Text("Step \($0.0) of \($0.1)") } ?? Text(""))
          if let subtitle {
            Text(subtitle)
              .themeFont(.body)
              .foregroundStyle(colors.textMuted)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        content
        if !pinsActions {
          VStack(spacing: Theme.Space.s) { actions }
        }
      }
      .padding(.horizontal, Theme.Space.page)
      .padding(.top, Theme.Space.s)
      .padding(.bottom, Theme.Space.xxl)
      .frame(maxWidth: .infinity, alignment: .topLeading)
    }
    .scrollBounceBehavior(.basedOnSize)

    Group {
      if Actions.self == EmptyView.self || !pinsActions {
        page
      } else {
        page.actionBar { actions }
      }
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
  }
}

extension FlowScreen where Actions == EmptyView {
  init(title: LocalizedStringKey, subtitle: LocalizedStringKey? = nil, step: (Int, Int)? = nil, showsBack: Bool = true, @ViewBuilder content: () -> Content) {
    self.title = title
    self.subtitle = subtitle
    self.step = step
    self.showsBack = showsBack
    self.content = content()
    self.actions = EmptyView()
  }
}
