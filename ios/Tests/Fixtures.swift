import Foundation

/// Sample responses shaped exactly like the types in docs/api.md.
enum Fixtures {
  static let creator = """
  {"id":"c1","slug":"leo","displayName":"Leo","studioName":"Sunrise Art Studio","avatarUrl":null,
   "bioShort":"I draw frogs.","storyText":null,"storyVideoUrl":null,"storyVideoVtt":null,
   "mentionDisability":false,
   "accessPrefs":{"voiceFirst":true,"simpleMode":true,"speakDescriptions":true,"highContrast":false,"largeText":false,"helperMode":false},
   "split":{"creator_bps":5000,"org_bps":3000,"production_bps":2000},"isExample":true}
  """

  static let authCode = #"{"token":"c1.abc123","creator":\#(creator)}"#

  static let shapeWithQuestion = """
  {"prompt":"A cheerful green frog wearing a gold crown, thick outlines, white background",
   "style_notes":"bold sticker style","clarifying_question":"What color should the crown be?",
   "spoken_confirmation":"A happy frog with a crown. Drawing it now."}
  """

  static let shapeNoQuestion = """
  {"prompt":"A frog","style_notes":"","clarifying_question":null,"spoken_confirmation":"Drawing a frog."}
  """

  static let artworkVariants = """
  {"artworks":[
    {"id":"a1","creatorId":"c1","source":"text2image","transcript":"a frog with a crown","shapedPrompt":"A frog",
     "originalUrl":null,"cleanedUrl":"https://blob.example/a1.png","maskUrl":null,"cutPathSvg":null,
     "altText":"Green frog with a gold crown","spokenDescription":"A smiling green frog wears a small gold crown.",
     "differencesFromPrompt":"The crown has three points.","genResponseId":"resp_1","parentArtworkId":null,
     "status":"draft","createdAt":"2026-10-28T22:00:00.000Z","previewUrl":"https://blob.example/a1-preview.png"},
    {"id":"a2","creatorId":"c1","source":"text2image","transcript":"a frog with a crown","shapedPrompt":"A frog",
     "originalUrl":null,"cleanedUrl":null,"maskUrl":null,"cutPathSvg":null,
     "altText":"Frog","spokenDescription":"A frog.","differencesFromPrompt":null,"genResponseId":"resp_2",
     "parentArtworkId":null,"status":"draft","createdAt":"2026-10-28T22:00:01Z","previewUrl":"https://blob.example/a2.png"}
  ]}
  """

  static let photoArtwork = """
  {"artwork":{"id":"p1","creatorId":"c1","source":"photo","transcript":null,"shapedPrompt":null,
    "originalUrl":"creators/c1/photos/x.jpg","cleanedUrl":null,"maskUrl":null,"cutPathSvg":null,"altText":null,
    "spokenDescription":null,"differencesFromPrompt":null,"genResponseId":null,"parentArtworkId":null,
    "status":"draft","createdAt":"2026-10-28T22:00:00Z"},
   "candidates":[
    {"id":"k1","bbox":[10,20,310,420],"score":0.93,"thumbUrl":"https://blob.example/k1.png"},
    {"id":"k2","bbox":[400.5,30,700,380],"score":0.71,"thumbUrl":"https://blob.example/k2.png"}]}
  """

  static let product = """
  {"id":"pr1","artworkId":"a1","creatorId":"c1","type":"sticker","mockupUrl":"https://blob.example/m.png",
   "printPngUrl":"creators/c1/print/p.png","printSvgUrl":"creators/c1/print/p.svg","priceCents":500,"status":"draft"}
  """

  static let listingRun = """
  {"listing":{"title":"Crowned Frog Sticker","description":"A royal frog.","tags":["frog","crown"],
    "price_cents":600,"print_ok":true,"notes":"Thick outline prints well."},
   "trace":[{"step":1,"tool":"check_print","args":{"dpi":300},"result":{"ok":true}},{"step":2,"text":"Done."}]}
  """

  static let approve = """
  {"product":\(product),
   "listing":{"productId":"pr1","title":"Crowned Frog Sticker","description":"A royal frog.","tags":["frog"],
     "priceSuggestionCents":600,"approvedAt":"2026-10-28T22:05:00Z","approvedVia":"voice","madeByVoice":true},
   "storyVideoNeeded":true}
  """

  static let orders = """
  {"orders":[{"id":"o1","productId":"pr1","productTitle":"Crowned Frog Sticker","mockupUrl":"https://blob.example/m.png",
    "buyerName":"Sam","amountCents":600,"creatorShareCents":300,"status":"placed","createdAt":"2026-10-28T23:00:00Z",
    "hasThankYou":false,"unreadMessages":1}],"unread":2}
  """

  static let orderDetail = """
  {"order":{"id":"o1","productId":"pr1","productTitle":"Crowned Frog Sticker","mockupUrl":null,"buyerName":"Sam",
    "amountCents":600,"creatorShareCents":300,"status":"placed","createdAt":"2026-10-28T23:00:00Z",
    "hasThankYou":false,"unreadMessages":1,"shipNote":"It's a gift!","token":"ABCDEFGHJKMN"},
   "thankYou":null,
   "messages":[{"id":"m1","orderId":"o1","direction":"buyer_to_creator","body":"Love it!","createdAt":"2026-10-28T23:01:00Z","readAt":null}]}
  """

  static let thankYouDraft = #"{"draftText":"Thank you, Sam!","provider":"baseten"}"#
  static let storyPrompts = #"{"prompts":["Who are you?","What do you love to make?","Why do you make art?"]}"#
  static let transcribe = #"{"text":"a frog with a crown","language":"en","segments":[]}"#
  static let error = #"{"error":{"code":"invalid_code","message":"That code didn't work."}}"#
}
