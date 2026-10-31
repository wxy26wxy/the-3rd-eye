// GENERATED from design/tokens.json — do not edit by hand. Run: pnpm tokens
import SwiftUI

enum Tokens {
  enum Brand {
    static let name = "The 3rd Eye"
    static let wordmark = "THE 3RD EYE"
    static let scheme = "the3rdeye"
  }
  enum Palette {
    static let page = Color(red: 0.9882, green: 0.9882, blue: 0.9882)
    static let ink = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let inkSoft = Color(red: 0.1490, green: 0.2275, blue: 0.2078)
    static let textMuted = Color(red: 0.4196, green: 0.4471, blue: 0.5020)
    static let border = Color(red: 0.8196, green: 0.8353, blue: 0.8588)
    static let surfaceAlt = Color(red: 0.9529, green: 0.9569, blue: 0.9647)
    static let accent = Color(red: 0.3961, green: 0.7647, blue: 0.3804)
    static let accentBorder = Color(red: 0.1843, green: 0.6510, blue: 0.2784)
    static let greenDeep = Color(red: 0.0902, green: 0.2392, blue: 0.1686)
    static let white = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let danger = Color(red: 0.7020, green: 0.1490, blue: 0.1176)
    static let focus = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let scrim = Color(red: 0.0667, green: 0.0941, blue: 0.1529, opacity: 0.55)
  }
  enum Semantic {
    static let bg = Color(red: 0.9882, green: 0.9882, blue: 0.9882)
    static let surface = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let surfaceAlt = Color(red: 0.9529, green: 0.9569, blue: 0.9647)
    static let text = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let textOnDark = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let textMuted = Color(red: 0.4196, green: 0.4471, blue: 0.5020)
    static let accent = Color(red: 0.3961, green: 0.7647, blue: 0.3804)
    static let accentBorder = Color(red: 0.1843, green: 0.6510, blue: 0.2784)
    static let accentInk = Color(red: 0.0902, green: 0.2392, blue: 0.1686)
    static let primary = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let primaryText = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let primaryShadow = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let border = Color(red: 0.8196, green: 0.8353, blue: 0.8588)
    static let selected = Color(red: 0.3961, green: 0.7647, blue: 0.3804)
    static let danger = Color(red: 0.7020, green: 0.1490, blue: 0.1176)
    static let focusRing = Color(red: 0.1176, green: 0.2275, blue: 0.1412)
    static let scrim = Color(red: 0.0667, green: 0.0941, blue: 0.1529, opacity: 0.55)
  }
  enum HighContrast {
    static let bg = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let surface = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let text = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let textMuted = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let accent = Color(red: 0.3961, green: 0.7647, blue: 0.3804)
    static let accentInk = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let primary = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
    static let primaryText = Color(red: 1.0000, green: 1.0000, blue: 1.0000)
    static let border = Color(red: 0.0667, green: 0.0941, blue: 0.1529)
  }
  enum FontName {
    static let display = "Inter Variable"
    static let body = "Inter Variable"
  }
  enum TypeScale {
    static let webDisplay: CGFloat = 72
    static let displayXL: CGFloat = 48
    static let displayL: CGFloat = 40
    static let displayM: CGFloat = 21
    static let titleL: CGFloat = 18
    static let cardTitle: CGFloat = 22
    static let titleM: CGFloat = 16
    static let bodyL: CGFloat = 16
    static let body: CGFloat = 15
    static let bodyS: CGFloat = 13
    static let caption: CGFloat = 13
    static let eyebrow: CGFloat = 13
  }
  enum TypeWeight {
    static let webDisplay = 500
    static let displayXL = 500
    static let displayL = 500
    static let displayM = 500
    static let titleL = 600
    static let cardTitle = 600
    static let titleM = 600
    static let bodyL = 400
    static let body = 400
    static let bodyS = 400
    static let caption = 500
    static let eyebrow = 800
  }
  enum Space {
    static let xs: CGFloat = 6
    static let s: CGFloat = 10
    static let sm: CGFloat = 12
    static let m: CGFloat = 14
    static let l: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let page: CGFloat = 24
    static let cardPad: CGFloat = 28
    static let block: CGFloat = 32
    static let section: CGFloat = 36
    static let blockL: CGFloat = 40
    static let band: CGFloat = 56
    static let gutterWide: CGFloat = 80
    static let bandL: CGFloat = 96
    static let hero: CGFloat = 120
  }
  enum Radius {
    static let s: CGFloat = 6
    static let m: CGFloat = 18
    static let card: CGFloat = 28
    static let cardL: CGFloat = 30
    static let tile: CGFloat = 36
    static let pill: CGFloat = 999
  }
  enum Border {
    static let card: CGFloat = 1.5
    static let thin: CGFloat = 1
    static let icon: CGFloat = 1.8
  }
  enum Size {
    static let iconButton: CGFloat = 48
    static let cta: CGFloat = 56
    static let ctaSecondary: CGFloat = 50
    static let ctaArrow: CGFloat = 48
    static let record: CGFloat = 84
    static let stepDot: CGFloat = 8
    static let minTarget: CGFloat = 44
    static let avatar: CGFloat = 40
    static let methodIcon: CGFloat = 44
    static let radio: CGFloat = 24
    static let logoMark = CGSize(width: 40, height: 35)
    /// Share of the screen height, not points (65vh on the web).
    static let photoMaxHeightShare: CGFloat = 0.65
  }
  enum Opacity {
    static let disabled: Double = 0.6
  }
  enum Shadow {
    static let soft = (x: CGFloat(0), y: CGFloat(8), color: Color(red: 0.0000, green: 0.0000, blue: 0.0000, opacity: 0.18))
    static let hard = (x: CGFloat(0), y: CGFloat(0), color: Color(red: 0.0667, green: 0.0941, blue: 0.1529))
    static let hardL = (x: CGFloat(0), y: CGFloat(0), color: Color(red: 0.0667, green: 0.0941, blue: 0.1529))
    static let primary = (x: CGFloat(0), y: CGFloat(0), color: Color(red: 0.0667, green: 0.0941, blue: 0.1529))
    static let icon = (x: CGFloat(0), y: CGFloat(0), color: Color(red: 0.0667, green: 0.0941, blue: 0.1529))
  }
  enum ShadowBlur {
    static let soft: CGFloat = 12
    static let hard: CGFloat = 0
    static let hardL: CGFloat = 0
    static let primary: CGFloat = 0
    static let icon: CGFloat = 0
  }
  enum Asset {
    static let logoMark = "logo-mark"
    static let welcomeBg = "welcome-bg"
    static let mascotBook = "mascot-book"
    static let mascotOutline = "mascot-outline"
    static let mascotFront = "mascot-front"
    static let mascotMagnifier = "mascot-magnifier"
    static let sky = "sky"
    static let tote = "tote"
    static let heroSky = "hero-sky"
    static let iconCamera = "icon-camera"
    static let iconImage = "icon-image"
    static let iconMic = "icon-mic"
    static let iconChevronRight = "icon-chevron-right"
    static let iconCheck = "icon-check"
    static let iconArrow = "icon-arrow"
  }
  static let displayTilt: Double = 0
  static let grainOpacity: Double = 0
}
