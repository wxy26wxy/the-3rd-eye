import SwiftUI

/// Sky creator-flow layout on the white page: a top row (44 pt Back when the screen has a back action,
/// else the logo mark), the headline and description, the content, then the actions at the bottom.
/// Short screens pin the actions to the bottom edge; tall screens scroll and the actions follow the
/// content (Figma B1 review: no pinned bar yet). The old step pill is a VoiceOver hint on the headline.
struct FlowScreen<Content: View, Actions: View>: View {
  var title: LocalizedStringKey
  var subtitle: LocalizedStringKey?
  var step: (Int, Int)?
  var showsBack = true
  var trailing: AnyView?
  @ViewBuilder var content: Content
  @ViewBuilder var actions: Actions
  @Environment(\.dismiss) private var dismiss
  @Environment(\.themeColors) private var colors

  var body: some View {
    GeometryReader { proxy in
      ScrollView {
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
          Spacer(minLength: 0)
          VStack(spacing: Theme.Space.s) { actions }
        }
        .padding(.horizontal, Theme.Space.page)
        .padding(.top, Theme.Space.s)
        .padding(.bottom, Theme.Space.l)
        .frame(maxWidth: .infinity, minHeight: proxy.size.height, alignment: .topLeading)
      }
      .scrollBounceBehavior(.basedOnSize)
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
