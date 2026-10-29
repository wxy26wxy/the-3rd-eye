import SwiftUI

/// Standard creator-flow layout: green header (back, step pill, headline),
/// then a scalloped cream sheet holding the content and the actions.
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
    ScrollView {
      VStack(spacing: 0) {
        VStack(spacing: Theme.Space.l) {
          HStack {
            if showsBack {
              IconButton(systemName: "chevron.left", label: "Back", hint: "Goes to the previous screen") { dismiss() }
            }
            Spacer()
            if let step { StepPill(step: step.0, total: step.1) }
            Spacer()
            if let trailing { trailing } else if showsBack {
              Color.clear.frame(width: Theme.Size.iconButton, height: Theme.Size.iconButton).accessibilityHidden(true)
            }
          }
          DisplayText(title, role: .displayL)
          if let subtitle {
            Text(subtitle)
              .themeFont(.bodyL)
              .foregroundStyle(colors.textOnDark)
              .multilineTextAlignment(.center)
          }
        }
        .padding(.horizontal, Theme.Space.page)
        .padding(.top, Theme.Space.s)
        .padding(.bottom, Theme.Space.xl)

        CreamSheet {
          VStack(spacing: Theme.Space.xl) {
            content
            VStack(spacing: Theme.Space.l) { actions }
              .padding(.top, Theme.Space.s)
          }
        }
      }
    }
    .scrollBounceBehavior(.basedOnSize)
    .background(alignment: .bottom) {
      colors.surface.frame(height: Theme.Size.record * 4).ignoresSafeArea()
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
    .stopsSpeechOnDisappear()
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
