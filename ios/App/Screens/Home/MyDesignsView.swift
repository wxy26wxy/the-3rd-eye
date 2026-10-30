import SwiftUI

/// Grid of saved designs with a status badge each; tap opens the design, long press offers
/// "Make a sticker" and "Delete".
struct MyDesignsView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var deleting: Artwork?

  private let columns = [GridItem(.adaptive(minimum: ThemeEffects.gridMinimum), spacing: Theme.Space.l)]

  private var store: DesignsStore { app.designs }

  var body: some View {
    TabScreen(title: "My designs") {
      if !store.loaded && store.artworks.isEmpty && store.error == nil {
        ProgressView().tint(colors.text).frame(maxWidth: .infinity).accessibilityLabel(Text("Loading your designs"))
      } else if let error = store.error, store.artworks.isEmpty {
        ErrorCard(message: error) { Task { await store.load() } }
      } else if store.artworks.isEmpty {
        Text("No designs yet. Make one in Create.").themeFont(.bodyL).foregroundStyle(colors.text)
        PillButton("Start creating") { app.startNewCreation() }
      } else {
        LazyVGrid(columns: columns, spacing: Theme.Space.l) {
          ForEach(store.artworks) { artwork in
            DesignTile(artwork: artwork) { app.designsPath.append(.detail(artwork.id)) }
              .contextMenu {
                if artwork.isReadyForProducts {
                  Button { app.continueFrom(artwork: artwork, productType: .sticker) } label: {
                    Label("Make a sticker", systemImage: "seal")
                  }
                }
                Button(role: .destructive) { deleting = artwork } label: {
                  Label("Delete", systemImage: "trash")
                }
              }
          }
        }
        if let error = store.error { ErrorCard(message: error) }
      }
    }
    .task { await store.load() }
    .refreshable { await store.load() }
    .deleteDesignConfirmation(item: $deleting) { artwork in
      do {
        try await store.delete(id: artwork.id)
        UIAccessibility.post(notification: .announcement, argument: String(localized: "Design deleted"))
      } catch {
        if !APIError.isCancellation(error) { store.error = error.localizedDescription }
      }
    }
  }
}

/// One design: picture (or its state when there is none yet) and the status badge.
private struct DesignTile: View {
  let artwork: Artwork
  let open: () -> Void
  @Environment(\.themeColors) private var colors

  var body: some View {
    let badge = DesignBadge.of(artwork)
    Button(action: open) {
      VStack(spacing: Theme.Space.xs) {
        DesignPicture(artwork: artwork, badge: badge)
        DesignBadgeView(badge: badge)
      }
      .padding(Theme.Space.xs)
      .frame(maxWidth: .infinity, minHeight: Theme.Size.iconButton)
      .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surfaceAlt))
      .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
      .contentShape(RoundedRectangle(cornerRadius: Theme.Radius.m))
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(verbatim: "\(artwork.altText ?? String(localized: "Design")), \(badge.text)"))
    .accessibilityHint(Text("Opens the design. Long press for more."))
    .accessibilityAddTraits(.isButton)
  }
}

/// The cut-out, or a still picture of the state when there is no image (a spinner only while cutting).
struct DesignPicture: View {
  let artwork: Artwork
  let badge: DesignBadge
  @Environment(\.themeColors) private var colors

  var body: some View {
    if let url = artwork.displayURL {
      RemoteImage(url: url, altText: artwork.altText)
    } else {
      ZStack {
        RoundedRectangle(cornerRadius: Theme.Radius.m).fill(colors.surface)
        if badge == .cuttingOut {
          ProgressView().tint(colors.text)
        } else {
          Image(systemName: badge.symbol).font(TextRole.displayM.font).foregroundStyle(colors.textMuted)
        }
      }
      .aspectRatio(1, contentMode: .fit)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(badge.title))
    }
  }
}

/// Capsule with the state's symbol and words.
struct DesignBadgeView: View {
  let badge: DesignBadge
  @Environment(\.themeColors) private var colors

  var body: some View {
    let strong = badge == .inShop
    let warning = badge == .failed
    Label {
      Text(badge.title).themeFont(.caption)
    } icon: {
      Image(systemName: badge.symbol).accessibilityHidden(true)
    }
    .foregroundStyle(strong ? colors.primaryText : (warning ? colors.danger : colors.text))
    .padding(.horizontal, Theme.Space.s)
    .padding(.vertical, Theme.Space.xs)
    .background(Capsule().fill(strong ? colors.primary : colors.surface))
    .overlay(Capsule().stroke(warning ? colors.danger : colors.border, lineWidth: Theme.Border.thin))
    .accessibilityElement(children: .combine)
  }
}

extension View {
  /// "Delete this design?" with a destructive confirm; `perform` runs the delete.
  func deleteDesignConfirmation(item: Binding<Artwork?>, perform: @escaping @MainActor (Artwork) async -> Void) -> some View {
    confirmationDialog(
      Text("Delete this design?"),
      isPresented: Binding(get: { item.wrappedValue != nil }, set: { if !$0 { item.wrappedValue = nil } }),
      titleVisibility: .visible,
      presenting: item.wrappedValue
    ) { artwork in
      Button("Delete design", role: .destructive) { Task { await perform(artwork) } }
      Button("Cancel", role: .cancel) {}
    } message: { _ in
      Text("It leaves My designs, and its products leave the shop. Orders already placed keep working.")
    }
  }
}
