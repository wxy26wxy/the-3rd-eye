import Foundation

/// Sends a short WAV recording (≤ 60 s, ≤ 4 MB) to `POST /transcribe` as multipart `file`
/// named `audio.wav` with type `audio/wav` (the transcription model accepts WAV only).
struct Transcriber {
  let api: APIClient

  func transcribe(fileURL: URL) async throws -> String {
    let audio = try Data(contentsOf: fileURL)
    let boundary = "maker-\(UUID().uuidString)"
    var body = Data()
    let name = "audio.wav"
    body.append(Data("--\(boundary)\r\n".utf8))
    body.append(Data("Content-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\n".utf8))
    body.append(Data("Content-Type: audio/wav\r\n\r\n".utf8))
    body.append(audio)
    body.append(Data("\r\n--\(boundary)--\r\n".utf8))
    let request = api.request("POST", "transcribe", body: body, contentType: "multipart/form-data; boundary=\(boundary)", timeout: 120)
    let response: TranscribeResponse = try await api.send(request)
    return response.text.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
