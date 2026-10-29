import SwiftUI

/// Buyer conversations, one per order (messages live on the order).
struct MessagesView: View {
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors

  private var threads: [OrderSummary] {
    app.orders.orders.sorted { ($0.unreadMessages ?? 0) > ($1.unreadMessages ?? 0) }
  }

  var body: some View {
    TabScreen(title: "Messages") {
      if threads.isEmpty {
        Text("When buyers send you a note, it shows up here.")
          .themeFont(.bodyL)
          .foregroundStyle(colors.text)
      } else {
        ForEach(threads) { order in
          NavigationLink(value: OrderRoute.detail(order.id)) {
            OrderRow(order: order)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .task { if !app.orders.loaded { await app.orders.refresh() } }
    .refreshable { await app.orders.refresh() }
  }
}
