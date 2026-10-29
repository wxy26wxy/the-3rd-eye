import SwiftUI

/// Layout for the non-flow tabs: headline + settings button, cream sheet below.
struct TabScreen<Content: View>: View {
  let title: LocalizedStringKey
  @ViewBuilder var content: Content
  @Environment(\.themeColors) private var colors

  var body: some View {
    ScrollView {
      VStack(spacing: 0) {
        HStack(alignment: .center) {
          DisplayText(title, role: .displayM, tilted: false)
          Spacer()
          SettingsButton()
        }
        .padding(.horizontal, Theme.Space.page)
        .padding(.vertical, Theme.Space.l)
        CreamSheet {
          VStack(alignment: .leading, spacing: Theme.Space.l) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
    .background(alignment: .bottom) {
      colors.surface.frame(height: Theme.Size.record * 4).ignoresSafeArea()
    }
    .screenBackground()
    .toolbar(.hidden, for: .navigationBar)
    .stopsSpeechOnDisappear()
  }
}

/// Opens SettingsView as a sheet.
struct SettingsButton: View {
  @State private var showing = false

  var body: some View {
    IconButton(systemName: "gearshape.fill", label: "Settings", hint: "Accessibility and account settings") { showing = true }
      .sheet(isPresented: $showing) { SettingsView() }
  }
}
