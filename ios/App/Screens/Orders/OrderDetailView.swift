import SwiftUI

struct OrderDetailView: View {
  let orderId: String
  @Environment(AppState.self) private var app
  @Environment(\.themeColors) private var colors
  @State private var detail: OrderDetailResponse?
  @State private var reply = ""
  @State private var sending = false
  @State private var error: String?

  var body: some View {
    FlowScreen(title: "Order") {
      VStack(alignment: .leading, spacing: Theme.Space.l) {
        if let detail {
          summary(detail.order)
          thankYouSection(detail)
          messagesSection(detail.messages ?? [])
        } else if error == nil {
          // Board `2028:3337`: the spinner with the words under it.
          VStack(spacing: Theme.Space.l) {
            ProgressView().controlSize(.large).tint(colors.text)
            Text("Loading order").themeFont(.body).foregroundStyle(colors.textMuted)
          }
          .frame(maxWidth: .infinity)
          .padding(.top, Theme.Space.section)
          .accessibilityElement(children: .combine)
        }
        if let error { ErrorCard(message: error) { Task { await load() } } }
      }
    }
    .task { await load() }
  }

  private func summary(_ order: Order) -> some View {
    Card {
      VStack(alignment: .leading, spacing: Theme.Space.s) {
        RemoteImage(url: order.mockupUrl.flatMap(URL.init(string:)), altText: order.productTitle)
          .padding(Theme.Space.l)
          .frame(maxWidth: .infinity, maxHeight: ThemeEffects.mockupMaxHeight)
          .background(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous).fill(colors.surfaceAlt))
        if let title = order.productTitle {
          Text(verbatim: title).themeFont(.titleL).foregroundStyle(colors.text)
        }
        Text("Bought by \(order.buyerName ?? String(localized: "a buyer"))").themeFont(.titleM).foregroundStyle(colors.text)
        Text("You earn \(Money.format(cents: order.creatorShareCents ?? 0))").themeFont(.bodyL).foregroundStyle(colors.text)
        if let status = order.status {
          Text("Status: \(status.capitalized)").themeFont(.bodyS).foregroundStyle(colors.textMuted)
        }
        if let note = order.shipNote, !note.isEmpty {
          Text("Note from the buyer: \(note)").themeFont(.bodyS).foregroundStyle(colors.text)
        }
      }
    }
    .accessibilityElement(children: .combine)
  }

  @ViewBuilder
  private func thankYouSection(_ detail: OrderDetailResponse) -> some View {
    if let thanks = detail.thankYou {
      Card(selected: true) {
        VStack(alignment: .leading, spacing: Theme.Space.xs) {
          Text("YOUR THANK-YOU").themeFont(.eyebrow).foregroundStyle(colors.accentInk)
          Text(thanks.text ?? String(localized: "Sent with a picture or video.")).themeFont(.bodyL).foregroundStyle(colors.accentInk)
        }
      }
      .accessibilityElement(children: .combine)
    } else {
      NavigationLink(value: OrderRoute.thankYou(orderId)) { Text("Say thank you") }
        .buttonStyle(PillButtonStyle())
        .accessibilityHint(Text("Record or write a thank-you the buyer sees when they tap the tag"))
    }
  }

  private func messagesSection(_ messages: [Message]) -> some View {
    VStack(alignment: .leading, spacing: Theme.Space.m) {
      Text("MESSAGES").themeFont(.eyebrow).foregroundStyle(colors.textMuted)
      if messages.isEmpty {
        Text("No messages yet.").themeFont(.body).foregroundStyle(colors.textMuted)
      }
      ForEach(messages) { message in
        MessageBubble(message: message)
      }
      LabeledTextField(label: "Reply", text: $reply, prompt: "Write a reply", axis: .vertical)
      PillButton(sending ? "Sending…" : "Send", hint: "Sends your reply to the buyer") {
        Task { await send() }
      }
      .disabled(sending || reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }
  }

  private func load() async {
    do {
      detail = try await app.api.order(id: orderId)
      error = nil
    } catch is CancellationError {
      return
    } catch {
      self.error = error.localizedDescription
    }
  }

  private func send() async {
    sending = true
    defer { sending = false }
    do {
      let message = try await app.api.sendMessage(orderId: orderId, body: reply)
      detail?.messages = (detail?.messages ?? []) + [message]
      reply = ""
      UIAccessibility.post(notification: .announcement, argument: String(localized: "Sent"))
    } catch {
      self.error = error.localizedDescription
    }
  }
}

private struct MessageBubble: View {
  let message: Message
  @Environment(\.themeColors) private var colors

  var body: some View {
    let mine = message.isFromCreator
    HStack {
      if mine { Spacer(minLength: Theme.Space.section) }
      Text(message.body)
        .themeFont(.body)
        .foregroundStyle(mine ? colors.primaryText : colors.text)
        .padding(Theme.Space.m)
        .background(RoundedRectangle(cornerRadius: Theme.Radius.m).fill(mine ? colors.primary : colors.surface))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.m).stroke(colors.border, lineWidth: Theme.Border.thin))
      if !mine { Spacer(minLength: Theme.Space.section) }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(mine ? "You said: \(message.body)" : "Buyer said: \(message.body)"))
  }
}
