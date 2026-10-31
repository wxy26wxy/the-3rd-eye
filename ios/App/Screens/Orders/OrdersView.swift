import SwiftUI

/// Orders inbox, refreshed by OrdersStore polling every 10 s.
struct OrdersView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  var body: some View {
    TabScreen(title: "Orders") {
      if let error = app.orders.lastError, app.orders.orders.isEmpty {
        ErrorCard(message: error) { Task { await app.orders.refresh() } }
      } else if !app.orders.loaded {
        // Board `2017:1548`: the spinner with the words under it.
        VStack(spacing: Theme.Space.l) {
          ProgressView().controlSize(.large).tint(colors.text)
          Text("Loading orders").themeFont(.body).foregroundStyle(colors.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Theme.Space.section)
        .accessibilityElement(children: .combine)
      } else if app.orders.orders.isEmpty {
        Text("No orders yet. We'll check every few seconds and show them here.")
          .themeFont(.bodyL)
          .foregroundStyle(colors.text)
      } else {
        ForEach(app.orders.orders) { order in
          NavigationLink(value: OrderRoute.detail(order.id)) {
            OrderRow(order: order)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .task { await app.orders.refresh() }
    .refreshable { await app.orders.refresh() }
  }
}

struct OrderRow: View {
  let order: OrderSummary
  @Environment(\.themeColors) private var colors
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    Card(padding: Theme.Space.m) {
      HStack(spacing: Theme.Space.m) {
        // The thumbnail gives its width to the words at accessibility sizes.
        if !dynamicTypeSize.isAccessibilitySize {
          RemoteImage(url: order.mockupUrl.flatMap(URL.init(string:)), altText: order.productTitle)
            .padding(Theme.Space.xs)
            .frame(width: Theme.Size.cta, height: Theme.Size.cta)
            .background(RoundedRectangle(cornerRadius: ThemeEffects.thumbRadius, style: .continuous).fill(colors.surfaceAlt))
            .clipShape(RoundedRectangle(cornerRadius: ThemeEffects.thumbRadius, style: .continuous))
            .accessibilityHidden(true)
        }
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text(order.productTitle ?? String(localized: "Your product")).themeFont(.titleL).foregroundStyle(colors.text)
          Text("Bought by \(order.buyerName ?? String(localized: "a buyer"))").themeFont(.bodyS).foregroundStyle(colors.textMuted)
          Text("You earn \(Money.format(cents: order.creatorShareCents ?? 0))").themeFont(.body).foregroundStyle(colors.text)
          if order.hasThankYou == false {
            Text("SAY THANK YOU")
              .themeFont(.eyebrow)
              .fixedSize(horizontal: false, vertical: true)
              .foregroundStyle(colors.accentInk)
              .padding(.horizontal, Theme.Space.s)
              .padding(.vertical, Theme.Space.xs)
              .background(Capsule().fill(colors.accent))
          }
        }
        Spacer(minLength: 0)
        if let unread = order.unreadMessages, unread > 0 {
          Text("\(unread)")
            .themeFont(.caption)
            .foregroundStyle(colors.primaryText)
            .frame(minWidth: ThemeEffects.badgeSize, minHeight: ThemeEffects.badgeSize)
            .background(Circle().fill(colors.primary))
            .accessibilityLabel(Text("\(unread) new messages"))
        }
        Image(systemName: "chevron.right").foregroundStyle(colors.text).accessibilityHidden(true)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityHint(Text("Opens the order"))
  }
}
