import Foundation
import Vision
import ImageIO
let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil)!
let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
request.revision = VNDetectBarcodesRequestRevision1
request.usesCPUOnly = true
let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
    try handler.perform([request])
    guard let payload = request.results?.first?.payloadStringValue else { exit(2) }
    print(payload)
} catch {
    FileHandle.standardError.write(Data("Native decoder unavailable: \(error)\n".utf8))
    exit(3)
}
