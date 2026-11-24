// An OpenAI-compatible chat server for Apple's on-device model (Foundation Models), for the
// runner's direct route (`openai-api/apple/<model>`, with APPLE_BASE_URL). Text only, no tools.
//
//   xcrun swiftc -O -swift-version 5 -o afm-bridge main.swift
//   AFM_BRIDGE_KEY=<key> AFM_GUARDRAILS=default ./afm-bridge 8095
//
// AFM_GUARDRAILS: `default` (Apple's filter, as apps get it) or `permissive` (no filter on text).
// A filter block is a 400 that the runner reads as a provider block ("Apple blocked the
// response"), so the sample has no score. The model processes one request at a time.

import Foundation
import FoundationModels
import Network

let env = ProcessInfo.processInfo.environment
let port = UInt16(CommandLine.arguments.dropFirst().first ?? "8095") ?? 8095
let apiKey = env["AFM_BRIDGE_KEY"] ?? ""
let permissive = env["AFM_GUARDRAILS"] == "permissive"
let modelName = env["AFM_MODEL_NAME"] ?? "apple/afm-on-device-2025"
let model = SystemLanguageModel(guardrails: permissive ? .permissiveContentTransformations : .default)
let contextSize = 4096

func log(_ s: String) {
    let line = "\(ISO8601DateFormatter().string(from: Date())) \(s)\n"
    FileHandle.standardError.write(line.data(using: .utf8)!)
}

struct HTTPError: Error {
    let status: Int
    let type: String
    let code: String
    let message: String
}

/// The text of an OpenAI message content: a string, or the text parts of a list.
func text(_ content: Any?) -> String {
    if let s = content as? String { return s }
    if let parts = content as? [[String: Any]] {
        return parts.compactMap { ($0["type"] as? String) == "text" ? $0["text"] as? String : nil }
            .joined(separator: "\n")
    }
    return ""
}

func segment(_ s: String) -> [Transcript.Segment] { [.text(Transcript.TextSegment(content: s))] }

func tokens(_ s: String) async -> Int {
    if #available(macOS 26.4, *) { return (try? await model.tokenCount(for: s)) ?? 0 }
    return 0
}

func chat(_ body: [String: Any]) async throws -> [String: Any] {
    if let tools = body["tools"] as? [Any], !tools.isEmpty {
        throw HTTPError(status: 400, type: "afm_unsupported", code: "tools_unsupported",
                        message: "The AFM bridge has no tool support.")
    }
    let messages = body["messages"] as? [[String: Any]] ?? []
    var system: [String] = []
    var turns: [(role: String, text: String)] = []
    for m in messages {
        let role = m["role"] as? String ?? "user"
        let t = text(m["content"])
        if role == "system" || role == "developer" {
            system.append(t)
        } else {
            let r = role == "assistant" ? "assistant" : "user"
            // The transcript alternates: same-role messages join.
            if let last = turns.last, last.role == r {
                turns[turns.count - 1].text += "\n\n" + t
            } else {
                turns.append((r, t))
            }
        }
    }
    guard let last = turns.last, last.role == "user" else {
        throw HTTPError(status: 400, type: "afm_request", code: "last_message_not_user",
                        message: "The last message must be from the user.")
    }
    var entries: [Transcript.Entry] = []
    if !system.isEmpty {
        entries.append(.instructions(Transcript.Instructions(
            segments: segment(system.joined(separator: "\n\n")), toolDefinitions: [])))
    }
    for turn in turns.dropLast() {
        entries.append(turn.role == "assistant"
            ? .response(Transcript.Response(assetIDs: [], segments: segment(turn.text)))
            : .prompt(Transcript.Prompt(segments: segment(turn.text))))
    }
    let session = LanguageModelSession(model: model, tools: [], transcript: Transcript(entries: entries))

    var options = GenerationOptions()
    if let t = body["temperature"] as? Double {
        if t == 0 { options.sampling = .greedy } else { options.temperature = t }
    }
    let maxTokens = (body["max_completion_tokens"] as? Int) ?? (body["max_tokens"] as? Int)
    if let m = maxTokens, m > 0, m < contextSize { options.maximumResponseTokens = m }

    do {
        let reply = try await session.respond(to: last.text, options: options).content
        let input = await tokens((system + turns.map(\.text)).joined(separator: "\n"))
        let output = await tokens(reply)
        return [
            "id": "chatcmpl-\(UUID().uuidString)",
            "object": "chat.completion",
            "created": Int(Date().timeIntervalSince1970),
            "model": modelName,
            "choices": [["index": 0, "message": ["role": "assistant", "content": reply], "finish_reason": "stop"]],
            "usage": ["prompt_tokens": input, "completion_tokens": output, "total_tokens": input + output],
        ]
    } catch let e as LanguageModelSession.GenerationError {
        switch e {
        case .guardrailViolation:
            throw HTTPError(status: 400, type: "apple_guardrail", code: "guardrail_violation",
                            message: "Apple blocked the response: GUARDRAIL_VIOLATION")
        case .exceededContextWindowSize:
            // Not "context_length_exceeded": Inspect would score that as a cut reply.
            throw HTTPError(status: 400, type: "afm_context", code: "afm_context_window",
                            message: "The request does not fit the model's \(contextSize)-token context window.")
        case .unsupportedLanguageOrLocale:
            throw HTTPError(status: 400, type: "afm_language", code: "unsupported_language",
                            message: "The model does not support the request's language.")
        case .rateLimited, .concurrentRequests:
            throw HTTPError(status: 429, type: "afm_busy", code: "rate_limited", message: "\(e)")
        default:
            throw HTTPError(status: 500, type: "afm_error", code: "generation_error", message: "\(e)")
        }
    }
}

func respond(_ conn: NWConnection, _ status: Int, _ json: Any) {
    let body = (try? JSONSerialization.data(withJSONObject: json)) ?? Data()
    let reason = [200: "OK", 400: "Bad Request", 401: "Unauthorized", 404: "Not Found", 429: "Too Many Requests"][status] ?? "Error"
    var head = "HTTP/1.1 \(status) \(reason)\r\nContent-Type: application/json\r\n"
    head += "Content-Length: \(body.count)\r\nConnection: close\r\n\r\n"
    conn.send(content: head.data(using: .utf8)! + body, completion: .contentProcessed { _ in conn.cancel() })
}

func errorBody(_ e: HTTPError) -> [String: Any] {
    ["error": ["message": e.message, "type": e.type, "code": e.code]]
}

func handle(_ conn: NWConnection, _ request: Data) {
    guard let split = request.range(of: Data("\r\n\r\n".utf8)),
          let head = String(data: request[..<split.lowerBound], encoding: .utf8) else {
        return respond(conn, 400, ["error": ["message": "Bad request"]])
    }
    let lines = head.components(separatedBy: "\r\n")
    let parts = lines[0].split(separator: " ")
    let method = parts.first.map(String.init) ?? ""
    let path = parts.count > 1 ? String(parts[1]) : ""
    let auth = lines.first { $0.lowercased().hasPrefix("authorization:") }?
        .split(separator: ":", maxSplits: 1).last?.trimmingCharacters(in: .whitespaces) ?? ""
    if !apiKey.isEmpty && auth != "Bearer \(apiKey)" {
        return respond(conn, 401, ["error": ["message": "Unauthorized", "type": "auth", "code": "unauthorized"]])
    }
    if method == "GET" && path.hasSuffix("/models") {
        return respond(conn, 200, ["object": "list", "data": [["id": modelName, "object": "model", "owned_by": "apple"]]])
    }
    guard method == "POST" && path.hasSuffix("/chat/completions"),
          let body = try? JSONSerialization.jsonObject(with: request[split.upperBound...]) as? [String: Any] else {
        return respond(conn, 404, ["error": ["message": "Not found: \(method) \(path)"]])
    }
    Task {
        let start = Date()
        do {
            let out = try await chat(body)
            log("200 \(String(format: "%.1f", Date().timeIntervalSince(start)))s")
            respond(conn, 200, out)
        } catch let e as HTTPError {
            log("\(e.status) \(e.code) \(String(format: "%.1f", Date().timeIntervalSince(start)))s")
            respond(conn, e.status, errorBody(e))
        } catch {
            log("500 \(error)")
            respond(conn, 500, errorBody(HTTPError(status: 500, type: "afm_error", code: "error", message: "\(error)")))
        }
    }
}

/// Reads the headers, then the body by Content-Length.
func receive(_ conn: NWConnection, _ buffer: Data = Data()) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { data, _, done, error in
        var buffer = buffer
        if let data { buffer.append(data) }
        if let split = buffer.range(of: Data("\r\n\r\n".utf8)),
           let head = String(data: buffer[..<split.lowerBound], encoding: .utf8) {
            let length = head.components(separatedBy: "\r\n")
                .first { $0.lowercased().hasPrefix("content-length:") }
                .flatMap { Int($0.split(separator: ":")[1].trimmingCharacters(in: .whitespaces)) } ?? 0
            if buffer.count - split.upperBound >= length { return handle(conn, buffer) }
        }
        if done || error != nil { return conn.cancel() }
        receive(conn, buffer)
    }
}

guard case .available = model.availability else {
    log("The model is not available: \(model.availability)")
    exit(1)
}
let params = NWParameters.tcp
params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
let listener = try NWListener(using: params)
listener.newConnectionHandler = { conn in
    conn.start(queue: .global())
    receive(conn)
}
listener.stateUpdateHandler = { state in log("Listener: \(state)") }
listener.start(queue: .main)
log("AFM bridge on 127.0.0.1:\(port), model \(modelName), guardrails \(permissive ? "permissive" : "default")")
dispatchMain()
