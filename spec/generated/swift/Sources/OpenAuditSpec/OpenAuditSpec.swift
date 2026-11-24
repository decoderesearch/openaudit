// Generated from spec/schemas by spec/scripts/generate.mjs. Do not edit.

// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let organization = try Organization(json)
//   let model = try Model(json)
//   let document = try Document(json)
//   let eval = try Eval(json)
//   let evalSuite = try EvalSuite(json)
//   let evalVersion = try EvalVersion(json)
//   let evalSample = try EvalSample(json)
//   let systemCard = try SystemCard(json)
//   let evalResult = try EvalResult(json)
//   let evalRun = try EvalRun(json)
//   let evalAttempt = try EvalAttempt(json)
//   let transcript = try Transcript(json)
//   let openAuditCardVersion = try OpenAuditCardVersion(json)
//   let openAuditSnippet = try OpenAuditSnippet(json)
//   let orgIncident = try OrgIncident(json)
//   let orgIncidentEvent = try OrgIncidentEvent(json)
//   let orgDeparture = try OrgDeparture(json)
//   let commitment = try Commitment(json)
//   let orgCommitment = try OrgCommitment(json)
//   let orgCommitmentEvent = try OrgCommitmentEvent(json)
//   let method = try Method(json)
//   let methodVariant = try MethodVariant(json)
//   let methodExpertView = try MethodExpertView(json)
//   let methodArtifact = try MethodArtifact(json)
//   let methodResult = try MethodResult(json)

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

import Foundation

/// A lab or company that makes models or publishes documents.
// MARK: - Organization
public struct Organization: Codable, Equatable, Sendable {
    /// Other names in documents (`Google DeepMind` and `Google Research` for `google`).
    public let aliases: [String]
    /// The name to show (`Alibaba`).
    public let displayName: String
    public let id: String
    /// How wide the research was. `deep`: many searches and primary sources. `light`: a few
    /// searches; empty lists are usual.
    public let researchDepth: ResearchDepth?
    /// The day of the newest research for the organization page (YYYY-MM-DD). New research looks
    /// only for events after this day.
    public let researchedAt: String?
    /// The organization's page URL (`/qwen`, `/google`): the model owner that most of its models
    /// use, in lowercase. Unique. Also a reserved handle.
    public let slug: String
    /// Other slugs that redirect to `slug`: old slugs and other model owners (`alibaba` for
    /// `qwen`). Unique across all organizations.
    public let slugAliases: [String]
    /// 1 to 3 sentences about the organization, with inline source links.
    public let summary: String?
    /// The organization's own website.
    public let website: String?

    public enum CodingKeys: String, CodingKey {
        case aliases = "aliases"
        case displayName = "displayName"
        case id = "id"
        case researchDepth = "researchDepth"
        case researchedAt = "researchedAt"
        case slug = "slug"
        case slugAliases = "slugAliases"
        case summary = "summary"
        case website = "website"
    }

    public init(aliases: [String], displayName: String, id: String, researchDepth: ResearchDepth?, researchedAt: String?, slug: String, slugAliases: [String], summary: String?, website: String?) {
        self.aliases = aliases
        self.displayName = displayName
        self.id = id
        self.researchDepth = researchDepth
        self.researchedAt = researchedAt
        self.slug = slug
        self.slugAliases = slugAliases
        self.summary = summary
        self.website = website
    }
}

// MARK: Organization convenience initializers and mutators

public extension Organization {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Organization.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        aliases: [String]? = nil,
        displayName: String? = nil,
        id: String? = nil,
        researchDepth: ResearchDepth?? = nil,
        researchedAt: String?? = nil,
        slug: String? = nil,
        slugAliases: [String]? = nil,
        summary: String?? = nil,
        website: String?? = nil
    ) -> Organization {
        return Organization(
            aliases: aliases ?? self.aliases,
            displayName: displayName ?? self.displayName,
            id: id ?? self.id,
            researchDepth: researchDepth ?? self.researchDepth,
            researchedAt: researchedAt ?? self.researchedAt,
            slug: slug ?? self.slug,
            slugAliases: slugAliases ?? self.slugAliases,
            summary: summary ?? self.summary,
            website: website ?? self.website
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// How wide the research was. `deep`: many searches and primary sources. `light`: a few
/// searches; empty lists are usual.
public enum ResearchDepth: String, Codable, Equatable, Sendable {
    case deep = "deep"
    case light = "light"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One model. Its facts are here, each with a source; a document is one source.
// MARK: - Model
public struct Model: Codable, Equatable, Sendable {
    /// Other names, such as API ids (`davinci`) and old names.
    public let aliases: [String]
    public let displayName: String
    /// The `Document`s about this model. The order has no meaning.
    public let documentIDS: [String]
    public let facts: ModelFacts
    /// The model family, for grouping (`Llama 3`).
    public let family: String?
    public let id: String
    /// The HF repo id or `local/<name>` for `hf`; `provider/model` for `api`. Unique with
    /// `source`. Also the URL path.
    public let name: String
    /// The `Organization` that made the model.
    public let organizationID: String
    /// The model this one comes from. One parent; a chain for combinations.
    public let parentID: String?
    public let parentRelation: ParentRelation?
    /// A base model: pretrained only, with no instruct or chat tuning. Lists do not show it.
    public let pretrained: Bool?
    /// The Hub repo was removed or made private. We keep the record.
    public let removedFromHub: Bool?
    /// The HF commit or the API snapshot id that the facts refer to.
    public let revision: String?
    public let source: ModelSource

    public enum CodingKeys: String, CodingKey {
        case aliases = "aliases"
        case displayName = "displayName"
        case documentIDS = "documentIds"
        case facts = "facts"
        case family = "family"
        case id = "id"
        case name = "name"
        case organizationID = "organizationId"
        case parentID = "parentId"
        case parentRelation = "parentRelation"
        case pretrained = "pretrained"
        case removedFromHub = "removedFromHub"
        case revision = "revision"
        case source = "source"
    }

    public init(aliases: [String], displayName: String, documentIDS: [String], facts: ModelFacts, family: String?, id: String, name: String, organizationID: String, parentID: String?, parentRelation: ParentRelation?, pretrained: Bool?, removedFromHub: Bool?, revision: String?, source: ModelSource) {
        self.aliases = aliases
        self.displayName = displayName
        self.documentIDS = documentIDS
        self.facts = facts
        self.family = family
        self.id = id
        self.name = name
        self.organizationID = organizationID
        self.parentID = parentID
        self.parentRelation = parentRelation
        self.pretrained = pretrained
        self.removedFromHub = removedFromHub
        self.revision = revision
        self.source = source
    }
}

// MARK: Model convenience initializers and mutators

public extension Model {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Model.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        aliases: [String]? = nil,
        displayName: String? = nil,
        documentIDS: [String]? = nil,
        facts: ModelFacts? = nil,
        family: String?? = nil,
        id: String? = nil,
        name: String? = nil,
        organizationID: String? = nil,
        parentID: String?? = nil,
        parentRelation: ParentRelation?? = nil,
        pretrained: Bool?? = nil,
        removedFromHub: Bool?? = nil,
        revision: String?? = nil,
        source: ModelSource? = nil
    ) -> Model {
        return Model(
            aliases: aliases ?? self.aliases,
            displayName: displayName ?? self.displayName,
            documentIDS: documentIDS ?? self.documentIDS,
            facts: facts ?? self.facts,
            family: family ?? self.family,
            id: id ?? self.id,
            name: name ?? self.name,
            organizationID: organizationID ?? self.organizationID,
            parentID: parentID ?? self.parentID,
            parentRelation: parentRelation ?? self.parentRelation,
            pretrained: pretrained ?? self.pretrained,
            removedFromHub: removedFromHub ?? self.removedFromHub,
            revision: revision ?? self.revision,
            source: source ?? self.source
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Facts about a model. A fact is left out when nobody has found it yet.
// MARK: - ModelFacts
public struct ModelFacts: Codable, Equatable, Sendable {
    /// Parameters used per token. Less than `totalParams` for a mixture of experts.
    public let activeParams: CountFact?
    /// A short description (`MoE transformer, 256 experts`).
    public let architecture: TextFact?
    /// Tokens.
    public let contextWindow: CountFact?
    public let knowledgeCutoff: DateFact?
    /// BCP 47 language tags (`en`, `zh`).
    public let languages: TagsFact?
    /// An SPDX id when there is one (`apache-2.0`), else the license name.
    public let license: TextFact?
    /// Tokens.
    public let maxOutput: CountFact?
    public let modalities: ModalitiesFact?
    /// The reasoning settings the model has (`none`, `low`, `high`).
    public let reasoningModes: TagsFact?
    public let releaseDate: DateFact?
    public let totalParams: CountFact?

    public enum CodingKeys: String, CodingKey {
        case activeParams = "activeParams"
        case architecture = "architecture"
        case contextWindow = "contextWindow"
        case knowledgeCutoff = "knowledgeCutoff"
        case languages = "languages"
        case license = "license"
        case maxOutput = "maxOutput"
        case modalities = "modalities"
        case reasoningModes = "reasoningModes"
        case releaseDate = "releaseDate"
        case totalParams = "totalParams"
    }

    public init(activeParams: CountFact?, architecture: TextFact?, contextWindow: CountFact?, knowledgeCutoff: DateFact?, languages: TagsFact?, license: TextFact?, maxOutput: CountFact?, modalities: ModalitiesFact?, reasoningModes: TagsFact?, releaseDate: DateFact?, totalParams: CountFact?) {
        self.activeParams = activeParams
        self.architecture = architecture
        self.contextWindow = contextWindow
        self.knowledgeCutoff = knowledgeCutoff
        self.languages = languages
        self.license = license
        self.maxOutput = maxOutput
        self.modalities = modalities
        self.reasoningModes = reasoningModes
        self.releaseDate = releaseDate
        self.totalParams = totalParams
    }
}

// MARK: ModelFacts convenience initializers and mutators

public extension ModelFacts {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ModelFacts.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        activeParams: CountFact?? = nil,
        architecture: TextFact?? = nil,
        contextWindow: CountFact?? = nil,
        knowledgeCutoff: DateFact?? = nil,
        languages: TagsFact?? = nil,
        license: TextFact?? = nil,
        maxOutput: CountFact?? = nil,
        modalities: ModalitiesFact?? = nil,
        reasoningModes: TagsFact?? = nil,
        releaseDate: DateFact?? = nil,
        totalParams: CountFact?? = nil
    ) -> ModelFacts {
        return ModelFacts(
            activeParams: activeParams ?? self.activeParams,
            architecture: architecture ?? self.architecture,
            contextWindow: contextWindow ?? self.contextWindow,
            knowledgeCutoff: knowledgeCutoff ?? self.knowledgeCutoff,
            languages: languages ?? self.languages,
            license: license ?? self.license,
            maxOutput: maxOutput ?? self.maxOutput,
            modalities: modalities ?? self.modalities,
            reasoningModes: reasoningModes ?? self.reasoningModes,
            releaseDate: releaseDate ?? self.releaseDate,
            totalParams: totalParams ?? self.totalParams
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Parameters used per token. Less than `totalParams` for a mixture of experts.
///
/// Tokens.
// MARK: - CountFact
public struct CountFact: Codable, Equatable, Sendable {
    public let source: FactSource
    public let value: Int

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case value = "value"
    }

    public init(source: FactSource, value: Int) {
        self.source = source
        self.value = value
    }
}

// MARK: CountFact convenience initializers and mutators

public extension CountFact {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CountFact.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: FactSource? = nil,
        value: Int? = nil
    ) -> CountFact {
        return CountFact(
            source: source ?? self.source,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Where a fact comes from.
// MARK: - FactSource
public struct FactSource: Codable, Equatable, Sendable {
    public let documentID: String?
    /// `document`: a `Document` (give `documentId`, and `page` and `quote` when you can).
    /// `hf_config`: the model's Hub config. `provider_docs` and `url`: a web page (give `url`).
    /// `manual`: entered by a person without a source to cite.
    public let kind: FactSourceKind
    /// The page or section (`12`, `A.3`).
    public let page: String?
    public let quote: String?
    public let url: String?

    public enum CodingKeys: String, CodingKey {
        case documentID = "documentId"
        case kind = "kind"
        case page = "page"
        case quote = "quote"
        case url = "url"
    }

    public init(documentID: String?, kind: FactSourceKind, page: String?, quote: String?, url: String?) {
        self.documentID = documentID
        self.kind = kind
        self.page = page
        self.quote = quote
        self.url = url
    }
}

// MARK: FactSource convenience initializers and mutators

public extension FactSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FactSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        documentID: String?? = nil,
        kind: FactSourceKind? = nil,
        page: String?? = nil,
        quote: String?? = nil,
        url: String?? = nil
    ) -> FactSource {
        return FactSource(
            documentID: documentID ?? self.documentID,
            kind: kind ?? self.kind,
            page: page ?? self.page,
            quote: quote ?? self.quote,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `document`: a `Document` (give `documentId`, and `page` and `quote` when you can).
/// `hf_config`: the model's Hub config. `provider_docs` and `url`: a web page (give `url`).
/// `manual`: entered by a person without a source to cite.
public enum FactSourceKind: String, Codable, Equatable, Sendable {
    case document = "document"
    case hfConfig = "hf_config"
    case manual = "manual"
    case providerDocs = "provider_docs"
    case url = "url"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A short description (`MoE transformer, 256 experts`).
///
/// An SPDX id when there is one (`apache-2.0`), else the license name.
// MARK: - TextFact
public struct TextFact: Codable, Equatable, Sendable {
    public let source: FactSource
    public let value: String

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case value = "value"
    }

    public init(source: FactSource, value: String) {
        self.source = source
        self.value = value
    }
}

// MARK: TextFact convenience initializers and mutators

public extension TextFact {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TextFact.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: FactSource? = nil,
        value: String? = nil
    ) -> TextFact {
        return TextFact(
            source: source ?? self.source,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - DateFact
public struct DateFact: Codable, Equatable, Sendable {
    public let source: FactSource
    public let value: String

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case value = "value"
    }

    public init(source: FactSource, value: String) {
        self.source = source
        self.value = value
    }
}

// MARK: DateFact convenience initializers and mutators

public extension DateFact {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(DateFact.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: FactSource? = nil,
        value: String? = nil
    ) -> DateFact {
        return DateFact(
            source: source ?? self.source,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// BCP 47 language tags (`en`, `zh`).
///
/// The reasoning settings the model has (`none`, `low`, `high`).
// MARK: - TagsFact
public struct TagsFact: Codable, Equatable, Sendable {
    public let source: FactSource
    public let value: [String]

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case value = "value"
    }

    public init(source: FactSource, value: [String]) {
        self.source = source
        self.value = value
    }
}

// MARK: TagsFact convenience initializers and mutators

public extension TagsFact {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TagsFact.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: FactSource? = nil,
        value: [String]? = nil
    ) -> TagsFact {
        return TagsFact(
            source: source ?? self.source,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - ModalitiesFact
public struct ModalitiesFact: Codable, Equatable, Sendable {
    public let source: FactSource
    public let value: Modalities

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case value = "value"
    }

    public init(source: FactSource, value: Modalities) {
        self.source = source
        self.value = value
    }
}

// MARK: ModalitiesFact convenience initializers and mutators

public extension ModalitiesFact {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ModalitiesFact.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: FactSource? = nil,
        value: Modalities? = nil
    ) -> ModalitiesFact {
        return ModalitiesFact(
            source: source ?? self.source,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - Modalities
public struct Modalities: Codable, Equatable, Sendable {
    public let input: [Modality]
    public let output: [Modality]

    public enum CodingKeys: String, CodingKey {
        case input = "input"
        case output = "output"
    }

    public init(input: [Modality], output: [Modality]) {
        self.input = input
        self.output = output
    }
}

// MARK: Modalities convenience initializers and mutators

public extension Modalities {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Modalities.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        input: [Modality]? = nil,
        output: [Modality]? = nil
    ) -> Modalities {
        return Modalities(
            input: input ?? self.input,
            output: output ?? self.output
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum Modality: String, Codable, Equatable, Sendable {
    case audio = "audio"
    case image = "image"
    case text = "text"
    case video = "video"
}

/// How a model comes from its parent, as the Hub's `base_model:<relation>:` tags.
public enum ParentRelation: String, Codable, Equatable, Sendable {
    case adapter = "adapter"
    case finetune = "finetune"
    case quantized = "quantized"
}

/// `hf`: weights on the Hugging Face Hub (or `local/<name>`). `api`: a model behind a
/// provider API. The name alone can collide (`openai/gpt-oss-20b` is open), so the source is
/// part of the identity.
public enum ModelSource: String, Codable, Equatable, Sendable {
    case api = "api"
    case hf = "hf"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A document an organization published about models: a link, our saved copy of the file and
/// facts we took from it. `url` stays the publisher's link.
// MARK: - Document
public struct Document: Codable, Equatable, Sendable {
    /// When we fetched the saved copy.
    public let fetchedAt: Date?
    /// The saved copy in our storage (`documents/<key>.pdf`).
    public let fileKey: String?
    public let fileType: FileType?
    /// Where we got the saved copy, when it is not `url` (the PDF that a web page links to).
    public let fileURL: String?
    public let id: String
    /// A readable unique key (`openai-gpt2-blog`).
    public let key: String
    public let kind: DocumentKind
    /// Notes for reviewers. Not shown on public pages.
    public let notes: String?
    public let publishedDate: String?
    /// The `Organization` that published it.
    public let publisherID: String
    /// The hash of the saved copy.
    public let sha256: String?
    public let title: String
    public let url: String
    /// A person checked that the link works and that the publisher is correct.
    public let verified: Bool

    public enum CodingKeys: String, CodingKey {
        case fetchedAt = "fetchedAt"
        case fileKey = "fileKey"
        case fileType = "fileType"
        case fileURL = "fileUrl"
        case id = "id"
        case key = "key"
        case kind = "kind"
        case notes = "notes"
        case publishedDate = "publishedDate"
        case publisherID = "publisherId"
        case sha256 = "sha256"
        case title = "title"
        case url = "url"
        case verified = "verified"
    }

    public init(fetchedAt: Date?, fileKey: String?, fileType: FileType?, fileURL: String?, id: String, key: String, kind: DocumentKind, notes: String?, publishedDate: String?, publisherID: String, sha256: String?, title: String, url: String, verified: Bool) {
        self.fetchedAt = fetchedAt
        self.fileKey = fileKey
        self.fileType = fileType
        self.fileURL = fileURL
        self.id = id
        self.key = key
        self.kind = kind
        self.notes = notes
        self.publishedDate = publishedDate
        self.publisherID = publisherID
        self.sha256 = sha256
        self.title = title
        self.url = url
        self.verified = verified
    }
}

// MARK: Document convenience initializers and mutators

public extension Document {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Document.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        fetchedAt: Date?? = nil,
        fileKey: String?? = nil,
        fileType: FileType?? = nil,
        fileURL: String?? = nil,
        id: String? = nil,
        key: String? = nil,
        kind: DocumentKind? = nil,
        notes: String?? = nil,
        publishedDate: String?? = nil,
        publisherID: String? = nil,
        sha256: String?? = nil,
        title: String? = nil,
        url: String? = nil,
        verified: Bool? = nil
    ) -> Document {
        return Document(
            fetchedAt: fetchedAt ?? self.fetchedAt,
            fileKey: fileKey ?? self.fileKey,
            fileType: fileType ?? self.fileType,
            fileURL: fileURL ?? self.fileURL,
            id: id ?? self.id,
            key: key ?? self.key,
            kind: kind ?? self.kind,
            notes: notes ?? self.notes,
            publishedDate: publishedDate ?? self.publishedDate,
            publisherID: publisherID ?? self.publisherID,
            sha256: sha256 ?? self.sha256,
            title: title ?? self.title,
            url: url ?? self.url,
            verified: verified ?? self.verified
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum FileType: String, Codable, Equatable, Sendable {
    case html = "html"
    case pdf = "pdf"
}

/// What the document is. A system card and a safety report state the lab's tests. A model
/// page is a short page about a model (specs and use), with no safety tests.
public enum DocumentKind: String, Codable, Equatable, Sendable {
    case blog = "blog"
    case modelPage = "model_page"
    case safetyReport = "safety_report"
    case systemCard = "system_card"
    case technicalReport = "technical_report"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A test of models, auditors or interp methods: a benchmark, a red team, an automated
/// audit. Results point to one of its `EvalVersion`s.
// MARK: - Eval
public struct Eval: Codable, Equatable, Sendable {
    public let access: EvalAccess
    /// Other spellings in documents (`Model Alignment between Statements and Knowledge`).
    public let aliases: [String]
    /// A full run costs little, so a user's request of it starts without an admin's approval
    /// (when its estimated cost is under the limit).
    public let autoApprove: Bool?
    /// The eval's canary string. We show it on each page, so training filters can drop them.
    public let canary: String?
    /// A short Markdown description.
    public let description: String?
    public let displayName: String
    public let facets: EvalFacets
    /// Groups related evals (`Petri` for Petri and Petri Bloom suites).
    public let family: String?
    public let id: String
    /// The day we marked it `legacy` (YYYY-MM-DD).
    public let legacyDecisionDate: String?
    /// One line on why we marked it `legacy` (`Built for base-model continuation; chat models
    /// score near zero.`). Markdown.
    public let legacyReason: String?
    public let links: [EvalLink]
    public let maintainers: [EvalMaintainer]
    /// The user who made it. Left out for evals in the site registry (seed data).
    public let ownerUserID: String?
    /// Cheaper judge or helper models that we tested against the defaults.
    public let recommendedModels: [RecommendedModel]?
    /// The day we marked it `saturated` (YYYY-MM-DD).
    public let saturatedDecisionDate: String?
    /// One line on why we marked it `saturated` (`Current models refuse almost every prompt.`).
    /// Markdown.
    public let saturatedReason: String?
    /// The name in URLs (`petri`, `mask`). Unique on the site.
    public let slug: String
    public let status: EvalStatus
    /// The `EvalSuite` that the eval is part of.
    public let suiteID: String?
    /// One plain sentence about what the eval tests, for lists and tables ("Tests whether the
    /// model lies under pressure about what it believes is true.").
    public let summary: String?
    /// The slug of the newer eval to use in place of this one.
    public let supersededBy: String?
    /// A private eval needs an owner. Anyone with the link can open an unlisted eval.
    public let visibility: Visibility

    public enum CodingKeys: String, CodingKey {
        case access = "access"
        case aliases = "aliases"
        case autoApprove = "autoApprove"
        case canary = "canary"
        case description = "description"
        case displayName = "displayName"
        case facets = "facets"
        case family = "family"
        case id = "id"
        case legacyDecisionDate = "legacyDecisionDate"
        case legacyReason = "legacyReason"
        case links = "links"
        case maintainers = "maintainers"
        case ownerUserID = "ownerUserId"
        case recommendedModels = "recommendedModels"
        case saturatedDecisionDate = "saturatedDecisionDate"
        case saturatedReason = "saturatedReason"
        case slug = "slug"
        case status = "status"
        case suiteID = "suiteId"
        case summary = "summary"
        case supersededBy = "supersededBy"
        case visibility = "visibility"
    }

    public init(access: EvalAccess, aliases: [String], autoApprove: Bool?, canary: String?, description: String?, displayName: String, facets: EvalFacets, family: String?, id: String, legacyDecisionDate: String?, legacyReason: String?, links: [EvalLink], maintainers: [EvalMaintainer], ownerUserID: String?, recommendedModels: [RecommendedModel]?, saturatedDecisionDate: String?, saturatedReason: String?, slug: String, status: EvalStatus, suiteID: String?, summary: String?, supersededBy: String?, visibility: Visibility) {
        self.access = access
        self.aliases = aliases
        self.autoApprove = autoApprove
        self.canary = canary
        self.description = description
        self.displayName = displayName
        self.facets = facets
        self.family = family
        self.id = id
        self.legacyDecisionDate = legacyDecisionDate
        self.legacyReason = legacyReason
        self.links = links
        self.maintainers = maintainers
        self.ownerUserID = ownerUserID
        self.recommendedModels = recommendedModels
        self.saturatedDecisionDate = saturatedDecisionDate
        self.saturatedReason = saturatedReason
        self.slug = slug
        self.status = status
        self.suiteID = suiteID
        self.summary = summary
        self.supersededBy = supersededBy
        self.visibility = visibility
    }
}

// MARK: Eval convenience initializers and mutators

public extension Eval {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Eval.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        access: EvalAccess? = nil,
        aliases: [String]? = nil,
        autoApprove: Bool?? = nil,
        canary: String?? = nil,
        description: String?? = nil,
        displayName: String? = nil,
        facets: EvalFacets? = nil,
        family: String?? = nil,
        id: String? = nil,
        legacyDecisionDate: String?? = nil,
        legacyReason: String?? = nil,
        links: [EvalLink]? = nil,
        maintainers: [EvalMaintainer]? = nil,
        ownerUserID: String?? = nil,
        recommendedModels: [RecommendedModel]?? = nil,
        saturatedDecisionDate: String?? = nil,
        saturatedReason: String?? = nil,
        slug: String? = nil,
        status: EvalStatus? = nil,
        suiteID: String?? = nil,
        summary: String?? = nil,
        supersededBy: String?? = nil,
        visibility: Visibility? = nil
    ) -> Eval {
        return Eval(
            access: access ?? self.access,
            aliases: aliases ?? self.aliases,
            autoApprove: autoApprove ?? self.autoApprove,
            canary: canary ?? self.canary,
            description: description ?? self.description,
            displayName: displayName ?? self.displayName,
            facets: facets ?? self.facets,
            family: family ?? self.family,
            id: id ?? self.id,
            legacyDecisionDate: legacyDecisionDate ?? self.legacyDecisionDate,
            legacyReason: legacyReason ?? self.legacyReason,
            links: links ?? self.links,
            maintainers: maintainers ?? self.maintainers,
            ownerUserID: ownerUserID ?? self.ownerUserID,
            recommendedModels: recommendedModels ?? self.recommendedModels,
            saturatedDecisionDate: saturatedDecisionDate ?? self.saturatedDecisionDate,
            saturatedReason: saturatedReason ?? self.saturatedReason,
            slug: slug ?? self.slug,
            status: status ?? self.status,
            suiteID: suiteID ?? self.suiteID,
            summary: summary ?? self.summary,
            supersededBy: supersededBy ?? self.supersededBy,
            visibility: visibility ?? self.visibility
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Who can get the samples. `public`: anyone. `gated`: after agreeing to the source's terms.
/// `held_out`: kept back by the maintainer. `lab_internal`: only the lab has it; we store
/// the record so reported results can link to it, and never run it.
public enum EvalAccess: String, Codable, Equatable, Sendable {
    case evalAccessPublic = "public"
    case gated = "gated"
    case heldOut = "held_out"
    case labInternal = "lab_internal"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Independent answers to one question each. Labels such as "benchmark" or "red team" are
/// combinations of these.
// MARK: - EvalFacets
public struct EvalFacets: Codable, Equatable, Sendable {
    /// The eval tries to make the subject fail (red teaming, jailbreaks).
    public let adversarial: Bool
    public let cases: [EvalCases]
    public let formats: [EvalFormat]
    public let grading: [Grading]
    /// People take part, as in uplift trials.
    public let humanParticipants: Bool
    public let measures: [Measures]
    public let subjects: [SubjectKind]
    public let topics: [Topic]

    public enum CodingKeys: String, CodingKey {
        case adversarial = "adversarial"
        case cases = "cases"
        case formats = "formats"
        case grading = "grading"
        case humanParticipants = "humanParticipants"
        case measures = "measures"
        case subjects = "subjects"
        case topics = "topics"
    }

    public init(adversarial: Bool, cases: [EvalCases], formats: [EvalFormat], grading: [Grading], humanParticipants: Bool, measures: [Measures], subjects: [SubjectKind], topics: [Topic]) {
        self.adversarial = adversarial
        self.cases = cases
        self.formats = formats
        self.grading = grading
        self.humanParticipants = humanParticipants
        self.measures = measures
        self.subjects = subjects
        self.topics = topics
    }
}

// MARK: EvalFacets convenience initializers and mutators

public extension EvalFacets {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalFacets.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        adversarial: Bool? = nil,
        cases: [EvalCases]? = nil,
        formats: [EvalFormat]? = nil,
        grading: [Grading]? = nil,
        humanParticipants: Bool? = nil,
        measures: [Measures]? = nil,
        subjects: [SubjectKind]? = nil,
        topics: [Topic]? = nil
    ) -> EvalFacets {
        return EvalFacets(
            adversarial: adversarial ?? self.adversarial,
            cases: cases ?? self.cases,
            formats: formats ?? self.formats,
            grading: grading ?? self.grading,
            humanParticipants: humanParticipants ?? self.humanParticipants,
            measures: measures ?? self.measures,
            subjects: subjects ?? self.subjects,
            topics: topics ?? self.topics
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `fixed`: a dataset. `generated`: an auditor model writes the conversation from a seed.
/// `live_human`: people talk to the subject.
public enum EvalCases: String, Codable, Equatable, Sendable {
    case fixed = "fixed"
    case generated = "generated"
    case liveHuman = "live_human"
}

public enum EvalFormat: String, Codable, Equatable, Sendable {
    case agentic = "agentic"
    case multiTurn = "multi_turn"
    case singleTurn = "single_turn"
}

public enum Grading: String, Codable, Equatable, Sendable {
    case human = "human"
    case modelJudge = "model_judge"
    case programmatic = "programmatic"
}

/// `capability`: can the subject do it. `propensity`: does it tend to. `robustness`: can its
/// safeguards be broken.
public enum Measures: String, Codable, Equatable, Sendable {
    case capability = "capability"
    case propensity = "propensity"
    case robustness = "robustness"
}

/// What a run tests. `model`: a model. `auditor`: an agent (model, tools, scaffold) that
/// audits target models. `method`: an interp method on a model, with its artifact (SAE,
/// vector, probe).
public enum SubjectKind: String, Codable, Equatable, Sendable {
    case auditor = "auditor"
    case method = "method"
    case model = "model"
}

/// What an eval is about. The same list tags system-card coverage.
public enum Topic: String, Codable, Equatable, Sendable {
    case agenticMisuse = "agentic_misuse"
    case auditing = "auditing"
    case bias = "bias"
    case bioChem = "bio_chem"
    case childSafety = "child_safety"
    case cotMonitorability = "cot_monitorability"
    case cyber = "cyber"
    case evalAwareness = "eval_awareness"
    case hallucination = "hallucination"
    case harmfulRequests = "harmful_requests"
    case honesty = "honesty"
    case jailbreaks = "jailbreaks"
    case manipulation = "manipulation"
    case powerSeeking = "power_seeking"
    case promptInjection = "prompt_injection"
    case rewardHacking = "reward_hacking"
    case sabotage = "sabotage"
    case selfHarm = "self_harm"
    case situationalAwareness = "situational_awareness"
    case sycophancy = "sycophancy"
    case toxicity = "toxicity"
    case welfare = "welfare"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - EvalLink
public struct EvalLink: Codable, Equatable, Sendable {
    public let kind: EvalLinkKind
    public let title: String?
    public let url: String

    public enum CodingKeys: String, CodingKey {
        case kind = "kind"
        case title = "title"
        case url = "url"
    }

    public init(kind: EvalLinkKind, title: String?, url: String) {
        self.kind = kind
        self.title = title
        self.url = url
    }
}

// MARK: EvalLink convenience initializers and mutators

public extension EvalLink {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalLink.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        kind: EvalLinkKind? = nil,
        title: String?? = nil,
        url: String? = nil
    ) -> EvalLink {
        return EvalLink(
            kind: kind ?? self.kind,
            title: title ?? self.title,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `hf_benchmark`: a Hugging Face benchmark dataset repo, for Community Evals.
/// `error_report`: our report of dataset errors to the maintainers; the Known Errors page
/// links it.
public enum EvalLinkKind: String, Codable, Equatable, Sendable {
    case blog = "blog"
    case dataset = "dataset"
    case errorReport = "error_report"
    case hfBenchmark = "hf_benchmark"
    case homepage = "homepage"
    case leaderboard = "leaderboard"
    case paper = "paper"
    case repo = "repo"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Who maintains the eval. Give `organizationId` when the maintainer is an `Organization`.
// MARK: - EvalMaintainer
public struct EvalMaintainer: Codable, Equatable, Sendable {
    public let name: String
    public let organizationID: String?
    public let url: String?

    public enum CodingKeys: String, CodingKey {
        case name = "name"
        case organizationID = "organizationId"
        case url = "url"
    }

    public init(name: String, organizationID: String?, url: String?) {
        self.name = name
        self.organizationID = organizationID
        self.url = url
    }
}

// MARK: EvalMaintainer convenience initializers and mutators

public extension EvalMaintainer {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalMaintainer.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        name: String? = nil,
        organizationID: String?? = nil,
        url: String?? = nil
    ) -> EvalMaintainer {
        return EvalMaintainer(
            name: name ?? self.name,
            organizationID: organizationID ?? self.organizationID,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A model we recommend for one role in an eval, in place of its default. We tested it on
/// some samples and its results agreed with the default model's results.
// MARK: - RecommendedModel
public struct RecommendedModel: Codable, Equatable, Sendable {
    /// Markdown. What we tested (samples, agreement, cost) and the run ids.
    public let evidence: String
    /// The model, as OpenRouter names it (`google/gemini-2.5-flash-lite`).
    public let model: String
    /// The day we made the recommendation (YYYY-MM-DD).
    public let recommendedAt: String
    /// The default model for the role (`openai/gpt-4-turbo`).
    public let replaces: String?
    /// The role, as the eval's task names it (`judge`, `auditor`, `grader`).
    public let role: String
    /// The eval version that we tested.
    public let version: String?

    public enum CodingKeys: String, CodingKey {
        case evidence = "evidence"
        case model = "model"
        case recommendedAt = "recommendedAt"
        case replaces = "replaces"
        case role = "role"
        case version = "version"
    }

    public init(evidence: String, model: String, recommendedAt: String, replaces: String?, role: String, version: String?) {
        self.evidence = evidence
        self.model = model
        self.recommendedAt = recommendedAt
        self.replaces = replaces
        self.role = role
        self.version = version
    }
}

// MARK: RecommendedModel convenience initializers and mutators

public extension RecommendedModel {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RecommendedModel.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        evidence: String? = nil,
        model: String? = nil,
        recommendedAt: String? = nil,
        replaces: String?? = nil,
        role: String? = nil,
        version: String?? = nil
    ) -> RecommendedModel {
        return RecommendedModel(
            evidence: evidence ?? self.evidence,
            model: model ?? self.model,
            recommendedAt: recommendedAt ?? self.recommendedAt,
            replaces: replaces ?? self.replaces,
            role: role ?? self.role,
            version: version ?? self.version
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `active`: current, and we recommend it. `saturated`: valid, but current models score at
/// the ceiling or the floor. `legacy`: dated, replaced, or with known validity problems; you
/// can still run it for history, but we do not recommend it by default. `retired`:
/// withdrawn; do not run it.
public enum EvalStatus: String, Codable, Equatable, Sendable {
    case active = "active"
    case legacy = "legacy"
    case retired = "retired"
    case saturated = "saturated"
}

/// A private eval needs an owner. Anyone with the link can open an unlisted eval.
///
/// `private`: the owner only. `unlisted`: anyone with the link; never listed or indexed.
/// `public`: listed and indexed. A record is never more visible than its parent.
///
/// Left out, `public`. Anyone with the link can open an unlisted variant.
public enum Visibility: String, Codable, Equatable, Sendable {
    case unlisted = "unlisted"
    case visibilityPrivate = "private"
    case visibilityPublic = "public"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A set of evals that one source publishes together (SAEBench). Its page compares method
/// variants across its evals. An eval names its suite with `suiteId`.
// MARK: - EvalSuite
public struct EvalSuite: Codable, Equatable, Sendable {
    /// A short Markdown description.
    public let description: String?
    public let displayName: String
    /// Slugs of its evals in display order, safety tasks first. Its other evals follow, safety
    /// tasks first, then by name.
    public let evalOrder: [String]?
    public let id: String
    public let links: [EvalLink]
    public let maintainers: [EvalMaintainer]
    /// Compare method variants at set values of one metric of a suite eval. Without it, each
    /// variant uses its one artifact in a group.
    public let matched: MethodMatch?
    /// The name in URLs (`saebench`).
    public let slug: String
    /// One plain sentence about what the suite tests.
    public let summary: String

    public enum CodingKeys: String, CodingKey {
        case description = "description"
        case displayName = "displayName"
        case evalOrder = "evalOrder"
        case id = "id"
        case links = "links"
        case maintainers = "maintainers"
        case matched = "matched"
        case slug = "slug"
        case summary = "summary"
    }

    public init(description: String?, displayName: String, evalOrder: [String]?, id: String, links: [EvalLink], maintainers: [EvalMaintainer], matched: MethodMatch?, slug: String, summary: String) {
        self.description = description
        self.displayName = displayName
        self.evalOrder = evalOrder
        self.id = id
        self.links = links
        self.maintainers = maintainers
        self.matched = matched
        self.slug = slug
        self.summary = summary
    }
}

// MARK: EvalSuite convenience initializers and mutators

public extension EvalSuite {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalSuite.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        description: String?? = nil,
        displayName: String? = nil,
        evalOrder: [String]?? = nil,
        id: String? = nil,
        links: [EvalLink]? = nil,
        maintainers: [EvalMaintainer]? = nil,
        matched: MethodMatch?? = nil,
        slug: String? = nil,
        summary: String? = nil
    ) -> EvalSuite {
        return EvalSuite(
            description: description ?? self.description,
            displayName: displayName ?? self.displayName,
            evalOrder: evalOrder ?? self.evalOrder,
            id: id ?? self.id,
            links: links ?? self.links,
            maintainers: maintainers ?? self.maintainers,
            matched: matched ?? self.matched,
            slug: slug ?? self.slug,
            summary: summary ?? self.summary
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Compare method variants at set values of one metric of a suite eval. Without it, each
/// variant uses its one artifact in a group.
///
/// Compare variants at set values of one metric (SAEs at the same L0). A value between the
/// points of a variant is interpolated.
// MARK: - MethodMatch
public struct MethodMatch: Codable, Equatable, Sendable {
    public let methodMatchDefault: Double
    /// The eval that gives the metric.
    public let eval: String
    public let metric: String
    public let targets: [Double]

    public enum CodingKeys: String, CodingKey {
        case methodMatchDefault = "default"
        case eval = "eval"
        case metric = "metric"
        case targets = "targets"
    }

    public init(methodMatchDefault: Double, eval: String, metric: String, targets: [Double]) {
        self.methodMatchDefault = methodMatchDefault
        self.eval = eval
        self.metric = metric
        self.targets = targets
    }
}

// MARK: MethodMatch convenience initializers and mutators

public extension MethodMatch {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodMatch.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        methodMatchDefault: Double? = nil,
        eval: String? = nil,
        metric: String? = nil,
        targets: [Double]? = nil
    ) -> MethodMatch {
        return MethodMatch(
            methodMatchDefault: methodMatchDefault ?? self.methodMatchDefault,
            eval: eval ?? self.eval,
            metric: metric ?? self.metric,
            targets: targets ?? self.targets
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One fixed form of an eval: its samples and how they are scored. Results from different
/// versions are not comparable. A new version when the samples, scores, rubric or task
/// defaults change. Judge and auditor models are run settings. A package release that
/// changes none of these only changes the `runner` pins; each run keeps its package versions.
// MARK: - EvalVersion
public struct EvalVersion: Codable, Equatable, Sendable {
    /// What changed from the version before, in Markdown.
    public let changes: String?
    /// Left out for `lab_internal` evals.
    public let dataset: EvalDataset?
    public let evalID: String
    public let id: String
    /// Only for evals whose subjects are methods.
    public let methodSetup: MethodEvalSetup?
    public let metrics: [MetricDef]
    public let releasedDate: String?
    public let runner: EvalRunner?
    public let sampleTerms: SampleTerms?
    public let scores: [ScoreDef]
    public let status: EvalVersionStatus
    /// The maintainer's name for it (`2.0`, `2026-02`). Unique per eval.
    public let version: String

    public enum CodingKeys: String, CodingKey {
        case changes = "changes"
        case dataset = "dataset"
        case evalID = "evalId"
        case id = "id"
        case methodSetup = "methodSetup"
        case metrics = "metrics"
        case releasedDate = "releasedDate"
        case runner = "runner"
        case sampleTerms = "sampleTerms"
        case scores = "scores"
        case status = "status"
        case version = "version"
    }

    public init(changes: String?, dataset: EvalDataset?, evalID: String, id: String, methodSetup: MethodEvalSetup?, metrics: [MetricDef], releasedDate: String?, runner: EvalRunner?, sampleTerms: SampleTerms?, scores: [ScoreDef], status: EvalVersionStatus, version: String) {
        self.changes = changes
        self.dataset = dataset
        self.evalID = evalID
        self.id = id
        self.methodSetup = methodSetup
        self.metrics = metrics
        self.releasedDate = releasedDate
        self.runner = runner
        self.sampleTerms = sampleTerms
        self.scores = scores
        self.status = status
        self.version = version
    }
}

// MARK: EvalVersion convenience initializers and mutators

public extension EvalVersion {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalVersion.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        changes: String?? = nil,
        dataset: EvalDataset?? = nil,
        evalID: String? = nil,
        id: String? = nil,
        methodSetup: MethodEvalSetup?? = nil,
        metrics: [MetricDef]? = nil,
        releasedDate: String?? = nil,
        runner: EvalRunner?? = nil,
        sampleTerms: SampleTerms?? = nil,
        scores: [ScoreDef]? = nil,
        status: EvalVersionStatus? = nil,
        version: String? = nil
    ) -> EvalVersion {
        return EvalVersion(
            changes: changes ?? self.changes,
            dataset: dataset ?? self.dataset,
            evalID: evalID ?? self.evalID,
            id: id ?? self.id,
            methodSetup: methodSetup ?? self.methodSetup,
            metrics: metrics ?? self.metrics,
            releasedDate: releasedDate ?? self.releasedDate,
            runner: runner ?? self.runner,
            sampleTerms: sampleTerms ?? self.sampleTerms,
            scores: scores ?? self.scores,
            status: status ?? self.status,
            version: version ?? self.version
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Left out for `lab_internal` evals.
///
/// Where the samples come from. Give `hfRepo` and `revision`, or `url`.
// MARK: - EvalDataset
public struct EvalDataset: Codable, Equatable, Sendable {
    /// A Hugging Face dataset repo (`cais/MASK`).
    public let hfRepo: String?
    /// An SPDX id when there is one (`cc-by-4.0`), else the license name.
    public let license: String?
    /// The commit or tag the samples come from.
    public let revision: String?
    /// The hash of all samples in order, as the spec serializes them.
    public let sha256: String?
    /// More data the task loads, for suites that join datasets (AbstentionBench).
    public let sources: [DatasetSource]?
    public let splits: [EvalSplit]
    public let url: String?

    public enum CodingKeys: String, CodingKey {
        case hfRepo = "hfRepo"
        case license = "license"
        case revision = "revision"
        case sha256 = "sha256"
        case sources = "sources"
        case splits = "splits"
        case url = "url"
    }

    public init(hfRepo: String?, license: String?, revision: String?, sha256: String?, sources: [DatasetSource]?, splits: [EvalSplit], url: String?) {
        self.hfRepo = hfRepo
        self.license = license
        self.revision = revision
        self.sha256 = sha256
        self.sources = sources
        self.splits = splits
        self.url = url
    }
}

// MARK: EvalDataset convenience initializers and mutators

public extension EvalDataset {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalDataset.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hfRepo: String?? = nil,
        license: String?? = nil,
        revision: String?? = nil,
        sha256: String?? = nil,
        sources: [DatasetSource]?? = nil,
        splits: [EvalSplit]? = nil,
        url: String?? = nil
    ) -> EvalDataset {
        return EvalDataset(
            hfRepo: hfRepo ?? self.hfRepo,
            license: license ?? self.license,
            revision: revision ?? self.revision,
            sha256: sha256 ?? self.sha256,
            sources: sources ?? self.sources,
            splits: splits ?? self.splits,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One more place a task loads data from. Give `hfRepo` and `revision`, or `url`.
// MARK: - DatasetSource
public struct DatasetSource: Codable, Equatable, Sendable {
    public let hfRepo: String?
    /// The commit the task pins.
    public let revision: String?
    /// A file at a pinned commit (a GitHub raw URL).
    public let url: String?

    public enum CodingKeys: String, CodingKey {
        case hfRepo = "hfRepo"
        case revision = "revision"
        case url = "url"
    }

    public init(hfRepo: String?, revision: String?, url: String?) {
        self.hfRepo = hfRepo
        self.revision = revision
        self.url = url
    }
}

// MARK: DatasetSource convenience initializers and mutators

public extension DatasetSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(DatasetSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        hfRepo: String?? = nil,
        revision: String?? = nil,
        url: String?? = nil
    ) -> DatasetSource {
        return DatasetSource(
            hfRepo: hfRepo ?? self.hfRepo,
            revision: revision ?? self.revision,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - EvalSplit
public struct EvalSplit: Codable, Equatable, Sendable {
    /// The split name in the source (`test`, `public`, `private`).
    public let name: String
    public let sampleCount: Int
    public let storage: SampleStorage

    public enum CodingKeys: String, CodingKey {
        case name = "name"
        case sampleCount = "sampleCount"
        case storage = "storage"
    }

    public init(name: String, sampleCount: Int, storage: SampleStorage) {
        self.name = name
        self.sampleCount = sampleCount
        self.storage = storage
    }
}

// MARK: EvalSplit convenience initializers and mutators

public extension EvalSplit {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalSplit.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        name: String? = nil,
        sampleCount: Int? = nil,
        storage: SampleStorage? = nil
    ) -> EvalSplit {
        return EvalSplit(
            name: name ?? self.name,
            sampleCount: sampleCount ?? self.sampleCount,
            storage: storage ?? self.storage
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `stored`: we keep the samples (the license allows it). `pointer`: a link to the source
/// revision, and each sample's id and hash. `hash_only`: only a hash of each sample (held
/// out).
public enum SampleStorage: String, Codable, Equatable, Sendable {
    case hashOnly = "hash_only"
    case pointer = "pointer"
    case stored = "stored"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Only for evals whose subjects are methods.
///
/// How an eval of tools defines its positive cases and sets thresholds.
// MARK: - MethodEvalSetup
public struct MethodEvalSetup: Codable, Equatable, Sendable {
    /// Markdown. How each tool sets its threshold before it is scored.
    public let calibration: String?
    /// The subject models that rank the variants. A variant needs a result on each to have a
    /// rank.
    public let coreSubjects: [String]?
    /// Markdown. What counts as a positive case (a lie).
    public let definition: String?
    public let subjectOrder: SubjectOrder?

    public enum CodingKeys: String, CodingKey {
        case calibration = "calibration"
        case coreSubjects = "coreSubjects"
        case definition = "definition"
        case subjectOrder = "subjectOrder"
    }

    public init(calibration: String?, coreSubjects: [String]?, definition: String?, subjectOrder: SubjectOrder?) {
        self.calibration = calibration
        self.coreSubjects = coreSubjects
        self.definition = definition
        self.subjectOrder = subjectOrder
    }
}

// MARK: MethodEvalSetup convenience initializers and mutators

public extension MethodEvalSetup {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodEvalSetup.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        calibration: String?? = nil,
        coreSubjects: [String]?? = nil,
        definition: String?? = nil,
        subjectOrder: SubjectOrder?? = nil
    ) -> MethodEvalSetup {
        return MethodEvalSetup(
            calibration: calibration ?? self.calibration,
            coreSubjects: coreSubjects ?? self.coreSubjects,
            definition: definition ?? self.definition,
            subjectOrder: subjectOrder ?? self.subjectOrder
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A number for each subject model that sorts the leaderboard rows (a capability index).
// MARK: - SubjectOrder
public struct SubjectOrder: Codable, Equatable, Sendable {
    public let label: String
    public let sourceTable: String?
    public let sourceURL: String
    public let values: [SubjectValue]

    public enum CodingKeys: String, CodingKey {
        case label = "label"
        case sourceTable = "sourceTable"
        case sourceURL = "sourceUrl"
        case values = "values"
    }

    public init(label: String, sourceTable: String?, sourceURL: String, values: [SubjectValue]) {
        self.label = label
        self.sourceTable = sourceTable
        self.sourceURL = sourceURL
        self.values = values
    }
}

// MARK: SubjectOrder convenience initializers and mutators

public extension SubjectOrder {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SubjectOrder.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        label: String? = nil,
        sourceTable: String?? = nil,
        sourceURL: String? = nil,
        values: [SubjectValue]? = nil
    ) -> SubjectOrder {
        return SubjectOrder(
            label: label ?? self.label,
            sourceTable: sourceTable ?? self.sourceTable,
            sourceURL: sourceURL ?? self.sourceURL,
            values: values ?? self.values
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - SubjectValue
public struct SubjectValue: Codable, Equatable, Sendable {
    /// The Hub name of the subject model, as artifacts give it.
    public let subject: String
    public let value: Double

    public enum CodingKeys: String, CodingKey {
        case subject = "subject"
        case value = "value"
    }

    public init(subject: String, value: Double) {
        self.subject = subject
        self.value = value
    }
}

// MARK: SubjectValue convenience initializers and mutators

public extension SubjectValue {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SubjectValue.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        subject: String? = nil,
        value: Double? = nil
    ) -> SubjectValue {
        return SubjectValue(
            subject: subject ?? self.subject,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One aggregate number an `EvalResult` can hold.
// MARK: - MetricDef
public struct MetricDef: Codable, Equatable, Sendable {
    public let aggregation: MetricAggregation
    public let description: String?
    /// Which way is better for the eval's own goal. For a skill eval, more skill.
    public let direction: Direction
    public let displayName: String
    /// The number to show first. At most one per version.
    public let headline: Bool?
    /// For `pass_at_k`.
    public let k: Int?
    public let key: String
    public let max: Double?
    public let min: Double?
    /// Which way is better for safety, as in `EvalResult.safetyDirection`; measured results get
    /// it. `neither` for skill metrics (dangerous skills too) and for refusals of safe requests.
    public let safetyDirection: Direction?
    /// The `ScoreDef.key` it comes from. Left out for `custom`.
    public let score: String?
    /// Left out for a plain number or a fraction (`percent`, `tokens`).
    public let unit: String?

    public enum CodingKeys: String, CodingKey {
        case aggregation = "aggregation"
        case description = "description"
        case direction = "direction"
        case displayName = "displayName"
        case headline = "headline"
        case k = "k"
        case key = "key"
        case max = "max"
        case min = "min"
        case safetyDirection = "safetyDirection"
        case score = "score"
        case unit = "unit"
    }

    public init(aggregation: MetricAggregation, description: String?, direction: Direction, displayName: String, headline: Bool?, k: Int?, key: String, max: Double?, min: Double?, safetyDirection: Direction?, score: String?, unit: String?) {
        self.aggregation = aggregation
        self.description = description
        self.direction = direction
        self.displayName = displayName
        self.headline = headline
        self.k = k
        self.key = key
        self.max = max
        self.min = min
        self.safetyDirection = safetyDirection
        self.score = score
        self.unit = unit
    }
}

// MARK: MetricDef convenience initializers and mutators

public extension MetricDef {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MetricDef.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        aggregation: MetricAggregation? = nil,
        description: String?? = nil,
        direction: Direction? = nil,
        displayName: String? = nil,
        headline: Bool?? = nil,
        k: Int?? = nil,
        key: String? = nil,
        max: Double?? = nil,
        min: Double?? = nil,
        safetyDirection: Direction?? = nil,
        score: String?? = nil,
        unit: String?? = nil
    ) -> MetricDef {
        return MetricDef(
            aggregation: aggregation ?? self.aggregation,
            description: description ?? self.description,
            direction: direction ?? self.direction,
            displayName: displayName ?? self.displayName,
            headline: headline ?? self.headline,
            k: k ?? self.k,
            key: key ?? self.key,
            max: max ?? self.max,
            min: min ?? self.min,
            safetyDirection: safetyDirection ?? self.safetyDirection,
            score: score ?? self.score,
            unit: unit ?? self.unit
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// How attempts become one number. `mean`: the mean of a score. `rate`: the share of
/// attempts whose binary score is 1. `pass_at_k`: pass@k over trials. `custom`: the eval's
/// own formula (see `description`).
public enum MetricAggregation: String, Codable, Equatable, Sendable {
    case custom = "custom"
    case mean = "mean"
    case passAtK = "pass_at_k"
    case rate = "rate"
}

/// Which way is better for the eval's own goal. For a skill eval, more skill.
///
/// `nearer_zero_is_better`: a signed number where 0 is best and both signs are worse.
///
/// Which way is better for safety, as in `EvalResult.safetyDirection`; measured results get
/// it. `neither` for skill metrics (dangerous skills too) and for refusals of safe
/// requests.
///
/// Which way shows more skill. `neither` for behavior results. Left out: not known.
///
/// Which way is better for safety. `neither` for skill results (dangerous skills too) and
/// for refusals of safe requests. Left out: not known.
public enum Direction: String, Codable, Equatable, Sendable {
    case higherIsBetter = "higher_is_better"
    case lowerIsBetter = "lower_is_better"
    case nearerZeroIsBetter = "nearer_zero_is_better"
    case neither = "neither"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// How to run a version. Optional; a run can come from anywhere.
// MARK: - EvalRunner
public struct EvalRunner: Codable, Equatable, Sendable {
    /// The samples a run does when its settings give no limit. A run with this limit or more
    /// counts as a full run.
    public let defaultLimit: Int?
    public let defaultTrials: Int?
    /// Other packages the task uses, each with its version (`inspect-petri==3.1.0`).
    public let dependencies: [String]?
    /// The runner needs a GPU (white-box methods).
    public let gpu: Bool?
    public let internet: Bool?
    public let kind: RunnerKind
    /// The models besides the target, and how the task gets each one.
    public let models: [ModelSlot]?
    /// The package and version that has the task (`inspect-evals==0.9.2`).
    public let package: String?
    /// The scores need the model's raw chain of thought. Most provider APIs do not return it, so
    /// we do not offer the eval for API models.
    public let rawReasoning: Bool?
    /// The model roles a run must fill.
    public let roles: [ModelRole]?
    /// The sandbox the task needs (`docker`), if any.
    public let sandbox: String?
    /// Also give the target as this Inspect model role (`target`), for tasks that read it by
    /// role.
    public let targetRole: String?
    /// The task to run (`inspect_evals/mask`, `inspect_petri/audit`).
    public let task: String?

    public enum CodingKeys: String, CodingKey {
        case defaultLimit = "defaultLimit"
        case defaultTrials = "defaultTrials"
        case dependencies = "dependencies"
        case gpu = "gpu"
        case internet = "internet"
        case kind = "kind"
        case models = "models"
        case package = "package"
        case rawReasoning = "rawReasoning"
        case roles = "roles"
        case sandbox = "sandbox"
        case targetRole = "targetRole"
        case task = "task"
    }

    public init(defaultLimit: Int?, defaultTrials: Int?, dependencies: [String]?, gpu: Bool?, internet: Bool?, kind: RunnerKind, models: [ModelSlot]?, package: String?, rawReasoning: Bool?, roles: [ModelRole]?, sandbox: String?, targetRole: String?, task: String?) {
        self.defaultLimit = defaultLimit
        self.defaultTrials = defaultTrials
        self.dependencies = dependencies
        self.gpu = gpu
        self.internet = internet
        self.kind = kind
        self.models = models
        self.package = package
        self.rawReasoning = rawReasoning
        self.roles = roles
        self.sandbox = sandbox
        self.targetRole = targetRole
        self.task = task
    }
}

// MARK: EvalRunner convenience initializers and mutators

public extension EvalRunner {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalRunner.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        defaultLimit: Int?? = nil,
        defaultTrials: Int?? = nil,
        dependencies: [String]?? = nil,
        gpu: Bool?? = nil,
        internet: Bool?? = nil,
        kind: RunnerKind? = nil,
        models: [ModelSlot]?? = nil,
        package: String?? = nil,
        rawReasoning: Bool?? = nil,
        roles: [ModelRole]?? = nil,
        sandbox: String?? = nil,
        targetRole: String?? = nil,
        task: String?? = nil
    ) -> EvalRunner {
        return EvalRunner(
            defaultLimit: defaultLimit ?? self.defaultLimit,
            defaultTrials: defaultTrials ?? self.defaultTrials,
            dependencies: dependencies ?? self.dependencies,
            gpu: gpu ?? self.gpu,
            internet: internet ?? self.internet,
            kind: kind ?? self.kind,
            models: models ?? self.models,
            package: package ?? self.package,
            rawReasoning: rawReasoning ?? self.rawReasoning,
            roles: roles ?? self.roles,
            sandbox: sandbox ?? self.sandbox,
            targetRole: targetRole ?? self.targetRole,
            task: task ?? self.task
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `inspect`: an Inspect task. `openaudit`: our runner. `external`: the maintainer's own
/// code.
public enum RunnerKind: String, Codable, Equatable, Sendable {
    case external = "external"
    case inspect = "inspect"
    case openaudit = "openaudit"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One model a task needs besides the target. The runner gives it as `taskArg` or as
/// `inspectRole`; give one. A run can change it; a re-score can change it only when
/// `scoring`.
// MARK: - ModelSlot
public struct ModelSlot: Codable, Equatable, Sendable {
    /// The model the task uses when not told, as a route model id (`openai/gpt-4o`). With a
    /// `tier`, our runs use the tier and this is only a record of the task's default.
    public let modelSlotDefault: String
    /// Unique in the version (`judge`, `refusal_judge`, `mark`).
    public let id: String
    /// The place in a list task argument (`grader_models`).
    public let index: Int?
    /// Give the model as this Inspect model role (`grader`).
    public let inspectRole: String?
    /// The name to show (`Refusal judge`). Default from `id`.
    public let label: String?
    /// Use these labs' models of the tier first, in this order, when the rules allow it.
    public let labs: [String]?
    public let role: ModelRole
    /// The slot can use a model of the target's lab (one judge in a panel of judges from several
    /// labs). It never uses the target model itself.
    public let sameLab: Bool?
    /// Only the scorer uses it, so a re-score can change it.
    public let scoring: Bool?
    /// Give the model as this task argument (`scorer_model`).
    public let taskArg: String?
    /// The lowest tier in spec/model-ladders.yaml that is good enough for this slot. A run gets
    /// the first model of the tier that the rules allow, and the next ones as fallbacks. A model
    /// of a higher tier is also good enough.
    public let tier: String?

    public enum CodingKeys: String, CodingKey {
        case modelSlotDefault = "default"
        case id = "id"
        case index = "index"
        case inspectRole = "inspectRole"
        case label = "label"
        case labs = "labs"
        case role = "role"
        case sameLab = "sameLab"
        case scoring = "scoring"
        case taskArg = "taskArg"
        case tier = "tier"
    }

    public init(modelSlotDefault: String, id: String, index: Int?, inspectRole: String?, label: String?, labs: [String]?, role: ModelRole, sameLab: Bool?, scoring: Bool?, taskArg: String?, tier: String?) {
        self.modelSlotDefault = modelSlotDefault
        self.id = id
        self.index = index
        self.inspectRole = inspectRole
        self.label = label
        self.labs = labs
        self.role = role
        self.sameLab = sameLab
        self.scoring = scoring
        self.taskArg = taskArg
        self.tier = tier
    }
}

// MARK: ModelSlot convenience initializers and mutators

public extension ModelSlot {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ModelSlot.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        modelSlotDefault: String? = nil,
        id: String? = nil,
        index: Int?? = nil,
        inspectRole: String?? = nil,
        label: String?? = nil,
        labs: [String]?? = nil,
        role: ModelRole? = nil,
        sameLab: Bool?? = nil,
        scoring: Bool?? = nil,
        taskArg: String?? = nil,
        tier: String?? = nil
    ) -> ModelSlot {
        return ModelSlot(
            modelSlotDefault: modelSlotDefault ?? self.modelSlotDefault,
            id: id ?? self.id,
            index: index ?? self.index,
            inspectRole: inspectRole ?? self.inspectRole,
            label: label ?? self.label,
            labs: labs ?? self.labs,
            role: role ?? self.role,
            sameLab: sameLab ?? self.sameLab,
            scoring: scoring ?? self.scoring,
            taskArg: taskArg ?? self.taskArg,
            tier: tier ?? self.tier
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// A model's part in a run, as Inspect's `model_roles`. `target`: the model under test.
/// `auditor`: writes the other side of the conversation. `judge`: scores. `monitor`: watches
/// the target for bad actions. `generator`: writes samples.
public enum ModelRole: String, Codable, Equatable, Sendable {
    case auditor = "auditor"
    case generator = "generator"
    case judge = "judge"
    case monitor = "monitor"
    case target = "target"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// The source's terms on showing its samples, and our rule for them. Left out: `open`.
// MARK: - SampleTerms
public struct SampleTerms: Codable, Equatable, Sendable {
    public let display: DisplayRule
    /// Why this rule, when the quote alone does not say.
    public let note: String?
    /// The terms, as the source states them. Left out when the source states none.
    public let quote: String?
    /// Where the terms are (the gate page or the README).
    public let source: String
    /// Rules for some samples. A matching rule replaces `display` for those samples.
    public let subsets: [SubsetTerms]?

    public enum CodingKeys: String, CodingKey {
        case display = "display"
        case note = "note"
        case quote = "quote"
        case source = "source"
        case subsets = "subsets"
    }

    public init(display: DisplayRule, note: String?, quote: String?, source: String, subsets: [SubsetTerms]?) {
        self.display = display
        self.note = note
        self.quote = quote
        self.source = source
        self.subsets = subsets
    }
}

// MARK: SampleTerms convenience initializers and mutators

public extension SampleTerms {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SampleTerms.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        display: DisplayRule? = nil,
        note: String?? = nil,
        quote: String?? = nil,
        source: String? = nil,
        subsets: [SubsetTerms]?? = nil
    ) -> SampleTerms {
        return SampleTerms(
            display: display ?? self.display,
            note: note ?? self.note,
            quote: quote ?? self.quote,
            source: source ?? self.source,
            subsets: subsets ?? self.subsets
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Who can read sample text: inputs, targets, transcripts and logs. `open`: anyone.
/// `sign_in`: signed-in users who accepted the dataset's terms on our site. `scores_only`:
/// nobody; pages show only scores and pass or fail.
///
/// A subset rule that matched this sample. Left out, the version's rule applies.
public enum DisplayRule: String, Codable, Equatable, Sendable {
    case displayRuleOpen = "open"
    case scoresOnly = "scores_only"
    case signIn = "sign_in"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A rule for the samples whose metadata `key` equals `value` (a dataset inside a suite).
// MARK: - SubsetTerms
public struct SubsetTerms: Codable, Equatable, Sendable {
    public let display: DisplayRule
    /// The sample metadata key, as the Inspect task sets it (`dataset_name`).
    public let key: String
    /// The terms, as the source states them.
    public let quote: String?
    public let source: String
    public let value: String

    public enum CodingKeys: String, CodingKey {
        case display = "display"
        case key = "key"
        case quote = "quote"
        case source = "source"
        case value = "value"
    }

    public init(display: DisplayRule, key: String, quote: String?, source: String, value: String) {
        self.display = display
        self.key = key
        self.quote = quote
        self.source = source
        self.value = value
    }
}

// MARK: SubsetTerms convenience initializers and mutators

public extension SubsetTerms {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SubsetTerms.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        display: DisplayRule? = nil,
        key: String? = nil,
        quote: String?? = nil,
        source: String? = nil,
        value: String? = nil
    ) -> SubsetTerms {
        return SubsetTerms(
            display: display ?? self.display,
            key: key ?? self.key,
            quote: quote ?? self.quote,
            source: source ?? self.source,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One score a scorer gives each attempt (Petri's judge gives about 36).
// MARK: - ScoreDef
public struct ScoreDef: Codable, Equatable, Sendable {
    /// The name of this score on an attempt when it is not `key` or ends with `/<key>`, such as
    /// the scorer's name (`fortress_scorer_adversarial`).
    public let attemptName: String?
    /// The factor that puts an attempt's value on this score's scale (100 for a 0 to 1 value of
    /// a percent).
    public let attemptScale: Double?
    /// What the score means; for a judge, a summary of its rubric.
    public let description: String?
    public let direction: Direction
    public let displayName: String
    /// The name in data (`unprompted_deception`).
    public let key: String
    public let max: Double?
    public let min: Double?
    public let pass: PassRule?
    public let type: ScoreType

    public enum CodingKeys: String, CodingKey {
        case attemptName = "attemptName"
        case attemptScale = "attemptScale"
        case description = "description"
        case direction = "direction"
        case displayName = "displayName"
        case key = "key"
        case max = "max"
        case min = "min"
        case pass = "pass"
        case type = "type"
    }

    public init(attemptName: String?, attemptScale: Double?, description: String?, direction: Direction, displayName: String, key: String, max: Double?, min: Double?, pass: PassRule?, type: ScoreType) {
        self.attemptName = attemptName
        self.attemptScale = attemptScale
        self.description = description
        self.direction = direction
        self.displayName = displayName
        self.key = key
        self.max = max
        self.min = min
        self.pass = pass
        self.type = type
    }
}

// MARK: ScoreDef convenience initializers and mutators

public extension ScoreDef {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ScoreDef.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        attemptName: String?? = nil,
        attemptScale: Double?? = nil,
        description: String?? = nil,
        direction: Direction? = nil,
        displayName: String? = nil,
        key: String? = nil,
        max: Double?? = nil,
        min: Double?? = nil,
        pass: PassRule?? = nil,
        type: ScoreType? = nil
    ) -> ScoreDef {
        return ScoreDef(
            attemptName: attemptName ?? self.attemptName,
            attemptScale: attemptScale ?? self.attemptScale,
            description: description ?? self.description,
            direction: direction ?? self.direction,
            displayName: displayName ?? self.displayName,
            key: key ?? self.key,
            max: max ?? self.max,
            min: min ?? self.min,
            pass: pass ?? self.pass,
            type: type ?? self.type
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// When one attempt's value of this score is a pass or a fail, if the direction cannot tell.
/// The runner marks each attempt by the rule of its headline score, and the attempt page
/// marks each score. With no rule, the direction decides: see `ADD_AN_EVAL.md`. A value that
/// the rule does not name has no mark.
// MARK: - PassRule
public struct PassRule: Codable, Equatable, Sendable {
    /// For each sample target, the values and their marks, as in `values` (AbstentionBench: with
    /// the target `True`, `yes` is a pass).
    public let byTarget: [String: [String: Bool]]?
    /// A number at this value or above is a fail, and a lower number is a pass (Petri's 1 to 10
    /// scale, 7).
    public let failAtOrAbove: Double?
    /// The group metric keys that the rule is for. An attempt in none of them has no mark (APE:
    /// only the harmful topics).
    public let groups: [String]?
    /// No mark on any value, for a score that is not good or bad for safety by itself.
    public let none: Bool?
    /// Each value as text and its mark: true for a pass (MASK: `honest` true, `lie` false). Case
    /// and spaces at the ends do not count. A number is its shortest text (`1`, `0.5`).
    public let values: [String: Bool]?

    public enum CodingKeys: String, CodingKey {
        case byTarget = "byTarget"
        case failAtOrAbove = "failAtOrAbove"
        case groups = "groups"
        case none = "none"
        case values = "values"
    }

    public init(byTarget: [String: [String: Bool]]?, failAtOrAbove: Double?, groups: [String]?, none: Bool?, values: [String: Bool]?) {
        self.byTarget = byTarget
        self.failAtOrAbove = failAtOrAbove
        self.groups = groups
        self.none = none
        self.values = values
    }
}

// MARK: PassRule convenience initializers and mutators

public extension PassRule {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(PassRule.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byTarget: [String: [String: Bool]]?? = nil,
        failAtOrAbove: Double?? = nil,
        groups: [String]?? = nil,
        none: Bool?? = nil,
        values: [String: Bool]?? = nil
    ) -> PassRule {
        return PassRule(
            byTarget: byTarget ?? self.byTarget,
            failAtOrAbove: failAtOrAbove ?? self.failAtOrAbove,
            groups: groups ?? self.groups,
            none: none ?? self.none,
            values: values ?? self.values
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `binary`: 0 or 1 (pass). `ordinal`: whole steps from `min` to `max` (a 1-10 judge scale).
/// `continuous`: any number, in `[min, max]` when given.
public enum ScoreType: String, Codable, Equatable, Sendable {
    case binary = "binary"
    case continuous = "continuous"
    case ordinal = "ordinal"
}

/// `draft`: can change. `published`: fixed, but its `runner` can change and it can add
/// metrics; results point only to published versions.
public enum EvalVersionStatus: String, Codable, Equatable, Sendable {
    case draft = "draft"
    case published = "published"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One sample of an eval version, as Inspect's `Sample`. Each split keeps `sourceId` and
/// `sha256`; only a `stored` split also keeps `input`.
// MARK: - EvalSample
public struct EvalSample: Codable, Equatable, Sendable {
    /// The options of a multiple-choice sample.
    public let choices: [String]?
    public let evalVersionID: String
    public let id: String
    /// A prompt, or chat messages.
    public let input: Input?
    /// Other fields of the source sample, as they are in the source.
    public let metadata: [String: JSONAny]
    /// The hash of `{"id": sourceId, "input": input}` as JSON with sorted keys and no spaces.
    /// Chat input is `SampleMessage[]`.
    public let sha256: String
    /// The sample's id in the source. Unique in its split.
    public let sourceID: String
    /// An `EvalSplit.name` of the version.
    public let split: String
    /// The answer or answers the scorer looks for.
    public let target: Target?

    public enum CodingKeys: String, CodingKey {
        case choices = "choices"
        case evalVersionID = "evalVersionId"
        case id = "id"
        case input = "input"
        case metadata = "metadata"
        case sha256 = "sha256"
        case sourceID = "sourceId"
        case split = "split"
        case target = "target"
    }

    public init(choices: [String]?, evalVersionID: String, id: String, input: Input?, metadata: [String: JSONAny], sha256: String, sourceID: String, split: String, target: Target?) {
        self.choices = choices
        self.evalVersionID = evalVersionID
        self.id = id
        self.input = input
        self.metadata = metadata
        self.sha256 = sha256
        self.sourceID = sourceID
        self.split = split
        self.target = target
    }
}

// MARK: EvalSample convenience initializers and mutators

public extension EvalSample {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalSample.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        choices: [String]?? = nil,
        evalVersionID: String? = nil,
        id: String? = nil,
        input: Input?? = nil,
        metadata: [String: JSONAny]? = nil,
        sha256: String? = nil,
        sourceID: String? = nil,
        split: String? = nil,
        target: Target?? = nil
    ) -> EvalSample {
        return EvalSample(
            choices: choices ?? self.choices,
            evalVersionID: evalVersionID ?? self.evalVersionID,
            id: id ?? self.id,
            input: input ?? self.input,
            metadata: metadata ?? self.metadata,
            sha256: sha256 ?? self.sha256,
            sourceID: sourceID ?? self.sourceID,
            split: split ?? self.split,
            target: target ?? self.target
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// A prompt, or chat messages.
public enum Input: Codable, Equatable, Sendable {
    case sampleMessageArray([SampleMessage])
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode([SampleMessage].self) {
            self = .sampleMessageArray(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        throw DecodingError.typeMismatch(Input.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for Input"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .sampleMessageArray(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One chat message of a sample's input. Text only.
// MARK: - SampleMessage
public struct SampleMessage: Codable, Equatable, Sendable {
    public let content: String
    public let role: Role

    public enum CodingKeys: String, CodingKey {
        case content = "content"
        case role = "role"
    }

    public init(content: String, role: Role) {
        self.content = content
        self.role = role
    }
}

// MARK: SampleMessage convenience initializers and mutators

public extension SampleMessage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SampleMessage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: String? = nil,
        role: Role? = nil
    ) -> SampleMessage {
        return SampleMessage(
            content: content ?? self.content,
            role: role ?? self.role
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum Role: String, Codable, Equatable, Sendable {
    case assistant = "assistant"
    case system = "system"
    case tool = "tool"
    case user = "user"
}

/// The answer or answers the scorer looks for.
public enum Target: Codable, Equatable, Sendable {
    case string(String)
    case stringArray([String])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode([String].self) {
            self = .stringArray(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        throw DecodingError.typeMismatch(Target.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for Target"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let x):
            try container.encode(x)
        case .stringArray(let x):
            try container.encode(x)
        }
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// What we extracted from one card. One card can have several documents (the PDF, the web
/// page, the blog post); `documentId` is the one we read.
// MARK: - SystemCard
public struct SystemCard: Codable, Equatable, Sendable {
    /// Other documents of the same card.
    public let alsoDocumentIDS: [String]
    /// The card this one updates (a delta card).
    public let basedOnDocumentID: String?
    public let covers: [CardCover]
    public let disclosures: Disclosures
    public let documentID: String
    public let extraction: ExtractionInfo
    public let findings: [Finding]
    public let id: String
    public let pageCount: Int?
    /// A person checked it. Pages mark unreviewed values "Not reviewed".
    public let reviewed: Bool
    public let riskDecisions: [RiskDecision]
    public let testers: [ExternalTester]
    public let topics: [TopicCoverage]

    public enum CodingKeys: String, CodingKey {
        case alsoDocumentIDS = "alsoDocumentIds"
        case basedOnDocumentID = "basedOnDocumentId"
        case covers = "covers"
        case disclosures = "disclosures"
        case documentID = "documentId"
        case extraction = "extraction"
        case findings = "findings"
        case id = "id"
        case pageCount = "pageCount"
        case reviewed = "reviewed"
        case riskDecisions = "riskDecisions"
        case testers = "testers"
        case topics = "topics"
    }

    public init(alsoDocumentIDS: [String], basedOnDocumentID: String?, covers: [CardCover], disclosures: Disclosures, documentID: String, extraction: ExtractionInfo, findings: [Finding], id: String, pageCount: Int?, reviewed: Bool, riskDecisions: [RiskDecision], testers: [ExternalTester], topics: [TopicCoverage]) {
        self.alsoDocumentIDS = alsoDocumentIDS
        self.basedOnDocumentID = basedOnDocumentID
        self.covers = covers
        self.disclosures = disclosures
        self.documentID = documentID
        self.extraction = extraction
        self.findings = findings
        self.id = id
        self.pageCount = pageCount
        self.reviewed = reviewed
        self.riskDecisions = riskDecisions
        self.testers = testers
        self.topics = topics
    }
}

// MARK: SystemCard convenience initializers and mutators

public extension SystemCard {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SystemCard.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        alsoDocumentIDS: [String]? = nil,
        basedOnDocumentID: String?? = nil,
        covers: [CardCover]? = nil,
        disclosures: Disclosures? = nil,
        documentID: String? = nil,
        extraction: ExtractionInfo? = nil,
        findings: [Finding]? = nil,
        id: String? = nil,
        pageCount: Int?? = nil,
        reviewed: Bool? = nil,
        riskDecisions: [RiskDecision]? = nil,
        testers: [ExternalTester]? = nil,
        topics: [TopicCoverage]? = nil
    ) -> SystemCard {
        return SystemCard(
            alsoDocumentIDS: alsoDocumentIDS ?? self.alsoDocumentIDS,
            basedOnDocumentID: basedOnDocumentID ?? self.basedOnDocumentID,
            covers: covers ?? self.covers,
            disclosures: disclosures ?? self.disclosures,
            documentID: documentID ?? self.documentID,
            extraction: extraction ?? self.extraction,
            findings: findings ?? self.findings,
            id: id ?? self.id,
            pageCount: pageCount ?? self.pageCount,
            reviewed: reviewed ?? self.reviewed,
            riskDecisions: riskDecisions ?? self.riskDecisions,
            testers: testers ?? self.testers,
            topics: topics ?? self.topics
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A model the card covers. `rawModelName` when the model is not in our list yet.
// MARK: - CardCover
public struct CardCover: Codable, Equatable, Sendable {
    public let modelID: String?
    public let rawModelName: String?
    /// The section about it, for cards that cover several models (`Appendix B`).
    public let section: String?

    public enum CodingKeys: String, CodingKey {
        case modelID = "modelId"
        case rawModelName = "rawModelName"
        case section = "section"
    }

    public init(modelID: String?, rawModelName: String?, section: String?) {
        self.modelID = modelID
        self.rawModelName = rawModelName
        self.section = section
    }
}

// MARK: CardCover convenience initializers and mutators

public extension CardCover {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CardCover.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        modelID: String?? = nil,
        rawModelName: String?? = nil,
        section: String?? = nil
    ) -> CardCover {
        return CardCover(
            modelID: modelID ?? self.modelID,
            rawModelName: rawModelName ?? self.rawModelName,
            section: section ?? self.section
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// The disclosure checklist. The keys match `ModelFacts`, plus training facts.
// MARK: - Disclosures
public struct Disclosures: Codable, Equatable, Sendable {
    public let activeParams: Disclosure?
    public let architecture: Disclosure?
    public let contextWindow: Disclosure?
    public let knowledgeCutoff: Disclosure?
    public let languages: Disclosure?
    public let license: Disclosure?
    public let maxOutput: Disclosure?
    public let modalities: Disclosure?
    public let reasoningModes: Disclosure?
    public let releaseDate: Disclosure?
    public let totalParams: Disclosure?
    public let trainingCompute: Disclosure?
    public let trainingData: Disclosure?

    public enum CodingKeys: String, CodingKey {
        case activeParams = "activeParams"
        case architecture = "architecture"
        case contextWindow = "contextWindow"
        case knowledgeCutoff = "knowledgeCutoff"
        case languages = "languages"
        case license = "license"
        case maxOutput = "maxOutput"
        case modalities = "modalities"
        case reasoningModes = "reasoningModes"
        case releaseDate = "releaseDate"
        case totalParams = "totalParams"
        case trainingCompute = "trainingCompute"
        case trainingData = "trainingData"
    }

    public init(activeParams: Disclosure?, architecture: Disclosure?, contextWindow: Disclosure?, knowledgeCutoff: Disclosure?, languages: Disclosure?, license: Disclosure?, maxOutput: Disclosure?, modalities: Disclosure?, reasoningModes: Disclosure?, releaseDate: Disclosure?, totalParams: Disclosure?, trainingCompute: Disclosure?, trainingData: Disclosure?) {
        self.activeParams = activeParams
        self.architecture = architecture
        self.contextWindow = contextWindow
        self.knowledgeCutoff = knowledgeCutoff
        self.languages = languages
        self.license = license
        self.maxOutput = maxOutput
        self.modalities = modalities
        self.reasoningModes = reasoningModes
        self.releaseDate = releaseDate
        self.totalParams = totalParams
        self.trainingCompute = trainingCompute
        self.trainingData = trainingData
    }
}

// MARK: Disclosures convenience initializers and mutators

public extension Disclosures {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Disclosures.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        activeParams: Disclosure?? = nil,
        architecture: Disclosure?? = nil,
        contextWindow: Disclosure?? = nil,
        knowledgeCutoff: Disclosure?? = nil,
        languages: Disclosure?? = nil,
        license: Disclosure?? = nil,
        maxOutput: Disclosure?? = nil,
        modalities: Disclosure?? = nil,
        reasoningModes: Disclosure?? = nil,
        releaseDate: Disclosure?? = nil,
        totalParams: Disclosure?? = nil,
        trainingCompute: Disclosure?? = nil,
        trainingData: Disclosure?? = nil
    ) -> Disclosures {
        return Disclosures(
            activeParams: activeParams ?? self.activeParams,
            architecture: architecture ?? self.architecture,
            contextWindow: contextWindow ?? self.contextWindow,
            knowledgeCutoff: knowledgeCutoff ?? self.knowledgeCutoff,
            languages: languages ?? self.languages,
            license: license ?? self.license,
            maxOutput: maxOutput ?? self.maxOutput,
            modalities: modalities ?? self.modalities,
            reasoningModes: reasoningModes ?? self.reasoningModes,
            releaseDate: releaseDate ?? self.releaseDate,
            totalParams: totalParams ?? self.totalParams,
            trainingCompute: trainingCompute ?? self.trainingCompute,
            trainingData: trainingData ?? self.trainingData
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One model fact. `stated`: the card says it (give `value` and `source`). `not_stated`: we
/// read the card; it does not say. Left out: not extracted yet.
// MARK: - Disclosure
public struct Disclosure: Codable, Equatable, Sendable {
    public let source: CardSource?
    public let status: Status
    /// The value in the card's words (`200K tokens`, `March 2026`).
    public let value: String?

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case status = "status"
        case value = "value"
    }

    public init(source: CardSource?, status: Status, value: String?) {
        self.source = source
        self.status = status
        self.value = value
    }
}

// MARK: Disclosure convenience initializers and mutators

public extension Disclosure {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Disclosure.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: CardSource?? = nil,
        status: Status? = nil,
        value: String?? = nil
    ) -> Disclosure {
        return Disclosure(
            source: source ?? self.source,
            status: status ?? self.status,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Where in the document a value is. The quote is the card's own words.
// MARK: - CardSource
public struct CardSource: Codable, Equatable, Sendable {
    /// The page or section (`12`, `5.3.2`), as printed in the document.
    public let page: String?
    /// The page in our saved PDF, from 1. Links go here; `page` is what we show.
    public let pdfPage: Int?
    public let quote: String

    public enum CodingKeys: String, CodingKey {
        case page = "page"
        case pdfPage = "pdfPage"
        case quote = "quote"
    }

    public init(page: String?, pdfPage: Int?, quote: String) {
        self.page = page
        self.pdfPage = pdfPage
        self.quote = quote
    }
}

// MARK: CardSource convenience initializers and mutators

public extension CardSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CardSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        page: String?? = nil,
        pdfPage: Int?? = nil,
        quote: String? = nil
    ) -> CardSource {
        return CardSource(
            page: page ?? self.page,
            pdfPage: pdfPage ?? self.pdfPage,
            quote: quote ?? self.quote
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum Status: String, Codable, Equatable, Sendable {
    case notStated = "not_stated"
    case stated = "stated"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// How a record was made. `by` is the model or person.
// MARK: - ExtractionInfo
public struct ExtractionInfo: Codable, Equatable, Sendable {
    public let at: Date
    public let by: String

    public enum CodingKeys: String, CodingKey {
        case at = "at"
        case by = "by"
    }

    public init(at: Date, by: String) {
        self.at = at
        self.by = by
    }
}

// MARK: ExtractionInfo convenience initializers and mutators

public extension ExtractionInfo {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ExtractionInfo.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        at: Date? = nil,
        by: String? = nil
    ) -> ExtractionInfo {
        return ExtractionInfo(
            at: at ?? self.at,
            by: by ?? self.by
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A notable finding that fits nowhere else. Short, in our words, with the quote.
// MARK: - Finding
public struct Finding: Codable, Equatable, Sendable {
    public let source: CardSource
    public let text: String
    public let tone: FindingTone?

    public enum CodingKeys: String, CodingKey {
        case source = "source"
        case text = "text"
        case tone = "tone"
    }

    public init(source: CardSource, text: String, tone: FindingTone?) {
        self.source = source
        self.text = text
        self.tone = tone
    }
}

// MARK: Finding convenience initializers and mutators

public extension Finding {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Finding.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        source: CardSource? = nil,
        text: String? = nil,
        tone: FindingTone?? = nil
    ) -> Finding {
        return Finding(
            source: source ?? self.source,
            text: text ?? self.text,
            tone: tone ?? self.tone
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Our reading for a safety reader. `good`: good for safety. `mixed`: mixed, a mild concern
/// or an important caveat. `bad`: a clear concern. `neutral`: a fact or method note.
public enum FindingTone: String, Codable, Equatable, Sendable {
    case bad = "bad"
    case good = "good"
    case mixed = "mixed"
    case neutral = "neutral"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One risk decision the lab states for one domain.
// MARK: - RiskDecision
public struct RiskDecision: Codable, Equatable, Sendable {
    /// Who decided, when the card says (`Responsible Scaling Officer`).
    public let decidedBy: String?
    public let domain: RiskDomain
    /// The published frameworks the verdict is made under. Leave out if none is named.
    public let frameworks: [FrameworkID]?
    /// The lab's words (`ASL-3`, `High`, `CCL not reached`).
    public let labLabel: String
    public let level: RiskLevel?
    /// The covered models the verdict is about. Left out when it is about all of them.
    public let modelIDS: [String]?
    public let phase: MitigationPhase
    public let source: CardSource

    public enum CodingKeys: String, CodingKey {
        case decidedBy = "decidedBy"
        case domain = "domain"
        case frameworks = "frameworks"
        case labLabel = "labLabel"
        case level = "level"
        case modelIDS = "modelIds"
        case phase = "phase"
        case source = "source"
    }

    public init(decidedBy: String?, domain: RiskDomain, frameworks: [FrameworkID]?, labLabel: String, level: RiskLevel?, modelIDS: [String]?, phase: MitigationPhase, source: CardSource) {
        self.decidedBy = decidedBy
        self.domain = domain
        self.frameworks = frameworks
        self.labLabel = labLabel
        self.level = level
        self.modelIDS = modelIDS
        self.phase = phase
        self.source = source
    }
}

// MARK: RiskDecision convenience initializers and mutators

public extension RiskDecision {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RiskDecision.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        decidedBy: String?? = nil,
        domain: RiskDomain? = nil,
        frameworks: [FrameworkID]?? = nil,
        labLabel: String? = nil,
        level: RiskLevel?? = nil,
        modelIDS: [String]?? = nil,
        phase: MitigationPhase? = nil,
        source: CardSource? = nil
    ) -> RiskDecision {
        return RiskDecision(
            decidedBy: decidedBy ?? self.decidedBy,
            domain: domain ?? self.domain,
            frameworks: frameworks ?? self.frameworks,
            labLabel: labLabel ?? self.labLabel,
            level: level ?? self.level,
            modelIDS: modelIDS ?? self.modelIDS,
            phase: phase ?? self.phase,
            source: source ?? self.source
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum RiskDomain: String, Codable, Equatable, Sendable {
    case aiRndAutonomy = "ai_rnd_autonomy"
    case bioChem = "bio_chem"
    case cyber = "cyber"
    case manipulation = "manipulation"
    case misalignment = "misalignment"
    case other = "other"
}

/// A published safety framework. `anthropic-rsp`: Responsible Scaling Policy (also ASL
/// levels). `anthropic-fcf`: Frontier Compliance Framework. `openai-preparedness`:
/// Preparedness Framework. `google-fsf`: Frontier Safety Framework. `meta-aasf`: Advanced AI
/// Scaling Framework. `amazon-fmsf`: Frontier Model Safety Framework. `xai-faif`: Frontier
/// Artificial Intelligence Framework. `xai-rmf`: Risk Management Framework.
/// `seoul-commitments`: Frontier AI Safety Commitments (Seoul, 2024).
public enum FrameworkID: String, Codable, Equatable, Sendable {
    case amazonFmsf = "amazon-fmsf"
    case anthropicFcf = "anthropic-fcf"
    case anthropicRsp = "anthropic-rsp"
    case googleFSF = "google-fsf"
    case metaAasf = "meta-aasf"
    case openaiPreparedness = "openai-preparedness"
    case seoulCommitments = "seoul-commitments"
    case xaiFaif = "xai-faif"
    case xaiRmf = "xai-rmf"
}

/// Our coarse level, for sorting only. Always show the lab's own label next to it. `below`:
/// under the lab's first threshold. `early_warning`: an alert or watch level. `reached`: a
/// threshold is reached or cannot be ruled out. `highest`: the top level.
public enum RiskLevel: String, Codable, Equatable, Sendable {
    case below = "below"
    case earlyWarning = "early_warning"
    case highest = "highest"
    case reached = "reached"
}

public enum MitigationPhase: String, Codable, Equatable, Sendable {
    case afterMitigation = "after_mitigation"
    case beforeMitigation = "before_mitigation"
    case unspecified = "unspecified"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - ExternalTester
public struct ExternalTester: Codable, Equatable, Sendable {
    /// The tester (`METR`, `UK AISI`, `Apollo Research`).
    public let name: String
    /// What they tested (`autonomy and AI R&D`).
    public let scope: String?
    public let source: CardSource

    public enum CodingKeys: String, CodingKey {
        case name = "name"
        case scope = "scope"
        case source = "source"
    }

    public init(name: String, scope: String?, source: CardSource) {
        self.name = name
        self.scope = scope
        self.source = source
    }
}

// MARK: ExternalTester convenience initializers and mutators

public extension ExternalTester {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ExternalTester.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        name: String? = nil,
        scope: String?? = nil,
        source: CardSource? = nil
    ) -> ExternalTester {
        return ExternalTester(
            name: name ?? self.name,
            scope: scope ?? self.scope,
            source: source ?? self.source
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Does the card cover a topic. `covered`: give a source, and a headline number when there
/// is one. Not covered: the card has nothing on it. Left out: not extracted yet.
// MARK: - TopicCoverage
public struct TopicCoverage: Codable, Equatable, Sendable {
    public let covered: Bool
    /// The main result in the card's words (`0.8% jailbreak success`).
    public let headline: String?
    public let source: CardSource?
    public let topic: Topic

    public enum CodingKeys: String, CodingKey {
        case covered = "covered"
        case headline = "headline"
        case source = "source"
        case topic = "topic"
    }

    public init(covered: Bool, headline: String?, source: CardSource?, topic: Topic) {
        self.covered = covered
        self.headline = headline
        self.source = source
        self.topic = topic
    }
}

// MARK: TopicCoverage convenience initializers and mutators

public extension TopicCoverage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TopicCoverage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        covered: Bool? = nil,
        headline: String?? = nil,
        source: CardSource?? = nil,
        topic: Topic? = nil
    ) -> TopicCoverage {
        return TopicCoverage(
            covered: covered ?? self.covered,
            headline: headline ?? self.headline,
            source: source ?? self.source,
            topic: topic ?? self.topic
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One number: one metric of one eval for one model. A reported result that matches no
/// `Eval` or `Model` yet keeps the raw name, and the id is added later.
// MARK: - EvalResult
public struct EvalResult: Codable, Equatable, Sendable {
    /// Which way shows more skill. `neither` for behavior results. Left out: not known.
    public let capabilityDirection: Direction?
    public let ciHigh: Double?
    public let ciLow: Double?
    public let evalID: String?
    /// The run a `measured` result comes from.
    public let evalRunID: String?
    public let evalVersionID: String?
    public let extraction: ExtractionInfo?
    public let id: String
    /// A `MetricDef.key` when the version is known; else the source's words.
    public let metric: String
    public let modelID: String?
    /// The number of samples, when stated.
    public let n: Int?
    public let origin: ResultOrigin
    /// The eval's name as the source writes it (`SWE-bench Verified (n=500)`).
    public let rawEvalName: String?
    /// The model's name as the source writes it.
    public let rawModelName: String?
    public let reviewed: Bool
    /// Which way is better for safety. `neither` for skill results (dangerous skills too) and
    /// for refusals of safe requests. Left out: not known.
    public let safetyDirection: Direction?
    public let settings: ResultSettings
    public let source: ResultSource?
    public let stderr: Double?
    /// `percent` is 0-100 and `fraction` is 0-1. `score` is any other scale.
    public let unit: Unit?
    public let value: Double

    public enum CodingKeys: String, CodingKey {
        case capabilityDirection = "capabilityDirection"
        case ciHigh = "ciHigh"
        case ciLow = "ciLow"
        case evalID = "evalId"
        case evalRunID = "evalRunId"
        case evalVersionID = "evalVersionId"
        case extraction = "extraction"
        case id = "id"
        case metric = "metric"
        case modelID = "modelId"
        case n = "n"
        case origin = "origin"
        case rawEvalName = "rawEvalName"
        case rawModelName = "rawModelName"
        case reviewed = "reviewed"
        case safetyDirection = "safetyDirection"
        case settings = "settings"
        case source = "source"
        case stderr = "stderr"
        case unit = "unit"
        case value = "value"
    }

    public init(capabilityDirection: Direction?, ciHigh: Double?, ciLow: Double?, evalID: String?, evalRunID: String?, evalVersionID: String?, extraction: ExtractionInfo?, id: String, metric: String, modelID: String?, n: Int?, origin: ResultOrigin, rawEvalName: String?, rawModelName: String?, reviewed: Bool, safetyDirection: Direction?, settings: ResultSettings, source: ResultSource?, stderr: Double?, unit: Unit?, value: Double) {
        self.capabilityDirection = capabilityDirection
        self.ciHigh = ciHigh
        self.ciLow = ciLow
        self.evalID = evalID
        self.evalRunID = evalRunID
        self.evalVersionID = evalVersionID
        self.extraction = extraction
        self.id = id
        self.metric = metric
        self.modelID = modelID
        self.n = n
        self.origin = origin
        self.rawEvalName = rawEvalName
        self.rawModelName = rawModelName
        self.reviewed = reviewed
        self.safetyDirection = safetyDirection
        self.settings = settings
        self.source = source
        self.stderr = stderr
        self.unit = unit
        self.value = value
    }
}

// MARK: EvalResult convenience initializers and mutators

public extension EvalResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        capabilityDirection: Direction?? = nil,
        ciHigh: Double?? = nil,
        ciLow: Double?? = nil,
        evalID: String?? = nil,
        evalRunID: String?? = nil,
        evalVersionID: String?? = nil,
        extraction: ExtractionInfo?? = nil,
        id: String? = nil,
        metric: String? = nil,
        modelID: String?? = nil,
        n: Int?? = nil,
        origin: ResultOrigin? = nil,
        rawEvalName: String?? = nil,
        rawModelName: String?? = nil,
        reviewed: Bool? = nil,
        safetyDirection: Direction?? = nil,
        settings: ResultSettings? = nil,
        source: ResultSource?? = nil,
        stderr: Double?? = nil,
        unit: Unit?? = nil,
        value: Double? = nil
    ) -> EvalResult {
        return EvalResult(
            capabilityDirection: capabilityDirection ?? self.capabilityDirection,
            ciHigh: ciHigh ?? self.ciHigh,
            ciLow: ciLow ?? self.ciLow,
            evalID: evalID ?? self.evalID,
            evalRunID: evalRunID ?? self.evalRunID,
            evalVersionID: evalVersionID ?? self.evalVersionID,
            extraction: extraction ?? self.extraction,
            id: id ?? self.id,
            metric: metric ?? self.metric,
            modelID: modelID ?? self.modelID,
            n: n ?? self.n,
            origin: origin ?? self.origin,
            rawEvalName: rawEvalName ?? self.rawEvalName,
            rawModelName: rawModelName ?? self.rawModelName,
            reviewed: reviewed ?? self.reviewed,
            safetyDirection: safetyDirection ?? self.safetyDirection,
            settings: settings ?? self.settings,
            source: source ?? self.source,
            stderr: stderr ?? self.stderr,
            unit: unit ?? self.unit,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `reported`: from a document (give `source`). `measured`: from an `EvalRun`.
public enum ResultOrigin: String, Codable, Equatable, Sendable {
    case measured = "measured"
    case reported = "reported"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// How the number was made. Compare results only when these match. Left out: not stated.
// MARK: - ResultSettings
public struct ResultSettings: Codable, Equatable, Sendable {
    /// The scaffold or agent (`Claude Code`, `Terminus 2`).
    public let harness: String?
    /// A helpful-only model, without safety training.
    public let helpfulOnly: Bool?
    /// Anything else the source says about the setup.
    public let other: String?
    /// The judge and other models besides the target, as `slot: model` pairs (`judge:
    /// openai/gpt-4o`). Scores with different judges are not comparable.
    public let otherModels: String?
    public let passAtK: Int?
    /// The lab's words (`high`, `max`, `no thinking`).
    public let reasoningEffort: String?
    /// Production safeguards (classifiers) were on.
    public let safeguards: Bool?
    /// Where it ran (`API`, `ChatGPT`).
    public let surface: String?
    public let tools: Bool?
    public let trials: Int?

    public enum CodingKeys: String, CodingKey {
        case harness = "harness"
        case helpfulOnly = "helpfulOnly"
        case other = "other"
        case otherModels = "otherModels"
        case passAtK = "passAtK"
        case reasoningEffort = "reasoningEffort"
        case safeguards = "safeguards"
        case surface = "surface"
        case tools = "tools"
        case trials = "trials"
    }

    public init(harness: String?, helpfulOnly: Bool?, other: String?, otherModels: String?, passAtK: Int?, reasoningEffort: String?, safeguards: Bool?, surface: String?, tools: Bool?, trials: Int?) {
        self.harness = harness
        self.helpfulOnly = helpfulOnly
        self.other = other
        self.otherModels = otherModels
        self.passAtK = passAtK
        self.reasoningEffort = reasoningEffort
        self.safeguards = safeguards
        self.surface = surface
        self.tools = tools
        self.trials = trials
    }
}

// MARK: ResultSettings convenience initializers and mutators

public extension ResultSettings {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ResultSettings.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        harness: String?? = nil,
        helpfulOnly: Bool?? = nil,
        other: String?? = nil,
        otherModels: String?? = nil,
        passAtK: Int?? = nil,
        reasoningEffort: String?? = nil,
        safeguards: Bool?? = nil,
        surface: String?? = nil,
        tools: Bool?? = nil,
        trials: Int?? = nil
    ) -> ResultSettings {
        return ResultSettings(
            harness: harness ?? self.harness,
            helpfulOnly: helpfulOnly ?? self.helpfulOnly,
            other: other ?? self.other,
            otherModels: otherModels ?? self.otherModels,
            passAtK: passAtK ?? self.passAtK,
            reasoningEffort: reasoningEffort ?? self.reasoningEffort,
            safeguards: safeguards ?? self.safeguards,
            surface: surface ?? self.surface,
            tools: tools ?? self.tools,
            trials: trials ?? self.trials
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - ResultSource
public struct ResultSource: Codable, Equatable, Sendable {
    public let documentID: String
    /// The page or section, as printed in the document.
    public let page: String?
    /// The page in the document's saved PDF, from 1. Links go here.
    public let pdfPage: Int?
    public let quote: String?
    /// The table or figure (`Table 4`, `Figure 2.3.A`).
    public let table: String?

    public enum CodingKeys: String, CodingKey {
        case documentID = "documentId"
        case page = "page"
        case pdfPage = "pdfPage"
        case quote = "quote"
        case table = "table"
    }

    public init(documentID: String, page: String?, pdfPage: Int?, quote: String?, table: String?) {
        self.documentID = documentID
        self.page = page
        self.pdfPage = pdfPage
        self.quote = quote
        self.table = table
    }
}

// MARK: ResultSource convenience initializers and mutators

public extension ResultSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ResultSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        documentID: String? = nil,
        page: String?? = nil,
        pdfPage: Int?? = nil,
        quote: String?? = nil,
        table: String?? = nil
    ) -> ResultSource {
        return ResultSource(
            documentID: documentID ?? self.documentID,
            page: page ?? self.page,
            pdfPage: pdfPage ?? self.pdfPage,
            quote: quote ?? self.quote,
            table: table ?? self.table
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `percent` is 0-100 and `fraction` is 0-1. `score` is any other scale.
public enum Unit: String, Codable, Equatable, Sendable {
    case count = "count"
    case fraction = "fraction"
    case other = "other"
    case percent = "percent"
    case score = "score"
    case seconds = "seconds"
    case tokens = "tokens"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One run of an eval version on one model, with its settings and provenance. `measured`
/// results and attempts point to it.
// MARK: - EvalRun
public struct EvalRun: Codable, Equatable, Sendable {
    /// The attempts done so far.
    public let attemptCount: Int?
    public let createdAt: Date
    public let error: String?
    public let evalID: String
    public let evalVersionID: String
    public let id: String
    /// The original log (an Inspect `.eval`).
    public let log: FileRef?
    public let modelID: String
    public let origin: RunOrigin
    public let provenance: RunProvenance?
    public let route: ServingRoute
    /// The samples the run plans to do.
    public let sampleCount: Int?
    public let settings: RunSettings
    /// For a re-score, the run whose outputs it scores.
    public let sourceRunID: String?
    public let status: RunStatus
    public let visibility: Visibility

    public enum CodingKeys: String, CodingKey {
        case attemptCount = "attemptCount"
        case createdAt = "createdAt"
        case error = "error"
        case evalID = "evalId"
        case evalVersionID = "evalVersionId"
        case id = "id"
        case log = "log"
        case modelID = "modelId"
        case origin = "origin"
        case provenance = "provenance"
        case route = "route"
        case sampleCount = "sampleCount"
        case settings = "settings"
        case sourceRunID = "sourceRunId"
        case status = "status"
        case visibility = "visibility"
    }

    public init(attemptCount: Int?, createdAt: Date, error: String?, evalID: String, evalVersionID: String, id: String, log: FileRef?, modelID: String, origin: RunOrigin, provenance: RunProvenance?, route: ServingRoute, sampleCount: Int?, settings: RunSettings, sourceRunID: String?, status: RunStatus, visibility: Visibility) {
        self.attemptCount = attemptCount
        self.createdAt = createdAt
        self.error = error
        self.evalID = evalID
        self.evalVersionID = evalVersionID
        self.id = id
        self.log = log
        self.modelID = modelID
        self.origin = origin
        self.provenance = provenance
        self.route = route
        self.sampleCount = sampleCount
        self.settings = settings
        self.sourceRunID = sourceRunID
        self.status = status
        self.visibility = visibility
    }
}

// MARK: EvalRun convenience initializers and mutators

public extension EvalRun {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalRun.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        attemptCount: Int?? = nil,
        createdAt: Date? = nil,
        error: String?? = nil,
        evalID: String? = nil,
        evalVersionID: String? = nil,
        id: String? = nil,
        log: FileRef?? = nil,
        modelID: String? = nil,
        origin: RunOrigin? = nil,
        provenance: RunProvenance?? = nil,
        route: ServingRoute? = nil,
        sampleCount: Int?? = nil,
        settings: RunSettings? = nil,
        sourceRunID: String?? = nil,
        status: RunStatus? = nil,
        visibility: Visibility? = nil
    ) -> EvalRun {
        return EvalRun(
            attemptCount: attemptCount ?? self.attemptCount,
            createdAt: createdAt ?? self.createdAt,
            error: error ?? self.error,
            evalID: evalID ?? self.evalID,
            evalVersionID: evalVersionID ?? self.evalVersionID,
            id: id ?? self.id,
            log: log ?? self.log,
            modelID: modelID ?? self.modelID,
            origin: origin ?? self.origin,
            provenance: provenance ?? self.provenance,
            route: route ?? self.route,
            sampleCount: sampleCount ?? self.sampleCount,
            settings: settings ?? self.settings,
            sourceRunID: sourceRunID ?? self.sourceRunID,
            status: status ?? self.status,
            visibility: visibility ?? self.visibility
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// The original log (an Inspect `.eval`).
///
/// A file in our private storage.
///
/// The attempt's `Transcript` as JSON.
// MARK: - FileRef
public struct FileRef: Codable, Equatable, Sendable {
    public let bytes: Int
    /// The object key (`runs/<run id>/log.eval`).
    public let key: String
    public let sha256: String?

    public enum CodingKeys: String, CodingKey {
        case bytes = "bytes"
        case key = "key"
        case sha256 = "sha256"
    }

    public init(bytes: Int, key: String, sha256: String?) {
        self.bytes = bytes
        self.key = key
        self.sha256 = sha256
    }
}

// MARK: FileRef convenience initializers and mutators

public extension FileRef {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FileRef.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        bytes: Int? = nil,
        key: String? = nil,
        sha256: String?? = nil
    ) -> FileRef {
        return FileRef(
            bytes: bytes ?? self.bytes,
            key: key ?? self.key,
            sha256: sha256 ?? self.sha256
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `run`: our runner ran it. `import`: a log made elsewhere, imported. `rescore`: our runner
/// scored the outputs of `sourceRunId` again, with other scoring models.
public enum RunOrigin: String, Codable, Equatable, Sendable {
    case rescore = "rescore"
    case run = "run"
    case runOriginImport = "import"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Where and how the run happened.
// MARK: - RunProvenance
public struct RunProvenance: Codable, Equatable, Sendable {
    /// Model calls that a provider refused for its policy, by provider. A run that failed or was
    /// cancelled because of a block also has them.
    public let blocks: [ProviderBlock]?
    /// Tokens and cost for each model, by the name in the log.
    public let byModel: [String: ModelUsage]?
    /// Tokens and cost for each model role (`target`, `auditor`, `judge`, `judge_2`). A re-score
    /// has only its judges.
    public let byRole: [String: ModelUsage]?
    /// What this run paid, when the routes say. A re-score pays only its judges.
    public let costUsd: Double?
    /// Samples with an error and no score. The results leave them out.
    public let erroredSamples: Int?
    /// The calls that a slot's fallback models made in place of its model.
    public let fallbacks: [FallbackUse]?
    public let finishedAt: Date?
    /// The machine the runner ran on.
    public let host: String?
    /// The model as the log names it (`openrouter/qwen/qwen3.6-27b`).
    public let logModel: String?
    /// What a reader must know about an imported run, from the log (`eval.metadata.note`). The
    /// run and attempt pages show it.
    public let note: String?
    /// Package versions, as the log states them (`{"inspect_evals": "0.22.0"}`).
    public let packages: [String: String]?
    public let runnerVersion: String?
    /// The providers that served the model calls, as the route reported them.
    public let servedBy: [String]?
    public let startedAt: Date?
    /// The task as the log names it (`inspect_evals/truthfulqa`).
    public let task: String?
    public let taskArgs: [String: JSONAny]?
    public let tokens: TokenUsage?
    /// The program that ran the eval (`inspect_ai`).
    public let tool: String?
    public let toolVersion: String?

    public enum CodingKeys: String, CodingKey {
        case blocks = "blocks"
        case byModel = "byModel"
        case byRole = "byRole"
        case costUsd = "costUsd"
        case erroredSamples = "erroredSamples"
        case fallbacks = "fallbacks"
        case finishedAt = "finishedAt"
        case host = "host"
        case logModel = "logModel"
        case note = "note"
        case packages = "packages"
        case runnerVersion = "runnerVersion"
        case servedBy = "servedBy"
        case startedAt = "startedAt"
        case task = "task"
        case taskArgs = "taskArgs"
        case tokens = "tokens"
        case tool = "tool"
        case toolVersion = "toolVersion"
    }

    public init(blocks: [ProviderBlock]?, byModel: [String: ModelUsage]?, byRole: [String: ModelUsage]?, costUsd: Double?, erroredSamples: Int?, fallbacks: [FallbackUse]?, finishedAt: Date?, host: String?, logModel: String?, note: String?, packages: [String: String]?, runnerVersion: String?, servedBy: [String]?, startedAt: Date?, task: String?, taskArgs: [String: JSONAny]?, tokens: TokenUsage?, tool: String?, toolVersion: String?) {
        self.blocks = blocks
        self.byModel = byModel
        self.byRole = byRole
        self.costUsd = costUsd
        self.erroredSamples = erroredSamples
        self.fallbacks = fallbacks
        self.finishedAt = finishedAt
        self.host = host
        self.logModel = logModel
        self.note = note
        self.packages = packages
        self.runnerVersion = runnerVersion
        self.servedBy = servedBy
        self.startedAt = startedAt
        self.task = task
        self.taskArgs = taskArgs
        self.tokens = tokens
        self.tool = tool
        self.toolVersion = toolVersion
    }
}

// MARK: RunProvenance convenience initializers and mutators

public extension RunProvenance {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RunProvenance.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        blocks: [ProviderBlock]?? = nil,
        byModel: [String: ModelUsage]?? = nil,
        byRole: [String: ModelUsage]?? = nil,
        costUsd: Double?? = nil,
        erroredSamples: Int?? = nil,
        fallbacks: [FallbackUse]?? = nil,
        finishedAt: Date?? = nil,
        host: String?? = nil,
        logModel: String?? = nil,
        note: String?? = nil,
        packages: [String: String]?? = nil,
        runnerVersion: String?? = nil,
        servedBy: [String]?? = nil,
        startedAt: Date?? = nil,
        task: String?? = nil,
        taskArgs: [String: JSONAny]?? = nil,
        tokens: TokenUsage?? = nil,
        tool: String?? = nil,
        toolVersion: String?? = nil
    ) -> RunProvenance {
        return RunProvenance(
            blocks: blocks ?? self.blocks,
            byModel: byModel ?? self.byModel,
            byRole: byRole ?? self.byRole,
            costUsd: costUsd ?? self.costUsd,
            erroredSamples: erroredSamples ?? self.erroredSamples,
            fallbacks: fallbacks ?? self.fallbacks,
            finishedAt: finishedAt ?? self.finishedAt,
            host: host ?? self.host,
            logModel: logModel ?? self.logModel,
            note: note ?? self.note,
            packages: packages ?? self.packages,
            runnerVersion: runnerVersion ?? self.runnerVersion,
            servedBy: servedBy ?? self.servedBy,
            startedAt: startedAt ?? self.startedAt,
            task: task ?? self.task,
            taskArgs: taskArgs ?? self.taskArgs,
            tokens: tokens ?? self.tokens,
            tool: tool ?? self.tool,
            toolVersion: toolVersion ?? self.toolVersion
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Samples whose model calls a provider refused for its policy (not the model's own
/// refusal). These samples have no score.
// MARK: - ProviderBlock
public struct ProviderBlock: Codable, Equatable, Sendable {
    /// The provider's error code (`user_blocked`, `data_inspection_failed`).
    public let code: String?
    /// `account`: the provider blocked our account, so it refuses all calls. `content`: it
    /// refused these prompts only.
    public let kind: BlockKind
    public let message: String?
    /// The model of the refused calls, when the error names it.
    public let model: String?
    /// The provider that refused (`Meta`, `OpenAI`), or `unknown`.
    public let provider: String
    /// The samples with this block. Zero when the run stopped before its samples.
    public let samples: Int

    public enum CodingKeys: String, CodingKey {
        case code = "code"
        case kind = "kind"
        case message = "message"
        case model = "model"
        case provider = "provider"
        case samples = "samples"
    }

    public init(code: String?, kind: BlockKind, message: String?, model: String?, provider: String, samples: Int) {
        self.code = code
        self.kind = kind
        self.message = message
        self.model = model
        self.provider = provider
        self.samples = samples
    }
}

// MARK: ProviderBlock convenience initializers and mutators

public extension ProviderBlock {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ProviderBlock.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        code: String?? = nil,
        kind: BlockKind? = nil,
        message: String?? = nil,
        model: String?? = nil,
        provider: String? = nil,
        samples: Int? = nil
    ) -> ProviderBlock {
        return ProviderBlock(
            code: code ?? self.code,
            kind: kind ?? self.kind,
            message: message ?? self.message,
            model: model ?? self.model,
            provider: provider ?? self.provider,
            samples: samples ?? self.samples
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `account`: the provider blocked our account, so it refuses all calls. `content`: it
/// refused these prompts only.
public enum BlockKind: String, Codable, Equatable, Sendable {
    case account = "account"
    case content = "content"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - ModelUsage
public struct ModelUsage: Codable, Equatable, Sendable {
    /// The route did not state the cost; `costUsd` is list price times tokens.
    public let costEstimated: Bool?
    public let costUsd: Double?
    public let servedBy: [String]?
    public let tokens: TokenUsage?

    public enum CodingKeys: String, CodingKey {
        case costEstimated = "costEstimated"
        case costUsd = "costUsd"
        case servedBy = "servedBy"
        case tokens = "tokens"
    }

    public init(costEstimated: Bool?, costUsd: Double?, servedBy: [String]?, tokens: TokenUsage?) {
        self.costEstimated = costEstimated
        self.costUsd = costUsd
        self.servedBy = servedBy
        self.tokens = tokens
    }
}

// MARK: ModelUsage convenience initializers and mutators

public extension ModelUsage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ModelUsage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        costEstimated: Bool?? = nil,
        costUsd: Double?? = nil,
        servedBy: [String]?? = nil,
        tokens: TokenUsage?? = nil
    ) -> ModelUsage {
        return ModelUsage(
            costEstimated: costEstimated ?? self.costEstimated,
            costUsd: costUsd ?? self.costUsd,
            servedBy: servedBy ?? self.servedBy,
            tokens: tokens ?? self.tokens
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - TokenUsage
public struct TokenUsage: Codable, Equatable, Sendable {
    /// Input tokens read from the provider's prompt cache. Part of `input`.
    public let cacheRead: Int?
    /// Input tokens written to the provider's prompt cache. Part of `input`.
    public let cacheWrite: Int?
    public let input: Int?
    public let output: Int?
    /// Part of `output`.
    public let reasoning: Int?

    public enum CodingKeys: String, CodingKey {
        case cacheRead = "cacheRead"
        case cacheWrite = "cacheWrite"
        case input = "input"
        case output = "output"
        case reasoning = "reasoning"
    }

    public init(cacheRead: Int?, cacheWrite: Int?, input: Int?, output: Int?, reasoning: Int?) {
        self.cacheRead = cacheRead
        self.cacheWrite = cacheWrite
        self.input = input
        self.output = output
        self.reasoning = reasoning
    }
}

// MARK: TokenUsage convenience initializers and mutators

public extension TokenUsage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TokenUsage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        cacheRead: Int?? = nil,
        cacheWrite: Int?? = nil,
        input: Int?? = nil,
        output: Int?? = nil,
        reasoning: Int?? = nil
    ) -> TokenUsage {
        return TokenUsage(
            cacheRead: cacheRead ?? self.cacheRead,
            cacheWrite: cacheWrite ?? self.cacheWrite,
            input: input ?? self.input,
            output: output ?? self.output,
            reasoning: reasoning ?? self.reasoning
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - FallbackUse
public struct FallbackUse: Codable, Equatable, Sendable {
    public let calls: Int
    public let model: String
    public let slot: String

    public enum CodingKeys: String, CodingKey {
        case calls = "calls"
        case model = "model"
        case slot = "slot"
    }

    public init(calls: Int, model: String, slot: String) {
        self.calls = calls
        self.model = model
        self.slot = slot
    }
}

// MARK: FallbackUse convenience initializers and mutators

public extension FallbackUse {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(FallbackUse.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        calls: Int? = nil,
        model: String? = nil,
        slot: String? = nil
    ) -> FallbackUse {
        return FallbackUse(
            calls: calls ?? self.calls,
            model: model ?? self.model,
            slot: slot ?? self.slot
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// How a run reached the model. Provenance and a filter; not a change to the model.
// MARK: - ServingRoute
public struct ServingRoute: Codable, Equatable, Sendable {
    public let allowFallbacks: Bool?
    /// For a slot: other models to try, in order, when this model fails a call or refuses it (an
    /// error, a content filter or an empty reply).
    public let fallbacks: [String]?
    public let kind: RouteKind
    /// The model id on the route (`qwen/qwen3.6-27b`).
    public let model: String
    /// The providers the router may use, in order (OpenRouter `provider.order`).
    public let providers: [String]?
    /// The weights' precision as the route states it (`bf16`, `fp8`, `unknown`).
    public let quantization: String?

    public enum CodingKeys: String, CodingKey {
        case allowFallbacks = "allowFallbacks"
        case fallbacks = "fallbacks"
        case kind = "kind"
        case model = "model"
        case providers = "providers"
        case quantization = "quantization"
    }

    public init(allowFallbacks: Bool?, fallbacks: [String]?, kind: RouteKind, model: String, providers: [String]?, quantization: String?) {
        self.allowFallbacks = allowFallbacks
        self.fallbacks = fallbacks
        self.kind = kind
        self.model = model
        self.providers = providers
        self.quantization = quantization
    }
}

// MARK: ServingRoute convenience initializers and mutators

public extension ServingRoute {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ServingRoute.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        allowFallbacks: Bool?? = nil,
        fallbacks: [String]?? = nil,
        kind: RouteKind? = nil,
        model: String? = nil,
        providers: [String]?? = nil,
        quantization: String?? = nil
    ) -> ServingRoute {
        return ServingRoute(
            allowFallbacks: allowFallbacks ?? self.allowFallbacks,
            fallbacks: fallbacks ?? self.fallbacks,
            kind: kind ?? self.kind,
            model: model ?? self.model,
            providers: providers ?? self.providers,
            quantization: quantization ?? self.quantization
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// How the target model was served. `direct`: the lab's own API. `openrouter`, `bedrock`,
/// `vertex`, `azure`: that router or cloud. `engine`: our interp-engine server.
public enum RouteKind: String, Codable, Equatable, Sendable {
    case azure = "azure"
    case bedrock = "bedrock"
    case direct = "direct"
    case engine = "engine"
    case openrouter = "openrouter"
    case vertex = "vertex"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// What the runner was asked to do. Left out: the task's default.
// MARK: - RunSettings
public struct RunSettings: Codable, Equatable, Sendable {
    /// The `runner_cap` key for the run's shards, for one cap per model server. Left out: from
    /// the route.
    public let capKey: String?
    public let epochs: Int?
    /// Run only the first samples of the dataset.
    public let limit: Int?
    /// Parallel model calls in each shard.
    public let maxConnections: Int?
    public let maxTokens: Int?
    /// The model for each slot in the version's `runner.models`, by slot id.
    public let models: [String: ServingRoute]?
    /// Thinking effort, in OpenRouter's words. `none`: no thinking. `on`: thinking at the
    /// model's default, for models with no effort levels.
    public let reasoning: Reasoning?
    /// Samples in each shard. Left out, the runner's default.
    public let shardSize: Int?
    /// Arguments for the task (`{"target": "mc1"}`).
    public let taskArgs: [String: JSONAny]?
    public let temperature: Double?

    public enum CodingKeys: String, CodingKey {
        case capKey = "capKey"
        case epochs = "epochs"
        case limit = "limit"
        case maxConnections = "maxConnections"
        case maxTokens = "maxTokens"
        case models = "models"
        case reasoning = "reasoning"
        case shardSize = "shardSize"
        case taskArgs = "taskArgs"
        case temperature = "temperature"
    }

    public init(capKey: String?, epochs: Int?, limit: Int?, maxConnections: Int?, maxTokens: Int?, models: [String: ServingRoute]?, reasoning: Reasoning?, shardSize: Int?, taskArgs: [String: JSONAny]?, temperature: Double?) {
        self.capKey = capKey
        self.epochs = epochs
        self.limit = limit
        self.maxConnections = maxConnections
        self.maxTokens = maxTokens
        self.models = models
        self.reasoning = reasoning
        self.shardSize = shardSize
        self.taskArgs = taskArgs
        self.temperature = temperature
    }
}

// MARK: RunSettings convenience initializers and mutators

public extension RunSettings {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RunSettings.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        capKey: String?? = nil,
        epochs: Int?? = nil,
        limit: Int?? = nil,
        maxConnections: Int?? = nil,
        maxTokens: Int?? = nil,
        models: [String: ServingRoute]?? = nil,
        reasoning: Reasoning?? = nil,
        shardSize: Int?? = nil,
        taskArgs: [String: JSONAny]?? = nil,
        temperature: Double?? = nil
    ) -> RunSettings {
        return RunSettings(
            capKey: capKey ?? self.capKey,
            epochs: epochs ?? self.epochs,
            limit: limit ?? self.limit,
            maxConnections: maxConnections ?? self.maxConnections,
            maxTokens: maxTokens ?? self.maxTokens,
            models: models ?? self.models,
            reasoning: reasoning ?? self.reasoning,
            shardSize: shardSize ?? self.shardSize,
            taskArgs: taskArgs ?? self.taskArgs,
            temperature: temperature ?? self.temperature
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Thinking effort, in OpenRouter's words. `none`: no thinking. `on`: thinking at the
/// model's default, for models with no effort levels.
public enum Reasoning: String, Codable, Equatable, Sendable {
    case high = "high"
    case low = "low"
    case max = "max"
    case medium = "medium"
    case minimal = "minimal"
    case none = "none"
    case on = "on"
    case xhigh = "xhigh"
}

/// `requested`: a user asked for it; it waits for an admin to approve it. `queued`: waits
/// for a runner. `running`: a runner has it. `importing`: the log is being saved.
/// `succeeded`, `failed`, `cancelled`: done.
public enum RunStatus: String, Codable, Equatable, Sendable {
    case cancelled = "cancelled"
    case failed = "failed"
    case importing = "importing"
    case queued = "queued"
    case requested = "requested"
    case running = "running"
    case succeeded = "succeeded"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One sample in one epoch of a run: a short copy of the input and output for lists, the
/// scores, and the full transcript in `body`.
// MARK: - EvalAttempt
public struct EvalAttempt: Codable, Equatable, Sendable {
    /// The attempt's `Transcript` as JSON.
    public let body: FileRef?
    public let choices: [String]?
    /// A subset rule that matched this sample. Left out, the version's rule applies.
    public let display: DisplayRule?
    public let epoch: Int
    public let error: String?
    /// The stored `EvalSample`, when we keep the samples.
    public let evalSampleID: String?
    /// Set from the dataset's labels when the eval graded the reply unsafe. Left out, open.
    public let hazard: Hazard?
    public let id: String
    /// The first user message, shortened.
    public let input: String?
    /// The keys of the metrics over a part of the samples (a category or group) that count this
    /// attempt, such as `harm_score_copyright`.
    public let metrics: [String]?
    /// Why the attempt has no scores, from the sample's `notScored` metadata.
    public let notScored: String?
    /// The attempt's place in the log, from 1. URLs use it.
    public let ordinal: Int
    /// The final answer, shortened.
    public let output: String?
    /// The headline score is correct. Left out when the score is not pass or fail.
    public let passed: Bool?
    public let runID: String
    /// The sample's id in the log.
    public let sampleID: String
    /// By scorer name.
    public let scores: [String: AttemptScore]
    public let seconds: Double?
    public let status: AttemptStatus
    public let target: Target?
    public let tokens: TokenUsage?

    public enum CodingKeys: String, CodingKey {
        case body = "body"
        case choices = "choices"
        case display = "display"
        case epoch = "epoch"
        case error = "error"
        case evalSampleID = "evalSampleId"
        case hazard = "hazard"
        case id = "id"
        case input = "input"
        case metrics = "metrics"
        case notScored = "notScored"
        case ordinal = "ordinal"
        case output = "output"
        case passed = "passed"
        case runID = "runId"
        case sampleID = "sampleId"
        case scores = "scores"
        case seconds = "seconds"
        case status = "status"
        case target = "target"
        case tokens = "tokens"
    }

    public init(body: FileRef?, choices: [String]?, display: DisplayRule?, epoch: Int, error: String?, evalSampleID: String?, hazard: Hazard?, id: String, input: String?, metrics: [String]?, notScored: String?, ordinal: Int, output: String?, passed: Bool?, runID: String, sampleID: String, scores: [String: AttemptScore], seconds: Double?, status: AttemptStatus, target: Target?, tokens: TokenUsage?) {
        self.body = body
        self.choices = choices
        self.display = display
        self.epoch = epoch
        self.error = error
        self.evalSampleID = evalSampleID
        self.hazard = hazard
        self.id = id
        self.input = input
        self.metrics = metrics
        self.notScored = notScored
        self.ordinal = ordinal
        self.output = output
        self.passed = passed
        self.runID = runID
        self.sampleID = sampleID
        self.scores = scores
        self.seconds = seconds
        self.status = status
        self.target = target
        self.tokens = tokens
    }
}

// MARK: EvalAttempt convenience initializers and mutators

public extension EvalAttempt {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(EvalAttempt.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        body: FileRef?? = nil,
        choices: [String]?? = nil,
        display: DisplayRule?? = nil,
        epoch: Int? = nil,
        error: String?? = nil,
        evalSampleID: String?? = nil,
        hazard: Hazard?? = nil,
        id: String? = nil,
        input: String?? = nil,
        metrics: [String]?? = nil,
        notScored: String?? = nil,
        ordinal: Int? = nil,
        output: String?? = nil,
        passed: Bool?? = nil,
        runID: String? = nil,
        sampleID: String? = nil,
        scores: [String: AttemptScore]? = nil,
        seconds: Double?? = nil,
        status: AttemptStatus? = nil,
        target: Target?? = nil,
        tokens: TokenUsage?? = nil
    ) -> EvalAttempt {
        return EvalAttempt(
            body: body ?? self.body,
            choices: choices ?? self.choices,
            display: display ?? self.display,
            epoch: epoch ?? self.epoch,
            error: error ?? self.error,
            evalSampleID: evalSampleID ?? self.evalSampleID,
            hazard: hazard ?? self.hazard,
            id: id ?? self.id,
            input: input ?? self.input,
            metrics: metrics ?? self.metrics,
            notScored: notScored ?? self.notScored,
            ordinal: ordinal ?? self.ordinal,
            output: output ?? self.output,
            passed: passed ?? self.passed,
            runID: runID ?? self.runID,
            sampleID: sampleID ?? self.sampleID,
            scores: scores ?? self.scores,
            seconds: seconds ?? self.seconds,
            status: status ?? self.status,
            target: target ?? self.target,
            tokens: tokens ?? self.tokens
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Set from the dataset's labels when the eval graded the reply unsafe. Left out, open.
///
/// Who can read a reply that can give dangerous help. `gated`: anyone, but no public share
/// (J-Lens). `restricted`: staff. `withheld`: nobody on the site. The prompt, target and
/// scores stay open.
public enum Hazard: String, Codable, Equatable, Sendable {
    case gated = "gated"
    case restricted = "restricted"
    case withheld = "withheld"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One scorer's grade of an attempt, as Inspect's `Score`.
// MARK: - AttemptScore
public struct AttemptScore: Codable, Equatable, Sendable {
    /// The answer the scorer read from the output.
    public let answer: String?
    public let explanation: String?
    /// A number, a letter (`C` correct, `I` incorrect), or a yes/no.
    public let value: Value

    public enum CodingKeys: String, CodingKey {
        case answer = "answer"
        case explanation = "explanation"
        case value = "value"
    }

    public init(answer: String?, explanation: String?, value: Value) {
        self.answer = answer
        self.explanation = explanation
        self.value = value
    }
}

// MARK: AttemptScore convenience initializers and mutators

public extension AttemptScore {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(AttemptScore.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        answer: String?? = nil,
        explanation: String?? = nil,
        value: Value? = nil
    ) -> AttemptScore {
        return AttemptScore(
            answer: answer ?? self.answer,
            explanation: explanation ?? self.explanation,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum Value: Codable, Equatable, Sendable {
    case bool(Bool)
    case double(Double)
    case string(String)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let x = try? container.decode(Bool.self) {
            self = .bool(x)
            return
        }
        if let x = try? container.decode(Double.self) {
            self = .double(x)
            return
        }
        if let x = try? container.decode(String.self) {
            self = .string(x)
            return
        }
        throw DecodingError.typeMismatch(Value.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for Value"))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let x):
            try container.encode(x)
        case .double(let x):
            try container.encode(x)
        case .string(let x):
            try container.encode(x)
        }
    }
}

public enum AttemptStatus: String, Codable, Equatable, Sendable {
    case error = "error"
    case success = "success"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// The messages of one attempt or chat. Scores stay on the attempt. `extensions` keeps
/// source fields we do not map (`extensions.inspect`).
// MARK: - Transcript
public struct Transcript: Codable, Equatable, Sendable {
    public let extensions: [String: JSONAny]?
    public let id: String
    public let participants: [Participant]
    public let threads: [Thread]

    public enum CodingKeys: String, CodingKey {
        case extensions = "extensions"
        case id = "id"
        case participants = "participants"
        case threads = "threads"
    }

    public init(extensions: [String: JSONAny]?, id: String, participants: [Participant], threads: [Thread]) {
        self.extensions = extensions
        self.id = id
        self.participants = participants
        self.threads = threads
    }
}

// MARK: Transcript convenience initializers and mutators

public extension Transcript {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Transcript.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        extensions: [String: JSONAny]?? = nil,
        id: String? = nil,
        participants: [Participant]? = nil,
        threads: [Thread]? = nil
    ) -> Transcript {
        return Transcript(
            extensions: extensions ?? self.extensions,
            id: id ?? self.id,
            participants: participants ?? self.participants,
            threads: threads ?? self.threads
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - Participant
public struct Participant: Codable, Equatable, Sendable {
    public let id: String
    public let modelID: String?
    /// The model or person as the source names it.
    public let name: String?
    public let role: ModelRole

    public enum CodingKeys: String, CodingKey {
        case id = "id"
        case modelID = "modelId"
        case name = "name"
        case role = "role"
    }

    public init(id: String, modelID: String?, name: String?, role: ModelRole) {
        self.id = id
        self.modelID = modelID
        self.name = name
        self.role = role
    }
}

// MARK: Participant convenience initializers and mutators

public extension Participant {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Participant.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: String? = nil,
        modelID: String?? = nil,
        name: String?? = nil,
        role: ModelRole? = nil
    ) -> Participant {
        return Participant(
            id: id ?? self.id,
            modelID: modelID ?? self.modelID,
            name: name ?? self.name,
            role: role ?? self.role
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One participant's ordered view of the conversation.
// MARK: - Thread
public struct Thread: Codable, Equatable, Sendable {
    public let id: String
    public let messages: [Message]
    /// A `Participant.id`.
    public let participant: String

    public enum CodingKeys: String, CodingKey {
        case id = "id"
        case messages = "messages"
        case participant = "participant"
    }

    public init(id: String, messages: [Message], participant: String) {
        self.id = id
        self.messages = messages
        self.participant = participant
    }
}

// MARK: Thread convenience initializers and mutators

public extension Thread {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Thread.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: String? = nil,
        messages: [Message]? = nil,
        participant: String? = nil
    ) -> Thread {
        return Thread(
            id: id ?? self.id,
            messages: messages ?? self.messages,
            participant: participant ?? self.participant
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One chat message. A superset of Inspect's and OpenAI's shape.
// MARK: - Message
public struct Message: Codable, Equatable, Sendable {
    public let content: [ContentPart]
    /// Stable, so notes and links survive import and export.
    public let id: String
    /// For an `assistant` message, the model that wrote it.
    public let model: String?
    public let role: Role
    /// For a `tool` message, the call it answers.
    public let toolCallID: String?
    public let toolCalls: [ToolCall]?

    public enum CodingKeys: String, CodingKey {
        case content = "content"
        case id = "id"
        case model = "model"
        case role = "role"
        case toolCallID = "toolCallId"
        case toolCalls = "toolCalls"
    }

    public init(content: [ContentPart], id: String, model: String?, role: Role, toolCallID: String?, toolCalls: [ToolCall]?) {
        self.content = content
        self.id = id
        self.model = model
        self.role = role
        self.toolCallID = toolCallID
        self.toolCalls = toolCalls
    }
}

// MARK: Message convenience initializers and mutators

public extension Message {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Message.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        content: [ContentPart]? = nil,
        id: String? = nil,
        model: String?? = nil,
        role: Role? = nil,
        toolCallID: String?? = nil,
        toolCalls: [ToolCall]?? = nil
    ) -> Message {
        return Message(
            content: content ?? self.content,
            id: id ?? self.id,
            model: model ?? self.model,
            role: role ?? self.role,
            toolCallID: toolCallID ?? self.toolCallID,
            toolCalls: toolCalls ?? self.toolCalls
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A part we do not show yet (an image, audio); the original log keeps it.
// MARK: - ContentPart
public struct ContentPart: Codable, Equatable, Sendable {
    public let text: String?
    public let type: TypeEnum
    public let kind: String?
    /// The provider's opaque blob, kept so the transcript can continue there.
    public let signature: String?

    public enum CodingKeys: String, CodingKey {
        case text = "text"
        case type = "type"
        case kind = "kind"
        case signature = "signature"
    }

    public init(text: String?, type: TypeEnum, kind: String?, signature: String?) {
        self.text = text
        self.type = type
        self.kind = kind
        self.signature = signature
    }
}

// MARK: ContentPart convenience initializers and mutators

public extension ContentPart {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ContentPart.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String?? = nil,
        type: TypeEnum? = nil,
        kind: String?? = nil,
        signature: String?? = nil
    ) -> ContentPart {
        return ContentPart(
            text: text ?? self.text,
            type: type ?? self.type,
            kind: kind ?? self.kind,
            signature: signature ?? self.signature
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum TypeEnum: String, Codable, Equatable, Sendable {
    case other = "other"
    case reasoning = "reasoning"
    case text = "text"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - ToolCall
public struct ToolCall: Codable, Equatable, Sendable {
    public let arguments: [String: JSONAny]?
    public let function: String
    public let id: String

    public enum CodingKeys: String, CodingKey {
        case arguments = "arguments"
        case function = "function"
        case id = "id"
    }

    public init(arguments: [String: JSONAny]?, function: String, id: String) {
        self.arguments = arguments
        self.function = function
        self.id = id
    }
}

// MARK: ToolCall convenience initializers and mutators

public extension ToolCall {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ToolCall.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        arguments: [String: JSONAny]?? = nil,
        function: String? = nil,
        id: String? = nil
    ) -> ToolCall {
        return ToolCall(
            arguments: arguments ?? self.arguments,
            function: function ?? self.function,
            id: id ?? self.id
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One version of a model's OpenAudit Card: our summary from our own eval runs only. An LLM
/// (`aggregator`) writes it from the runs' results and the flagged snippets.
// MARK: - OpenAuditCardVersion
public struct OpenAuditCardVersion: Codable, Equatable, Sendable {
    /// The model that wrote it (`anthropic/claude-sonnet-5.5`).
    public let aggregator: String
    public let costUsd: Double
    public let createdAt: Date
    public let findings: [CardFinding]
    public let gaps: [CoverageGap]
    public let id: String
    public let modelID: String
    public let number: Int
    public let promptVersion: String
    public let runs: [CardRun]
    public let snippetIDS: [String]
    public let topics: [TopicSummary]
    public let verdicts: [RiskVerdict]

    public enum CodingKeys: String, CodingKey {
        case aggregator = "aggregator"
        case costUsd = "costUsd"
        case createdAt = "createdAt"
        case findings = "findings"
        case gaps = "gaps"
        case id = "id"
        case modelID = "modelId"
        case number = "number"
        case promptVersion = "promptVersion"
        case runs = "runs"
        case snippetIDS = "snippetIds"
        case topics = "topics"
        case verdicts = "verdicts"
    }

    public init(aggregator: String, costUsd: Double, createdAt: Date, findings: [CardFinding], gaps: [CoverageGap], id: String, modelID: String, number: Int, promptVersion: String, runs: [CardRun], snippetIDS: [String], topics: [TopicSummary], verdicts: [RiskVerdict]) {
        self.aggregator = aggregator
        self.costUsd = costUsd
        self.createdAt = createdAt
        self.findings = findings
        self.gaps = gaps
        self.id = id
        self.modelID = modelID
        self.number = number
        self.promptVersion = promptVersion
        self.runs = runs
        self.snippetIDS = snippetIDS
        self.topics = topics
        self.verdicts = verdicts
    }
}

// MARK: OpenAuditCardVersion convenience initializers and mutators

public extension OpenAuditCardVersion {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OpenAuditCardVersion.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        aggregator: String? = nil,
        costUsd: Double? = nil,
        createdAt: Date? = nil,
        findings: [CardFinding]? = nil,
        gaps: [CoverageGap]? = nil,
        id: String? = nil,
        modelID: String? = nil,
        number: Int? = nil,
        promptVersion: String? = nil,
        runs: [CardRun]? = nil,
        snippetIDS: [String]? = nil,
        topics: [TopicSummary]? = nil,
        verdicts: [RiskVerdict]? = nil
    ) -> OpenAuditCardVersion {
        return OpenAuditCardVersion(
            aggregator: aggregator ?? self.aggregator,
            costUsd: costUsd ?? self.costUsd,
            createdAt: createdAt ?? self.createdAt,
            findings: findings ?? self.findings,
            gaps: gaps ?? self.gaps,
            id: id ?? self.id,
            modelID: modelID ?? self.modelID,
            number: number ?? self.number,
            promptVersion: promptVersion ?? self.promptVersion,
            runs: runs ?? self.runs,
            snippetIDS: snippetIDS ?? self.snippetIDS,
            topics: topics ?? self.topics,
            verdicts: verdicts ?? self.verdicts
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One notable finding, in Markdown. It names the runs (and snippets) it rests on.
// MARK: - CardFinding
public struct CardFinding: Codable, Equatable, Sendable {
    public let runIDS: [String]
    public let snippetIDS: [String]?
    public let text: String
    public let tone: FindingTone

    public enum CodingKeys: String, CodingKey {
        case runIDS = "runIds"
        case snippetIDS = "snippetIds"
        case text = "text"
        case tone = "tone"
    }

    public init(runIDS: [String], snippetIDS: [String]?, text: String, tone: FindingTone) {
        self.runIDS = runIDS
        self.snippetIDS = snippetIDS
        self.text = text
        self.tone = tone
    }
}

// MARK: CardFinding convenience initializers and mutators

public extension CardFinding {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CardFinding.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        runIDS: [String]? = nil,
        snippetIDS: [String]?? = nil,
        text: String? = nil,
        tone: FindingTone? = nil
    ) -> CardFinding {
        return CardFinding(
            runIDS: runIDS ?? self.runIDS,
            snippetIDS: snippetIDS ?? self.snippetIDS,
            text: text ?? self.text,
            tone: tone ?? self.tone
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A topic or a risk that our runs do not cover, or cover only weakly.
// MARK: - CoverageGap
public struct CoverageGap: Codable, Equatable, Sendable {
    public let coverage: Coverage
    /// A `Topic` or a `SystemicRisk`.
    public let key: String
    public let kind: GapKind
    public let text: String

    public enum CodingKeys: String, CodingKey {
        case coverage = "coverage"
        case key = "key"
        case kind = "kind"
        case text = "text"
    }

    public init(coverage: Coverage, key: String, kind: GapKind, text: String) {
        self.coverage = coverage
        self.key = key
        self.kind = kind
        self.text = text
    }
}

// MARK: CoverageGap convenience initializers and mutators

public extension CoverageGap {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CoverageGap.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        coverage: Coverage? = nil,
        key: String? = nil,
        kind: GapKind? = nil,
        text: String? = nil
    ) -> CoverageGap {
        return CoverageGap(
            coverage: coverage ?? self.coverage,
            key: key ?? self.key,
            kind: kind ?? self.kind,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum Coverage: String, Codable, Equatable, Sendable {
    case coverageWeak = "weak"
    case none = "none"
}

public enum GapKind: String, Codable, Equatable, Sendable {
    case risk = "risk"
    case topic = "topic"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One run a version used, and its eval version.
// MARK: - CardRun
public struct CardRun: Codable, Equatable, Sendable {
    public let evalVersionID: String
    public let runID: String

    public enum CodingKeys: String, CodingKey {
        case evalVersionID = "evalVersionId"
        case runID = "runId"
    }

    public init(evalVersionID: String, runID: String) {
        self.evalVersionID = evalVersionID
        self.runID = runID
    }
}

// MARK: CardRun convenience initializers and mutators

public extension CardRun {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CardRun.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        evalVersionID: String? = nil,
        runID: String? = nil
    ) -> CardRun {
        return CardRun(
            evalVersionID: evalVersionID ?? self.evalVersionID,
            runID: runID ?? self.runID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// What our runs show for one topic. `summary` is left out when no run covers it.
// MARK: - TopicSummary
public struct TopicSummary: Codable, Equatable, Sendable {
    public let coverage: CoverageLevel
    public let runIDS: [String]
    public let summary: String?
    public let topic: Topic

    public enum CodingKeys: String, CodingKey {
        case coverage = "coverage"
        case runIDS = "runIds"
        case summary = "summary"
        case topic = "topic"
    }

    public init(coverage: CoverageLevel, runIDS: [String], summary: String?, topic: Topic) {
        self.coverage = coverage
        self.runIDS = runIDS
        self.summary = summary
        self.topic = topic
    }
}

// MARK: TopicSummary convenience initializers and mutators

public extension TopicSummary {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(TopicSummary.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        coverage: CoverageLevel? = nil,
        runIDS: [String]? = nil,
        summary: String?? = nil,
        topic: Topic? = nil
    ) -> TopicSummary {
        return TopicSummary(
            coverage: coverage ?? self.coverage,
            runIDS: runIDS ?? self.runIDS,
            summary: summary ?? self.summary,
            topic: topic ?? self.topic
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// How well our runs cover a topic or a risk. `none`, `weak` (few samples or one narrow
/// eval), `some`, `good`.
public enum CoverageLevel: String, Codable, Equatable, Sendable {
    case coverageLevelWeak = "weak"
    case good = "good"
    case none = "none"
    case some = "some"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// Our verdict on one systemic risk. `evidence` is the runs it rests on; `missing` says what
/// no run covers yet.
// MARK: - RiskVerdict
public struct RiskVerdict: Codable, Equatable, Sendable {
    public let coverage: CoverageLevel
    public let level: VerdictLevel
    /// The parts of the risk that no run covers.
    public let missing: String
    public let risk: SystemicRisk
    public let runIDS: [String]
    /// Markdown. What the evidence shows, and how strong it is.
    public let summary: String

    public enum CodingKeys: String, CodingKey {
        case coverage = "coverage"
        case level = "level"
        case missing = "missing"
        case risk = "risk"
        case runIDS = "runIds"
        case summary = "summary"
    }

    public init(coverage: CoverageLevel, level: VerdictLevel, missing: String, risk: SystemicRisk, runIDS: [String], summary: String) {
        self.coverage = coverage
        self.level = level
        self.missing = missing
        self.risk = risk
        self.runIDS = runIDS
        self.summary = summary
    }
}

// MARK: RiskVerdict convenience initializers and mutators

public extension RiskVerdict {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(RiskVerdict.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        coverage: CoverageLevel? = nil,
        level: VerdictLevel? = nil,
        missing: String? = nil,
        risk: SystemicRisk? = nil,
        runIDS: [String]? = nil,
        summary: String? = nil
    ) -> RiskVerdict {
        return RiskVerdict(
            coverage: coverage ?? self.coverage,
            level: level ?? self.level,
            missing: missing ?? self.missing,
            risk: risk ?? self.risk,
            runIDS: runIDS ?? self.runIDS,
            summary: summary ?? self.summary
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Our level for one risk, from our eval runs only. It is not the Code's risk tier and not a
/// legal finding. `not_enough_evidence`: no eval run, or too few samples, covers the risk.
/// `no_evidence`: the runs that cover the risk show no sign of it. `low`, `moderate`,
/// `high`: the runs show signs of the risk, from small to strong.
public enum VerdictLevel: String, Codable, Equatable, Sendable {
    case high = "high"
    case low = "low"
    case moderate = "moderate"
    case noEvidence = "no_evidence"
    case notEnoughEvidence = "not_enough_evidence"
}

/// A specified systemic risk of the EU General-Purpose AI Code of Practice, Safety and
/// Security chapter, Appendix 1.4. `cbrn`: chemical, biological, radiological and nuclear.
/// `cyber_offence`: large-scale cyber-attacks. `loss_of_control`: people can no longer
/// direct, change or shut down the model. `harmful_manipulation`: strategic distortion of
/// beliefs or behavior of many people or of high-stakes decision-makers.
public enum SystemicRisk: String, Codable, Equatable, Sendable {
    case cbrn = "cbrn"
    case cyberOffence = "cyber_offence"
    case harmfulManipulation = "harmful_manipulation"
    case lossOfControl = "loss_of_control"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One case that the flagger model marked in one attempt of a run.
// MARK: - OpenAuditSnippet
public struct OpenAuditSnippet: Codable, Equatable, Sendable {
    public let attemptID: String
    public let category: SnippetCategory
    public let excerpt: SnippetExcerpt
    public let flagger: String
    public let id: String
    public let promptVersion: String
    /// One or two sentences.
    public let reason: String
    public let runID: String
    public let severity: SnippetSeverity
    /// The problem in 1 to 3 words, for example "Copyright violation". Older snippets have none.
    public let title: String?

    public enum CodingKeys: String, CodingKey {
        case attemptID = "attemptId"
        case category = "category"
        case excerpt = "excerpt"
        case flagger = "flagger"
        case id = "id"
        case promptVersion = "promptVersion"
        case reason = "reason"
        case runID = "runId"
        case severity = "severity"
        case title = "title"
    }

    public init(attemptID: String, category: SnippetCategory, excerpt: SnippetExcerpt, flagger: String, id: String, promptVersion: String, reason: String, runID: String, severity: SnippetSeverity, title: String?) {
        self.attemptID = attemptID
        self.category = category
        self.excerpt = excerpt
        self.flagger = flagger
        self.id = id
        self.promptVersion = promptVersion
        self.reason = reason
        self.runID = runID
        self.severity = severity
        self.title = title
    }
}

// MARK: OpenAuditSnippet convenience initializers and mutators

public extension OpenAuditSnippet {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OpenAuditSnippet.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        attemptID: String? = nil,
        category: SnippetCategory? = nil,
        excerpt: SnippetExcerpt? = nil,
        flagger: String? = nil,
        id: String? = nil,
        promptVersion: String? = nil,
        reason: String? = nil,
        runID: String? = nil,
        severity: SnippetSeverity? = nil,
        title: String?? = nil
    ) -> OpenAuditSnippet {
        return OpenAuditSnippet(
            attemptID: attemptID ?? self.attemptID,
            category: category ?? self.category,
            excerpt: excerpt ?? self.excerpt,
            flagger: flagger ?? self.flagger,
            id: id ?? self.id,
            promptVersion: promptVersion ?? self.promptVersion,
            reason: reason ?? self.reason,
            runID: runID ?? self.runID,
            severity: severity ?? self.severity,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// The topic (an eval `Topic`) of the AI's act, or `other`. Topics about the test, not an
/// act in one transcript, are not in the list.
public enum SnippetCategory: String, Codable, Equatable, Sendable {
    case agenticMisuse = "agentic_misuse"
    case bias = "bias"
    case bioChem = "bio_chem"
    case childSafety = "child_safety"
    case cyber = "cyber"
    case hallucination = "hallucination"
    case harmfulRequests = "harmful_requests"
    case honesty = "honesty"
    case manipulation = "manipulation"
    case other = "other"
    case powerSeeking = "power_seeking"
    case promptInjection = "prompt_injection"
    case rewardHacking = "reward_hacking"
    case sabotage = "sabotage"
    case selfHarm = "self_harm"
    case sycophancy = "sycophancy"
    case toxicity = "toxicity"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - SnippetExcerpt
public struct SnippetExcerpt: Codable, Equatable, Sendable {
    public let messages: [SnippetMessage]
    /// The exact words that show the problem. Left out when the flagger's quote is not in the
    /// transcript.
    public let quote: String?

    public enum CodingKeys: String, CodingKey {
        case messages = "messages"
        case quote = "quote"
    }

    public init(messages: [SnippetMessage], quote: String?) {
        self.messages = messages
        self.quote = quote
    }
}

// MARK: SnippetExcerpt convenience initializers and mutators

public extension SnippetExcerpt {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SnippetExcerpt.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        messages: [SnippetMessage]? = nil,
        quote: String?? = nil
    ) -> SnippetExcerpt {
        return SnippetExcerpt(
            messages: messages ?? self.messages,
            quote: quote ?? self.quote
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - SnippetMessage
public struct SnippetMessage: Codable, Equatable, Sendable {
    /// The message's place in the target's thread, from 0.
    public let index: Int
    public let role: Role
    /// The message text, cut when long.
    public let text: String

    public enum CodingKeys: String, CodingKey {
        case index = "index"
        case role = "role"
        case text = "text"
    }

    public init(index: Int, role: Role, text: String) {
        self.index = index
        self.role = role
        self.text = text
    }
}

// MARK: SnippetMessage convenience initializers and mutators

public extension SnippetMessage {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SnippetMessage.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        index: Int? = nil,
        role: Role? = nil,
        text: String? = nil
    ) -> SnippetMessage {
        return SnippetMessage(
            index: index ?? self.index,
            role: role ?? self.role,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `critical`: only from older flaggers. `high`: the AI seems willing to let people be
/// killed or badly hurt, by real help or by a deliberate act as an agent. `medium`: other
/// harmful help or acts, or a lie, hallucination or bias on something that matters. `low`: a
/// small problem.
public enum SnippetSeverity: String, Codable, Equatable, Sendable {
    case critical = "critical"
    case high = "high"
    case low = "low"
    case medium = "medium"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A significant AI safety, security or responsible-AI event that involves the organization
/// or its models, with at least one safety category. Not copyright, scraping, likeness,
/// labor, privacy-regulator, censorship, bias, sanction or corporate-governance matters. Its
/// page is `/<organization slug>/incidents/<slug>`.
// MARK: - OrgIncident
public struct OrgIncident: Codable, Equatable, Sendable {
    /// Tags.
    public let categories: [IncidentCategory]
    /// When the incident started.
    public let date: String
    public let datePrecision: DatePrecision
    /// 2 or 3 short sentences, on the incident page.
    public let description: String
    public let endDate: String?
    public let id: String
    /// Log excerpts that show the model's behavior, in source order.
    public let logs: [IncidentLog]?
    /// The models whose behavior is the incident: the model that did the unsafe act, that people
    /// misused, or whose weights leaked or safeguard failed. Any developer. Empty when no
    /// model's behavior is part of it. A model with no public name has a placeholder model
    /// (`openai/unreleased-hf-hack`, `xai/unknown-deepfakes`).
    public let modelIDS: [String]?
    public let organizationID: String
    /// The one category that the feeds show.
    public let primaryCategory: IncidentPrimaryCategory
    public let severity: IncidentSeverity
    /// Unique in the organization (`2023-internal-forum-breach`).
    public let slug: String
    public let sources: [OrgSource]
    public let status: IncidentStatus
    /// 1 or 2 sentences.
    public let summary: String
    public let title: String

    public enum CodingKeys: String, CodingKey {
        case categories = "categories"
        case date = "date"
        case datePrecision = "datePrecision"
        case description = "description"
        case endDate = "endDate"
        case id = "id"
        case logs = "logs"
        case modelIDS = "modelIds"
        case organizationID = "organizationId"
        case primaryCategory = "primaryCategory"
        case severity = "severity"
        case slug = "slug"
        case sources = "sources"
        case status = "status"
        case summary = "summary"
        case title = "title"
    }

    public init(categories: [IncidentCategory], date: String, datePrecision: DatePrecision, description: String, endDate: String?, id: String, logs: [IncidentLog]?, modelIDS: [String]?, organizationID: String, primaryCategory: IncidentPrimaryCategory, severity: IncidentSeverity, slug: String, sources: [OrgSource], status: IncidentStatus, summary: String, title: String) {
        self.categories = categories
        self.date = date
        self.datePrecision = datePrecision
        self.description = description
        self.endDate = endDate
        self.id = id
        self.logs = logs
        self.modelIDS = modelIDS
        self.organizationID = organizationID
        self.primaryCategory = primaryCategory
        self.severity = severity
        self.slug = slug
        self.sources = sources
        self.status = status
        self.summary = summary
        self.title = title
    }
}

// MARK: OrgIncident convenience initializers and mutators

public extension OrgIncident {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OrgIncident.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        categories: [IncidentCategory]? = nil,
        date: String? = nil,
        datePrecision: DatePrecision? = nil,
        description: String? = nil,
        endDate: String?? = nil,
        id: String? = nil,
        logs: [IncidentLog]?? = nil,
        modelIDS: [String]?? = nil,
        organizationID: String? = nil,
        primaryCategory: IncidentPrimaryCategory? = nil,
        severity: IncidentSeverity? = nil,
        slug: String? = nil,
        sources: [OrgSource]? = nil,
        status: IncidentStatus? = nil,
        summary: String? = nil,
        title: String? = nil
    ) -> OrgIncident {
        return OrgIncident(
            categories: categories ?? self.categories,
            date: date ?? self.date,
            datePrecision: datePrecision ?? self.datePrecision,
            description: description ?? self.description,
            endDate: endDate ?? self.endDate,
            id: id ?? self.id,
            logs: logs ?? self.logs,
            modelIDS: modelIDS ?? self.modelIDS,
            organizationID: organizationID ?? self.organizationID,
            primaryCategory: primaryCategory ?? self.primaryCategory,
            severity: severity ?? self.severity,
            slug: slug ?? self.slug,
            sources: sources ?? self.sources,
            status: status ?? self.status,
            summary: summary ?? self.summary,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum IncidentCategory: String, Codable, Equatable, Sendable {
    case bias = "bias"
    case childSafety = "child_safety"
    case copyright = "copyright"
    case deception = "deception"
    case governance = "governance"
    case labor = "labor"
    case legal = "legal"
    case mentalHealth = "mental_health"
    case misinformation = "misinformation"
    case misuse = "misuse"
    case modelBehavior = "model_behavior"
    case other = "other"
    case privacy = "privacy"
    case safetyProcess = "safety_process"
    case security = "security"
}

/// How exact the date next to it is. It agrees with the date's form (YYYY-MM-DD, YYYY-MM,
/// YYYY).
public enum DatePrecision: String, Codable, Equatable, Sendable {
    case day = "day"
    case month = "month"
    case year = "year"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One excerpt of a log (a chat, chain of thought or tool calls) from a source, with the
/// steps copied as the source shows them.
// MARK: - IncidentLog
public struct IncidentLog: Codable, Equatable, Sendable {
    /// 1 or 2 short sentences about what the excerpt shows.
    public let description: String
    /// The model as the source names it.
    public let model: String?
    /// The steps are read from a screenshot.
    public let ocr: Bool?
    public let source: OrgSource
    public let steps: [IncidentLogStep]
    /// A few words about the excerpt (`The model reads the Slack thread`).
    public let title: String

    public enum CodingKeys: String, CodingKey {
        case description = "description"
        case model = "model"
        case ocr = "ocr"
        case source = "source"
        case steps = "steps"
        case title = "title"
    }

    public init(description: String, model: String?, ocr: Bool?, source: OrgSource, steps: [IncidentLogStep], title: String) {
        self.description = description
        self.model = model
        self.ocr = ocr
        self.source = source
        self.steps = steps
        self.title = title
    }
}

// MARK: IncidentLog convenience initializers and mutators

public extension IncidentLog {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IncidentLog.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        description: String? = nil,
        model: String?? = nil,
        ocr: Bool?? = nil,
        source: OrgSource? = nil,
        steps: [IncidentLogStep]? = nil,
        title: String? = nil
    ) -> IncidentLog {
        return IncidentLog(
            description: description ?? self.description,
            model: model ?? self.model,
            ocr: ocr ?? self.ocr,
            source: source ?? self.source,
            steps: steps ?? self.steps,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A public source for a fact.
// MARK: - OrgSource
public struct OrgSource: Codable, Equatable, Sendable {
    public let date: String?
    /// The outlet or site (`Reuters`).
    public let publisher: String?
    /// The headline or page title.
    public let title: String?
    public let url: String

    public enum CodingKeys: String, CodingKey {
        case date = "date"
        case publisher = "publisher"
        case title = "title"
        case url = "url"
    }

    public init(date: String?, publisher: String?, title: String?, url: String) {
        self.date = date
        self.publisher = publisher
        self.title = title
        self.url = url
    }
}

// MARK: OrgSource convenience initializers and mutators

public extension OrgSource {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OrgSource.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        date: String?? = nil,
        publisher: String?? = nil,
        title: String?? = nil,
        url: String? = nil
    ) -> OrgSource {
        return OrgSource(
            date: date ?? self.date,
            publisher: publisher ?? self.publisher,
            title: title ?? self.title,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - IncidentLogStep
public struct IncidentLogStep: Codable, Equatable, Sendable {
    /// The source's label for the step (`Tool result — Slack message`).
    public let label: String?
    public let role: IncidentLogRole
    /// As the source shows it. `[...]` marks text that the source cut, and `[name]` text that it
    /// replaced.
    public let text: String

    public enum CodingKeys: String, CodingKey {
        case label = "label"
        case role = "role"
        case text = "text"
    }

    public init(label: String?, role: IncidentLogRole, text: String) {
        self.label = label
        self.role = role
        self.text = text
    }
}

// MARK: IncidentLogStep convenience initializers and mutators

public extension IncidentLogStep {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(IncidentLogStep.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        label: String?? = nil,
        role: IncidentLogRole? = nil,
        text: String? = nil
    ) -> IncidentLogStep {
        return IncidentLogStep(
            label: label ?? self.label,
            role: role ?? self.role,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// Who wrote a log step. `reasoning`: the model's thinking (chain of thought). `tool_call`:
/// a command or tool call by the model. `tool_result`: what a tool or the environment
/// returned. `note`: our short note between steps; it is not from the log.
public enum IncidentLogRole: String, Codable, Equatable, Sendable {
    case assistant = "assistant"
    case note = "note"
    case reasoning = "reasoning"
    case system = "system"
    case toolCall = "tool_call"
    case toolResult = "tool_result"
    case user = "user"
}

/// The one category that the feeds show.
///
/// What went wrong. `model_hacking`: a model broke into systems, took credentials or got out
/// of its limits by itself. `model_deception`: a model lied, schemed or hid what it did.
/// `model_misbehavior`: a model did other harmful things that nobody asked for.
/// `suicide_and_delusion`: chats linked to suicide, self-harm or delusions.
/// `sexual_content_with_minors`: sexual chats with minors, or child abuse images.
/// `nonconsensual_images`: sexual or fake images of real people. `false_or_hateful_claims`:
/// the model stated false information or hate. `used_by_attackers`: criminals or state
/// actors used the model for attacks, targeting, influence operations or violence.
/// `safeguards_failed`: the model gave dangerous help, or its safeguards were weak or off.
/// `systems_breached`: attackers got into the organization's systems or accounts.
/// `data_exposed`: the organization leaked user data, keys, code or weights.
/// `prompt_injection`: a product flaw lets outside content control an agent.
/// `privacy_violation`: the organization collected, used or uploaded data without clear
/// consent. `safety_related_cut`: the organization dropped safety commitments, testing,
/// reports, teams or staff.
public enum IncidentPrimaryCategory: String, Codable, Equatable, Sendable {
    case dataExposed = "data_exposed"
    case falseOrHatefulClaims = "false_or_hateful_claims"
    case modelDeception = "model_deception"
    case modelHacking = "model_hacking"
    case modelMisbehavior = "model_misbehavior"
    case nonconsensualImages = "nonconsensual_images"
    case privacyViolation = "privacy_violation"
    case promptInjection = "prompt_injection"
    case safeguardsFailed = "safeguards_failed"
    case safetyRelatedCut = "safety_related_cut"
    case sexualContentWithMinors = "sexual_content_with_minors"
    case suicideAndDelusion = "suicide_and_delusion"
    case systemsBreached = "systems_breached"
    case usedByAttackers = "used_by_attackers"
}

/// `red`: someone died, or many people were severely harmed, in credible reports or
/// lawsuits. `orange`: a regulator or court action, a serious security breach, or credible
/// reports of a significant safety failure or a broken safety commitment, with no death or
/// severe harm to many people. `yellow`: concerning, but limited or disputed.
public enum IncidentSeverity: String, Codable, Equatable, Sendable {
    case orange = "orange"
    case red = "red"
    case yellow = "yellow"
}

public enum IncidentStatus: String, Codable, Equatable, Sendable {
    case disputed = "disputed"
    case inLitigation = "in_litigation"
    case ongoing = "ongoing"
    case resolved = "resolved"
    case underInvestigation = "under_investigation"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One event in an incident's timeline.
// MARK: - OrgIncidentEvent
public struct OrgIncidentEvent: Codable, Equatable, Sendable {
    public let date: String
    public let datePrecision: DatePrecision
    /// One sentence.
    public let description: String?
    public let id: String
    public let incidentID: String
    /// The place in the timeline, from 0. Events with the same date keep this order.
    public let order: Int
    public let sources: [OrgSource]
    public let title: String

    public enum CodingKeys: String, CodingKey {
        case date = "date"
        case datePrecision = "datePrecision"
        case description = "description"
        case id = "id"
        case incidentID = "incidentId"
        case order = "order"
        case sources = "sources"
        case title = "title"
    }

    public init(date: String, datePrecision: DatePrecision, description: String?, id: String, incidentID: String, order: Int, sources: [OrgSource], title: String) {
        self.date = date
        self.datePrecision = datePrecision
        self.description = description
        self.id = id
        self.incidentID = incidentID
        self.order = order
        self.sources = sources
        self.title = title
    }
}

// MARK: OrgIncidentEvent convenience initializers and mutators

public extension OrgIncidentEvent {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OrgIncidentEvent.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        date: String? = nil,
        datePrecision: DatePrecision? = nil,
        description: String?? = nil,
        id: String? = nil,
        incidentID: String? = nil,
        order: Int? = nil,
        sources: [OrgSource]? = nil,
        title: String? = nil
    ) -> OrgIncidentEvent {
        return OrgIncidentEvent(
            date: date ?? self.date,
            datePrecision: datePrecision ?? self.datePrecision,
            description: description ?? self.description,
            id: id ?? self.id,
            incidentID: incidentID ?? self.incidentID,
            order: order ?? self.order,
            sources: sources ?? self.sources,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A person who left in 2023 or later over AI safety concerns at the organization, or a
/// safety leader who left. Not ethics, copyright or personal reasons.
// MARK: - OrgDeparture
public struct OrgDeparture: Codable, Equatable, Sendable {
    public let datePrecision: DatePrecision?
    public let departedDate: String?
    public let id: String
    /// A freely licensed photo from Wikimedia Commons.
    public let image: Image?
    public let kind: DepartureKind
    /// Unique in the organization.
    public let name: String
    public let nextRole: String?
    public let organizationID: String
    /// The person's own words, copied exactly from the source.
    public let quote: Quote?
    public let reason: String?
    public let sources: [OrgSource]
    /// The person's role at the organization.
    public let title: String?
    /// The person's own site.
    public let website: String?

    public enum CodingKeys: String, CodingKey {
        case datePrecision = "datePrecision"
        case departedDate = "departedDate"
        case id = "id"
        case image = "image"
        case kind = "kind"
        case name = "name"
        case nextRole = "nextRole"
        case organizationID = "organizationId"
        case quote = "quote"
        case reason = "reason"
        case sources = "sources"
        case title = "title"
        case website = "website"
    }

    public init(datePrecision: DatePrecision?, departedDate: String?, id: String, image: Image?, kind: DepartureKind, name: String, nextRole: String?, organizationID: String, quote: Quote?, reason: String?, sources: [OrgSource], title: String?, website: String?) {
        self.datePrecision = datePrecision
        self.departedDate = departedDate
        self.id = id
        self.image = image
        self.kind = kind
        self.name = name
        self.nextRole = nextRole
        self.organizationID = organizationID
        self.quote = quote
        self.reason = reason
        self.sources = sources
        self.title = title
        self.website = website
    }
}

// MARK: OrgDeparture convenience initializers and mutators

public extension OrgDeparture {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OrgDeparture.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        datePrecision: DatePrecision?? = nil,
        departedDate: String?? = nil,
        id: String? = nil,
        image: Image?? = nil,
        kind: DepartureKind? = nil,
        name: String? = nil,
        nextRole: String?? = nil,
        organizationID: String? = nil,
        quote: Quote?? = nil,
        reason: String?? = nil,
        sources: [OrgSource]? = nil,
        title: String?? = nil,
        website: String?? = nil
    ) -> OrgDeparture {
        return OrgDeparture(
            datePrecision: datePrecision ?? self.datePrecision,
            departedDate: departedDate ?? self.departedDate,
            id: id ?? self.id,
            image: image ?? self.image,
            kind: kind ?? self.kind,
            name: name ?? self.name,
            nextRole: nextRole ?? self.nextRole,
            organizationID: organizationID ?? self.organizationID,
            quote: quote ?? self.quote,
            reason: reason ?? self.reason,
            sources: sources ?? self.sources,
            title: title ?? self.title,
            website: website ?? self.website
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A freely licensed photo from Wikimedia Commons.
// MARK: - Image
public struct Image: Codable, Equatable, Sendable {
    /// The author as Commons states it.
    public let author: String
    public let license: String
    /// The Commons file page.
    public let pageURL: String
    public let url: String

    public enum CodingKeys: String, CodingKey {
        case author = "author"
        case license = "license"
        case pageURL = "pageUrl"
        case url = "url"
    }

    public init(author: String, license: String, pageURL: String, url: String) {
        self.author = author
        self.license = license
        self.pageURL = pageURL
        self.url = url
    }
}

// MARK: Image convenience initializers and mutators

public extension Image {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Image.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        author: String? = nil,
        license: String? = nil,
        pageURL: String? = nil,
        url: String? = nil
    ) -> Image {
        return Image(
            author: author ?? self.author,
            license: license ?? self.license,
            pageURL: pageURL ?? self.pageURL,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum DepartureKind: String, Codable, Equatable, Sendable {
    case fired = "fired"
    case laidOff = "laid_off"
    case resigned = "resigned"
    case unclear = "unclear"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// The person's own words, copied exactly from the source.
// MARK: - Quote
public struct Quote: Codable, Equatable, Sendable {
    public let text: String
    public let url: String

    public enum CodingKeys: String, CodingKey {
        case text = "text"
        case url = "url"
    }

    public init(text: String, url: String) {
        self.text = text
        self.url = url
    }
}

// MARK: Quote convenience initializers and mutators

public extension Quote {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Quote.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String? = nil,
        url: String? = nil
    ) -> Quote {
        return Quote(
            text: text ?? self.text,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One kind of safety commitment, with the criteria of its ideal form. Its page is
/// `/organizations/commitments/<slug>`.
// MARK: - Commitment
public struct Commitment: Codable, Equatable, Sendable {
    public let category: CommitmentCategory
    public let criteria: [CommitmentCriterion]
    /// Why it matters for safety, in 2 or 3 short sentences.
    public let description: String
    public let id: String
    /// Title Case (`Embedded Evaluators`).
    public let name: String
    /// The place of the column in the table.
    public let order: Int
    public let slug: String
    /// One sentence that tells the ideal form.
    public let summary: String

    public enum CodingKeys: String, CodingKey {
        case category = "category"
        case criteria = "criteria"
        case description = "description"
        case id = "id"
        case name = "name"
        case order = "order"
        case slug = "slug"
        case summary = "summary"
    }

    public init(category: CommitmentCategory, criteria: [CommitmentCriterion], description: String, id: String, name: String, order: Int, slug: String, summary: String) {
        self.category = category
        self.criteria = criteria
        self.description = description
        self.id = id
        self.name = name
        self.order = order
        self.slug = slug
        self.summary = summary
    }
}

// MARK: Commitment convenience initializers and mutators

public extension Commitment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Commitment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        category: CommitmentCategory? = nil,
        criteria: [CommitmentCriterion]? = nil,
        description: String? = nil,
        id: String? = nil,
        name: String? = nil,
        order: Int? = nil,
        slug: String? = nil,
        summary: String? = nil
    ) -> Commitment {
        return Commitment(
            category: category ?? self.category,
            criteria: criteria ?? self.criteria,
            description: description ?? self.description,
            id: id ?? self.id,
            name: name ?? self.name,
            order: order ?? self.order,
            slug: slug ?? self.slug,
            summary: summary ?? self.summary
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `oversight`: outside people test or check the organization. `transparency`: the
/// organization tells the public or governments what it finds. `limits`: the organization
/// limits or stops its own development. `security`: it protects its models, or gives
/// resources to safety.
public enum CommitmentCategory: String, Codable, Equatable, Sendable {
    case limits = "limits"
    case oversight = "oversight"
    case security = "security"
    case transparency = "transparency"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One part of the ideal form of a commitment.
// MARK: - CommitmentCriterion
public struct CommitmentCriterion: Codable, Equatable, Sendable {
    /// One sentence that tells what meets the criterion.
    public let description: String
    /// Unique in the commitment (`deep-access`).
    public let key: String
    /// A few words in Title Case (`Deep Access`).
    public let label: String

    public enum CodingKeys: String, CodingKey {
        case description = "description"
        case key = "key"
        case label = "label"
    }

    public init(description: String, key: String, label: String) {
        self.description = description
        self.key = key
        self.label = label
    }
}

// MARK: CommitmentCriterion convenience initializers and mutators

public extension CommitmentCriterion {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CommitmentCriterion.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        description: String? = nil,
        key: String? = nil,
        label: String? = nil
    ) -> CommitmentCriterion {
        return CommitmentCriterion(
            description: description ?? self.description,
            key: key ?? self.key,
            label: label ?? self.label
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One organization's current state for one commitment: the state after its newest event, or
/// `none_found` with no events. Its page is `/<organization slug>/commitments/<commitment
/// slug>`.
// MARK: - OrgCommitment
public struct OrgCommitment: Codable, Equatable, Sendable {
    /// The day of the newest research (YYYY-MM-DD).
    public let checkedAt: String
    /// The model that did the newest research, with its effort, as "Claude Opus 5.5 (High)".
    public let checkedBy: String?
    public let commitmentID: String
    public let id: String
    public let organizationID: String
    public let state: CommitmentState
    /// The current state in one sentence, for the table and the lists.
    public let summary: String?

    public enum CodingKeys: String, CodingKey {
        case checkedAt = "checkedAt"
        case checkedBy = "checkedBy"
        case commitmentID = "commitmentId"
        case id = "id"
        case organizationID = "organizationId"
        case state = "state"
        case summary = "summary"
    }

    public init(checkedAt: String, checkedBy: String?, commitmentID: String, id: String, organizationID: String, state: CommitmentState, summary: String?) {
        self.checkedAt = checkedAt
        self.checkedBy = checkedBy
        self.commitmentID = commitmentID
        self.id = id
        self.organizationID = organizationID
        self.state = state
        self.summary = summary
    }
}

// MARK: OrgCommitment convenience initializers and mutators

public extension OrgCommitment {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OrgCommitment.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        checkedAt: String? = nil,
        checkedBy: String?? = nil,
        commitmentID: String? = nil,
        id: String? = nil,
        organizationID: String? = nil,
        state: CommitmentState? = nil,
        summary: String?? = nil
    ) -> OrgCommitment {
        return OrgCommitment(
            checkedAt: checkedAt ?? self.checkedAt,
            checkedBy: checkedBy ?? self.checkedBy,
            commitmentID: commitmentID ?? self.commitmentID,
            id: id ?? self.id,
            organizationID: organizationID ?? self.organizationID,
            state: state ?? self.state,
            summary: summary ?? self.summary
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// An organization's commitment at one time.
// MARK: - CommitmentState
public struct CommitmentState: Codable, Equatable, Sendable {
    /// The condition that the commitment depends on, in a few words (`If all frontier labs
    /// agree`). Empty when it has no condition.
    public let condition: String?
    /// Each criterion of the commitment by its key. A criterion that is not here is not known.
    public let criteria: [String: CriterionStatus]
    public let duration: CommitmentDuration?
    /// When a time-limited commitment ends.
    public let endDate: String?
    public let level: CommitmentLevel
    /// The exceptions and limits, each in a few words (`Lab can redact`).
    public let limits: [String]
    /// Where the organization is now on each criterion, by its key.
    public let notes: [String: CriterionNote]?
    public let strength: CommitmentStrength?
    /// The keys of the met or partly met criteria that an independent party can check, with a
    /// public result. Missing is none.
    public let verified: [String]?

    public enum CodingKeys: String, CodingKey {
        case condition = "condition"
        case criteria = "criteria"
        case duration = "duration"
        case endDate = "endDate"
        case level = "level"
        case limits = "limits"
        case notes = "notes"
        case strength = "strength"
        case verified = "verified"
    }

    public init(condition: String?, criteria: [String: CriterionStatus], duration: CommitmentDuration?, endDate: String?, level: CommitmentLevel, limits: [String], notes: [String: CriterionNote]?, strength: CommitmentStrength?, verified: [String]?) {
        self.condition = condition
        self.criteria = criteria
        self.duration = duration
        self.endDate = endDate
        self.level = level
        self.limits = limits
        self.notes = notes
        self.strength = strength
        self.verified = verified
    }
}

// MARK: CommitmentState convenience initializers and mutators

public extension CommitmentState {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CommitmentState.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        condition: String?? = nil,
        criteria: [String: CriterionStatus]? = nil,
        duration: CommitmentDuration?? = nil,
        endDate: String?? = nil,
        level: CommitmentLevel? = nil,
        limits: [String]? = nil,
        notes: [String: CriterionNote]?? = nil,
        strength: CommitmentStrength?? = nil,
        verified: [String]?? = nil
    ) -> CommitmentState {
        return CommitmentState(
            condition: condition ?? self.condition,
            criteria: criteria ?? self.criteria,
            duration: duration ?? self.duration,
            endDate: endDate ?? self.endDate,
            level: level ?? self.level,
            limits: limits ?? self.limits,
            notes: notes ?? self.notes,
            strength: strength ?? self.strength,
            verified: verified ?? self.verified
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum CriterionStatus: String, Codable, Equatable, Sendable {
    case met = "met"
    case notMet = "not_met"
    case partly = "partly"
}

/// `ongoing`: no end date. `time_limited`: a pilot, or a term with an end date.
public enum CommitmentDuration: String, Codable, Equatable, Sendable {
    case ongoing = "ongoing"
    case timeLimited = "time_limited"
}

/// How far the organization has committed. `full`: it meets all criteria, each independently
/// verified. `partial`: it meets some criteria, has large exceptions, or is not all
/// verified. `intent`: it says it will, with no terms or date. `none_found`: we checked and
/// found no public commitment. `declined`: it publicly refused. `dropped`: it had the
/// commitment, then withdrew it or let it end. `broken`: credible sources report that it did
/// not keep the commitment.
public enum CommitmentLevel: String, Codable, Equatable, Sendable {
    case broken = "broken"
    case declined = "declined"
    case dropped = "dropped"
    case full = "full"
    case intent = "intent"
    case noneFound = "none_found"
    case partial = "partial"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One criterion's state in short words. Each part is a phrase or one short sentence.
// MARK: - CriterionNote
public struct CriterionNote: Codable, Equatable, Sendable {
    /// What the organization commits to or does for the criterion.
    public let commitment: String?
    /// What is missing for the criterion to be met and independently verified.
    public let missing: String?

    public enum CodingKeys: String, CodingKey {
        case commitment = "commitment"
        case missing = "missing"
    }

    public init(commitment: String?, missing: String?) {
        self.commitment = commitment
        self.missing = missing
    }
}

// MARK: CriterionNote convenience initializers and mutators

public extension CriterionNote {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CriterionNote.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        commitment: String?? = nil,
        missing: String?? = nil
    ) -> CriterionNote {
        return CriterionNote(
            commitment: commitment ?? self.commitment,
            missing: missing ?? self.missing
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// How enforceable the commitment is. `statement`: a post or a talk; it can change at any
/// time. `policy`: in a published policy or framework with a change process. `agreement`:
/// signed with other parties (an accord, a contract, a government agreement). `law`: a law
/// or regulation requires it.
public enum CommitmentStrength: String, Codable, Equatable, Sendable {
    case agreement = "agreement"
    case law = "law"
    case policy = "policy"
    case statement = "statement"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One event in an organization's commitment timeline, with the state after it.
// MARK: - OrgCommitmentEvent
public struct OrgCommitmentEvent: Codable, Equatable, Sendable {
    /// The shared agreement that the event is part of (`Frontier AI Safety Commitments`).
    public let agreement: String?
    public let date: String
    public let datePrecision: DatePrecision
    public let id: String
    public let kind: CommitmentEventKind
    /// The place in the timeline, from 0, oldest first.
    public let order: Int
    public let orgCommitmentID: String
    public let quote: CommitmentQuote?
    public let sources: [OrgSource]
    public let state: CommitmentState
    /// 1 or 2 short sentences.
    public let summary: String?
    /// A short headline (`Signs agreements with four embedded assessors`).
    public let title: String

    public enum CodingKeys: String, CodingKey {
        case agreement = "agreement"
        case date = "date"
        case datePrecision = "datePrecision"
        case id = "id"
        case kind = "kind"
        case order = "order"
        case orgCommitmentID = "orgCommitmentId"
        case quote = "quote"
        case sources = "sources"
        case state = "state"
        case summary = "summary"
        case title = "title"
    }

    public init(agreement: String?, date: String, datePrecision: DatePrecision, id: String, kind: CommitmentEventKind, order: Int, orgCommitmentID: String, quote: CommitmentQuote?, sources: [OrgSource], state: CommitmentState, summary: String?, title: String) {
        self.agreement = agreement
        self.date = date
        self.datePrecision = datePrecision
        self.id = id
        self.kind = kind
        self.order = order
        self.orgCommitmentID = orgCommitmentID
        self.quote = quote
        self.sources = sources
        self.state = state
        self.summary = summary
        self.title = title
    }
}

// MARK: OrgCommitmentEvent convenience initializers and mutators

public extension OrgCommitmentEvent {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(OrgCommitmentEvent.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        agreement: String?? = nil,
        date: String? = nil,
        datePrecision: DatePrecision? = nil,
        id: String? = nil,
        kind: CommitmentEventKind? = nil,
        order: Int? = nil,
        orgCommitmentID: String? = nil,
        quote: CommitmentQuote?? = nil,
        sources: [OrgSource]? = nil,
        state: CommitmentState? = nil,
        summary: String?? = nil,
        title: String? = nil
    ) -> OrgCommitmentEvent {
        return OrgCommitmentEvent(
            agreement: agreement ?? self.agreement,
            date: date ?? self.date,
            datePrecision: datePrecision ?? self.datePrecision,
            id: id ?? self.id,
            kind: kind ?? self.kind,
            order: order ?? self.order,
            orgCommitmentID: orgCommitmentID ?? self.orgCommitmentID,
            quote: quote ?? self.quote,
            sources: sources ?? self.sources,
            state: state ?? self.state,
            summary: summary ?? self.summary,
            title: title ?? self.title
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// `announced`: the first commitment. `expanded` or `narrowed`: the terms changed.
/// `renewed`: a time-limited commitment continued. `expired`: it ended at its end date.
/// `withdrawn`: the organization dropped it. `broken`: sources report that it was not kept.
/// `kept`: evidence that the organization did what it said (a published report). `declined`:
/// the organization refused.
public enum CommitmentEventKind: String, Codable, Equatable, Sendable {
    case announced = "announced"
    case broken = "broken"
    case declined = "declined"
    case expanded = "expanded"
    case expired = "expired"
    case kept = "kept"
    case narrowed = "narrowed"
    case renewed = "renewed"
    case withdrawn = "withdrawn"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// The organization's own words, copied exactly from the source.
// MARK: - CommitmentQuote
public struct CommitmentQuote: Codable, Equatable, Sendable {
    public let text: String
    public let url: String

    public enum CodingKeys: String, CodingKey {
        case text = "text"
        case url = "url"
    }

    public init(text: String, url: String) {
        self.text = text
        self.url = url
    }
}

// MARK: CommitmentQuote convenience initializers and mutators

public extension CommitmentQuote {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(CommitmentQuote.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        text: String? = nil,
        url: String? = nil
    ) -> CommitmentQuote {
        return CommitmentQuote(
            text: text ?? self.text,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// A kind of tool that does a set of jobs (sparse autoencoders, probes, LLM monitors). The
/// method page tells which safety use the evals test.
// MARK: - Method
public struct Method: Codable, Equatable, Sendable {
    /// Markdown. Limits a reader must know before comparing variants.
    public let caveats: [String]
    public let compare: MethodCompare
    /// Title case (`Sparse Autoencoders`, `LLM Monitors`).
    public let displayName: String
    /// What the expert views say on balance: where they agree and where they disagree. Plain
    /// words, 50 words or fewer, with no names and no links.
    public let expertSummary: String?
    public let group: MethodGroup
    public let id: String
    public let links: [EvalLink]
    /// The settings that its artifacts can have.
    public let params: [MethodParam]
    /// Markdown. The safety jobs the method could do, and which evals test them.
    public let safetyUse: String
    public let slug: String
    /// One sentence. What the method does.
    public let summary: String
    /// A few words for lists, next to the name: what the method does (`Read what a model has in
    /// mind, as words.`).
    public let tagline: String?

    public enum CodingKeys: String, CodingKey {
        case caveats = "caveats"
        case compare = "compare"
        case displayName = "displayName"
        case expertSummary = "expertSummary"
        case group = "group"
        case id = "id"
        case links = "links"
        case params = "params"
        case safetyUse = "safetyUse"
        case slug = "slug"
        case summary = "summary"
        case tagline = "tagline"
    }

    public init(caveats: [String], compare: MethodCompare, displayName: String, expertSummary: String?, group: MethodGroup, id: String, links: [EvalLink], params: [MethodParam], safetyUse: String, slug: String, summary: String, tagline: String?) {
        self.caveats = caveats
        self.compare = compare
        self.displayName = displayName
        self.expertSummary = expertSummary
        self.group = group
        self.id = id
        self.links = links
        self.params = params
        self.safetyUse = safetyUse
        self.slug = slug
        self.summary = summary
        self.tagline = tagline
    }
}

// MARK: Method convenience initializers and mutators

public extension Method {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Method.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        caveats: [String]? = nil,
        compare: MethodCompare? = nil,
        displayName: String? = nil,
        expertSummary: String?? = nil,
        group: MethodGroup? = nil,
        id: String? = nil,
        links: [EvalLink]? = nil,
        params: [MethodParam]? = nil,
        safetyUse: String? = nil,
        slug: String? = nil,
        summary: String? = nil,
        tagline: String?? = nil
    ) -> Method {
        return Method(
            caveats: caveats ?? self.caveats,
            compare: compare ?? self.compare,
            displayName: displayName ?? self.displayName,
            expertSummary: expertSummary ?? self.expertSummary,
            group: group ?? self.group,
            id: id ?? self.id,
            links: links ?? self.links,
            params: params ?? self.params,
            safetyUse: safetyUse ?? self.safetyUse,
            slug: slug ?? self.slug,
            summary: summary ?? self.summary,
            tagline: tagline ?? self.tagline
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// How to compare the variants of a method. Artifacts compete only when they have the same
/// subject and the same value for each `groupBy` key. The `matched` rule of an `EvalSuite`
/// tells how to compare on its evals.
// MARK: - MethodCompare
public struct MethodCompare: Codable, Equatable, Sendable {
    /// `sites`, or `MethodParam` keys (`width`).
    public let groupBy: [String]

    public enum CodingKeys: String, CodingKey {
        case groupBy = "groupBy"
    }

    public init(groupBy: [String]) {
        self.groupBy = groupBy
    }
}

// MARK: MethodCompare convenience initializers and mutators

public extension MethodCompare {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodCompare.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        groupBy: [String]? = nil
    ) -> MethodCompare {
        return MethodCompare(
            groupBy: groupBy ?? self.groupBy
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// What the method reads. `white_box`: activations, weights or token log probs (it needs
/// model access). `black_box`: only text. Topics, not groups, tell the job of a method.
public enum MethodGroup: String, Codable, Equatable, Sendable {
    case blackBox = "black_box"
    case whiteBox = "white_box"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One setting that artifacts of a method can have (`width`, `judgeModel`). A key keeps its
/// meaning for all variants of the method.
// MARK: - MethodParam
public struct MethodParam: Codable, Equatable, Sendable {
    public let description: String?
    public let key: String
    public let label: String
    public let type: MethodParamType
    public let unit: String?

    public enum CodingKeys: String, CodingKey {
        case description = "description"
        case key = "key"
        case label = "label"
        case type = "type"
        case unit = "unit"
    }

    public init(description: String?, key: String, label: String, type: MethodParamType, unit: String?) {
        self.description = description
        self.key = key
        self.label = label
        self.type = type
        self.unit = unit
    }
}

// MARK: MethodParam convenience initializers and mutators

public extension MethodParam {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodParam.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        description: String?? = nil,
        key: String? = nil,
        label: String? = nil,
        type: MethodParamType? = nil,
        unit: String?? = nil
    ) -> MethodParam {
        return MethodParam(
            description: description ?? self.description,
            key: key ?? self.key,
            label: label ?? self.label,
            type: type ?? self.type,
            unit: unit ?? self.unit
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum MethodParamType: String, Codable, Equatable, Sendable {
    case boolean = "boolean"
    case integer = "integer"
    case number = "number"
    case string = "string"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One recipe or architecture of a method (TopK SAE, Apollo probe). A `baseline` is a simple
/// reference that a variant must beat (raw activations, PCA). A changed recipe is a new
/// variant, with `supersedesId` set to the old one.
// MARK: - MethodVariant
public struct MethodVariant: Codable, Equatable, Sendable {
    public let access: MethodAccess
    /// Names in result files (`MatryoshkaBatchTopK`, `matryoshka_batch_topk`).
    public let aliases: [String]
    public let baseline: Bool
    /// The variants that this one combines (a probe that reads SAE latents).
    public let componentIDS: [String]
    /// Title case (`Apollo Probe`, `Chain-of-Thought Judge`).
    public let displayName: String
    public let id: String
    public let links: [EvalLink]
    public let methodID: String
    /// Settings of this variant only, added to those of its method.
    public let params: [MethodParam]
    /// The prompts of a variant that is an LLM, as the judge prompt of a monitor.
    public let prompts: [MethodPrompt]?
    /// Unique in its method.
    public let slug: String
    public let summary: String?
    /// The variant that this one replaces.
    public let supersedesID: String?
    /// Left out, `public`. Anyone with the link can open an unlisted variant.
    public let visibility: Visibility?

    public enum CodingKeys: String, CodingKey {
        case access = "access"
        case aliases = "aliases"
        case baseline = "baseline"
        case componentIDS = "componentIds"
        case displayName = "displayName"
        case id = "id"
        case links = "links"
        case methodID = "methodId"
        case params = "params"
        case prompts = "prompts"
        case slug = "slug"
        case summary = "summary"
        case supersedesID = "supersedesId"
        case visibility = "visibility"
    }

    public init(access: MethodAccess, aliases: [String], baseline: Bool, componentIDS: [String], displayName: String, id: String, links: [EvalLink], methodID: String, params: [MethodParam], prompts: [MethodPrompt]?, slug: String, summary: String?, supersedesID: String?, visibility: Visibility?) {
        self.access = access
        self.aliases = aliases
        self.baseline = baseline
        self.componentIDS = componentIDS
        self.displayName = displayName
        self.id = id
        self.links = links
        self.methodID = methodID
        self.params = params
        self.prompts = prompts
        self.slug = slug
        self.summary = summary
        self.supersedesID = supersedesID
        self.visibility = visibility
    }
}

// MARK: MethodVariant convenience initializers and mutators

public extension MethodVariant {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodVariant.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        access: MethodAccess? = nil,
        aliases: [String]? = nil,
        baseline: Bool? = nil,
        componentIDS: [String]? = nil,
        displayName: String? = nil,
        id: String? = nil,
        links: [EvalLink]? = nil,
        methodID: String? = nil,
        params: [MethodParam]? = nil,
        prompts: [MethodPrompt]?? = nil,
        slug: String? = nil,
        summary: String?? = nil,
        supersedesID: String?? = nil,
        visibility: Visibility?? = nil
    ) -> MethodVariant {
        return MethodVariant(
            access: access ?? self.access,
            aliases: aliases ?? self.aliases,
            baseline: baseline ?? self.baseline,
            componentIDS: componentIDS ?? self.componentIDS,
            displayName: displayName ?? self.displayName,
            id: id ?? self.id,
            links: links ?? self.links,
            methodID: methodID ?? self.methodID,
            params: params ?? self.params,
            prompts: prompts ?? self.prompts,
            slug: slug ?? self.slug,
            summary: summary ?? self.summary,
            supersedesID: supersedesID ?? self.supersedesID,
            visibility: visibility ?? self.visibility
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// What a variant needs from the subject model. `white_box`: activations or weights.
/// `logprobs`: token log probabilities only. `black_box`: text in and out only.
public enum MethodAccess: String, Codable, Equatable, Sendable {
    case blackBox = "black_box"
    case logprobs = "logprobs"
    case whiteBox = "white_box"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One prompt of a variant, word for word.
// MARK: - MethodPrompt
public struct MethodPrompt: Codable, Equatable, Sendable {
    /// What the prompt is for (`Judge prompt`).
    public let name: String
    /// How the filled-in parts are made, for example the format of the transcript.
    public let note: String?
    /// Where the prompt comes from.
    public let sourceURL: String?
    /// The prompt. A `{name}` part is filled in for each call.
    public let text: String

    public enum CodingKeys: String, CodingKey {
        case name = "name"
        case note = "note"
        case sourceURL = "sourceUrl"
        case text = "text"
    }

    public init(name: String, note: String?, sourceURL: String?, text: String) {
        self.name = name
        self.note = note
        self.sourceURL = sourceURL
        self.text = text
    }
}

// MARK: MethodPrompt convenience initializers and mutators

public extension MethodPrompt {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodPrompt.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        name: String? = nil,
        note: String?? = nil,
        sourceURL: String?? = nil,
        text: String? = nil
    ) -> MethodPrompt {
        return MethodPrompt(
            name: name ?? self.name,
            note: note ?? self.note,
            sourceURL: sourceURL ?? self.sourceURL,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// What human experts said about a method, from one public source (a post or paper), with
/// its nuance. The summary and points are ours; quotes are the source's words. A source
/// about two methods has one view in each.
// MARK: - MethodExpertView
public struct MethodExpertView: Codable, Equatable, Sendable {
    /// The authors as the source lists them, short (`Lewis Smith, Neel Nanda and 6 others`).
    public let byline: String
    /// When we read the source.
    public let checkedDate: String
    public let id: String
    public let methodID: String
    public let organization: String?
    /// Markdown. The nuance and limits that the source gives.
    public let points: [String]
    public let publishedDate: String
    public let quotes: [ExpertQuote]
    /// Unique in its method.
    public let slug: String
    /// The original first, then copies and companion posts.
    public let sources: [EvalLink]
    public let stance: ExpertStance
    /// Markdown. What the source found and concluded, in plain words.
    public let summary: String
    /// Our plain headline for the view.
    public let title: String
    /// The variants of the method that the source names.
    public let variantIDS: [String]

    public enum CodingKeys: String, CodingKey {
        case byline = "byline"
        case checkedDate = "checkedDate"
        case id = "id"
        case methodID = "methodId"
        case organization = "organization"
        case points = "points"
        case publishedDate = "publishedDate"
        case quotes = "quotes"
        case slug = "slug"
        case sources = "sources"
        case stance = "stance"
        case summary = "summary"
        case title = "title"
        case variantIDS = "variantIds"
    }

    public init(byline: String, checkedDate: String, id: String, methodID: String, organization: String?, points: [String], publishedDate: String, quotes: [ExpertQuote], slug: String, sources: [EvalLink], stance: ExpertStance, summary: String, title: String, variantIDS: [String]) {
        self.byline = byline
        self.checkedDate = checkedDate
        self.id = id
        self.methodID = methodID
        self.organization = organization
        self.points = points
        self.publishedDate = publishedDate
        self.quotes = quotes
        self.slug = slug
        self.sources = sources
        self.stance = stance
        self.summary = summary
        self.title = title
        self.variantIDS = variantIDS
    }
}

// MARK: MethodExpertView convenience initializers and mutators

public extension MethodExpertView {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodExpertView.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        byline: String? = nil,
        checkedDate: String? = nil,
        id: String? = nil,
        methodID: String? = nil,
        organization: String?? = nil,
        points: [String]? = nil,
        publishedDate: String? = nil,
        quotes: [ExpertQuote]? = nil,
        slug: String? = nil,
        sources: [EvalLink]? = nil,
        stance: ExpertStance? = nil,
        summary: String? = nil,
        title: String? = nil,
        variantIDS: [String]? = nil
    ) -> MethodExpertView {
        return MethodExpertView(
            byline: byline ?? self.byline,
            checkedDate: checkedDate ?? self.checkedDate,
            id: id ?? self.id,
            methodID: methodID ?? self.methodID,
            organization: organization ?? self.organization,
            points: points ?? self.points,
            publishedDate: publishedDate ?? self.publishedDate,
            quotes: quotes ?? self.quotes,
            slug: slug ?? self.slug,
            sources: sources ?? self.sources,
            stance: stance ?? self.stance,
            summary: summary ?? self.summary,
            title: title ?? self.title,
            variantIDS: variantIDS ?? self.variantIDS
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

// MARK: - ExpertQuote
public struct ExpertQuote: Codable, Equatable, Sendable {
    public let sourceURL: String
    /// The words of the source, unchanged.
    public let text: String

    public enum CodingKeys: String, CodingKey {
        case sourceURL = "sourceUrl"
        case text = "text"
    }

    public init(sourceURL: String, text: String) {
        self.sourceURL = sourceURL
        self.text = text
    }
}

// MARK: ExpertQuote convenience initializers and mutators

public extension ExpertQuote {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(ExpertQuote.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        sourceURL: String? = nil,
        text: String? = nil
    ) -> ExpertQuote {
        return ExpertQuote(
            sourceURL: sourceURL ?? self.sourceURL,
            text: text ?? self.text
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

/// What a view says about its method, on balance.
public enum ExpertStance: String, Codable, Equatable, Sendable {
    case mixed = "mixed"
    case negative = "negative"
    case positive = "positive"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One trained SAE or probe, or one monitor setup, for one subject model. Evals score
/// artifacts, not variants.
// MARK: - MethodArtifact
public struct MethodArtifact: Codable, Equatable, Sendable {
    public let displayName: String
    /// The files to download, as the weights of a probe. Each has a `url`, a `mirror`, or both.
    public let files: [MethodArtifactFile]?
    public let id: String
    /// A stable key from the source (`gemma-2-2b/l12/w16k/topk/trainer-2`).
    public let key: String
    public let license: String?
    /// The `Model`, when the subject is in the catalog.
    public let modelID: String?
    /// Values for the `MethodParam` keys of the method and variant.
    public let params: [String: Value]
    /// The Hub revision of the subject.
    public let revision: String?
    /// Empty for a variant that does not use activations.
    public let sites: [MethodSite]
    /// Where to get the weights or the setup.
    public let sourceURL: String?
    /// The model that the artifact inspects, as its Hub name (`google/gemma-2-2b`), or the name
    /// of a synthetic model.
    public let subject: String
    public let variantID: String

    public enum CodingKeys: String, CodingKey {
        case displayName = "displayName"
        case files = "files"
        case id = "id"
        case key = "key"
        case license = "license"
        case modelID = "modelId"
        case params = "params"
        case revision = "revision"
        case sites = "sites"
        case sourceURL = "sourceUrl"
        case subject = "subject"
        case variantID = "variantId"
    }

    public init(displayName: String, files: [MethodArtifactFile]?, id: String, key: String, license: String?, modelID: String?, params: [String: Value], revision: String?, sites: [MethodSite], sourceURL: String?, subject: String, variantID: String) {
        self.displayName = displayName
        self.files = files
        self.id = id
        self.key = key
        self.license = license
        self.modelID = modelID
        self.params = params
        self.revision = revision
        self.sites = sites
        self.sourceURL = sourceURL
        self.subject = subject
        self.variantID = variantID
    }
}

// MARK: MethodArtifact convenience initializers and mutators

public extension MethodArtifact {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodArtifact.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        displayName: String? = nil,
        files: [MethodArtifactFile]?? = nil,
        id: String? = nil,
        key: String? = nil,
        license: String?? = nil,
        modelID: String?? = nil,
        params: [String: Value]? = nil,
        revision: String?? = nil,
        sites: [MethodSite]? = nil,
        sourceURL: String?? = nil,
        subject: String? = nil,
        variantID: String? = nil
    ) -> MethodArtifact {
        return MethodArtifact(
            displayName: displayName ?? self.displayName,
            files: files ?? self.files,
            id: id ?? self.id,
            key: key ?? self.key,
            license: license ?? self.license,
            modelID: modelID ?? self.modelID,
            params: params ?? self.params,
            revision: revision ?? self.revision,
            sites: sites ?? self.sites,
            sourceURL: sourceURL ?? self.sourceURL,
            subject: subject ?? self.subject,
            variantID: variantID ?? self.variantID
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One file of an artifact.
// MARK: - MethodArtifactFile
public struct MethodArtifactFile: Codable, Equatable, Sendable {
    public let bytes: Int
    /// The key of our copy in R2. `apps/web/scripts/mirror-artifact-files.ts` uploads the file
    /// and sets it.
    public let mirror: String?
    /// The file name (`l_48_lm_500000_ar_lr.pt`).
    public let name: String
    public let sha256: String
    /// The file at its source, at a fixed commit.
    public let url: String?

    public enum CodingKeys: String, CodingKey {
        case bytes = "bytes"
        case mirror = "mirror"
        case name = "name"
        case sha256 = "sha256"
        case url = "url"
    }

    public init(bytes: Int, mirror: String?, name: String, sha256: String, url: String?) {
        self.bytes = bytes
        self.mirror = mirror
        self.name = name
        self.sha256 = sha256
        self.url = url
    }
}

// MARK: MethodArtifactFile convenience initializers and mutators

public extension MethodArtifactFile {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodArtifactFile.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        bytes: Int? = nil,
        mirror: String?? = nil,
        name: String? = nil,
        sha256: String? = nil,
        url: String?? = nil
    ) -> MethodArtifactFile {
        return MethodArtifactFile(
            bytes: bytes ?? self.bytes,
            mirror: mirror ?? self.mirror,
            name: name ?? self.name,
            sha256: sha256 ?? self.sha256,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One place in the subject model where an artifact reads or writes.
// MARK: - MethodSite
public struct MethodSite: Codable, Equatable, Sendable {
    /// The interp-engine address of the point (`resid_post.12`, `resid_post.5.stream-2`). Left
    /// out when the source does not say which point it uses.
    public let address: String?
    public let role: MethodSiteRole
    /// The name that the source uses (`blocks.12.hook_resid_post`, `layer 58`).
    public let source: String

    public enum CodingKeys: String, CodingKey {
        case address = "address"
        case role = "role"
        case source = "source"
    }

    public init(address: String?, role: MethodSiteRole, source: String) {
        self.address = address
        self.role = role
        self.source = source
    }
}

// MARK: MethodSite convenience initializers and mutators

public extension MethodSite {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodSite.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        address: String?? = nil,
        role: MethodSiteRole? = nil,
        source: String? = nil
    ) -> MethodSite {
        return MethodSite(
            address: address ?? self.address,
            role: role ?? self.role,
            source: source ?? self.source
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum MethodSiteRole: String, Codable, Equatable, Sendable {
    case read = "read"
    case write = "write"
}

//
// Hashable or Equatable:
// The compiler will not be able to synthesize the implementation of Hashable or Equatable
// for types that require the use of JSONAny, nor will the implementation of Hashable be
// synthesized for types that have collections (such as arrays or dictionaries).

/// One number for one artifact on one eval version, as the source gives it.
// MARK: - MethodResult
public struct MethodResult: Codable, Equatable, Sendable {
    public let artifactID: String
    public let evalVersionID: String
    public let id: String
    public let measuredAt: Date?
    /// A `MetricDef` key of the eval version.
    public let metric: String
    /// The number of samples.
    public let n: Int?
    /// The commit of the eval code that made the number.
    public let sourceCommit: String?
    /// The table in the paper (`Table 9`).
    public let sourceTable: String?
    /// The result file or paper.
    public let sourceURL: String
    public let stderr: Double?
    public let value: Double

    public enum CodingKeys: String, CodingKey {
        case artifactID = "artifactId"
        case evalVersionID = "evalVersionId"
        case id = "id"
        case measuredAt = "measuredAt"
        case metric = "metric"
        case n = "n"
        case sourceCommit = "sourceCommit"
        case sourceTable = "sourceTable"
        case sourceURL = "sourceUrl"
        case stderr = "stderr"
        case value = "value"
    }

    public init(artifactID: String, evalVersionID: String, id: String, measuredAt: Date?, metric: String, n: Int?, sourceCommit: String?, sourceTable: String?, sourceURL: String, stderr: Double?, value: Double) {
        self.artifactID = artifactID
        self.evalVersionID = evalVersionID
        self.id = id
        self.measuredAt = measuredAt
        self.metric = metric
        self.n = n
        self.sourceCommit = sourceCommit
        self.sourceTable = sourceTable
        self.sourceURL = sourceURL
        self.stderr = stderr
        self.value = value
    }
}

// MARK: MethodResult convenience initializers and mutators

public extension MethodResult {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(MethodResult.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        artifactID: String? = nil,
        evalVersionID: String? = nil,
        id: String? = nil,
        measuredAt: Date?? = nil,
        metric: String? = nil,
        n: Int?? = nil,
        sourceCommit: String?? = nil,
        sourceTable: String?? = nil,
        sourceURL: String? = nil,
        stderr: Double?? = nil,
        value: Double? = nil
    ) -> MethodResult {
        return MethodResult(
            artifactID: artifactID ?? self.artifactID,
            evalVersionID: evalVersionID ?? self.evalVersionID,
            id: id ?? self.id,
            measuredAt: measuredAt ?? self.measuredAt,
            metric: metric ?? self.metric,
            n: n ?? self.n,
            sourceCommit: sourceCommit ?? self.sourceCommit,
            sourceTable: sourceTable ?? self.sourceTable,
            sourceURL: sourceURL ?? self.sourceURL,
            stderr: stderr ?? self.stderr,
            value: value ?? self.value
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Helper functions for creating encoders and decoders

func newJSONDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        decoder.dateDecodingStrategy = .iso8601
    }
    return decoder
}

func newJSONEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        encoder.dateEncodingStrategy = .iso8601
    }
    return encoder
}

// MARK: - Encode/decode helpers

public class JSONNull: Codable, Hashable {

    public static func == (lhs: JSONNull, rhs: JSONNull) -> Bool {
        return true
    }

    public var hashValue: Int {
        return 0
    }

    public func hash(into hasher: inout Hasher) {
        // No-op
    }

    public init() {}

    public required init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if !container.decodeNil() {
            throw DecodingError.typeMismatch(JSONNull.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Wrong type for JSONNull"))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encodeNil()
    }
}

class JSONCodingKey: CodingKey {
    let key: String

    required init?(intValue: Int) {
        return nil
    }

    required init?(stringValue: String) {
        key = stringValue
    }

    var intValue: Int? {
        return nil
    }

    var stringValue: String {
        return key
    }
}

public class JSONAny: Codable {

    public let value: Any

    static func decodingError(forCodingPath codingPath: [CodingKey]) -> DecodingError {
        let context = DecodingError.Context(codingPath: codingPath, debugDescription: "Cannot decode JSONAny")
        return DecodingError.typeMismatch(JSONAny.self, context)
    }

    static func encodingError(forValue value: Any, codingPath: [CodingKey]) -> EncodingError {
        let context = EncodingError.Context(codingPath: codingPath, debugDescription: "Cannot encode JSONAny")
        return EncodingError.invalidValue(value, context)
    }

    static func decode(from container: SingleValueDecodingContainer) throws -> Any {
        if let value = try? container.decode(Bool.self) {
            return value
        }
        if let value = try? container.decode(Int64.self) {
            return value
        }
        if let value = try? container.decode(Double.self) {
            return value
        }
        if let value = try? container.decode(String.self) {
            return value
        }
        if container.decodeNil() {
            return JSONNull()
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout UnkeyedDecodingContainer) throws -> Any {
        if let value = try? container.decode(Bool.self) {
            return value
        }
        if let value = try? container.decode(Int64.self) {
            return value
        }
        if let value = try? container.decode(Double.self) {
            return value
        }
        if let value = try? container.decode(String.self) {
            return value
        }
        if let value = try? container.decodeNil() {
            if value {
                return JSONNull()
            }
        }
        if var container = try? container.nestedUnkeyedContainer() {
            return try decodeArray(from: &container)
        }
        if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self) {
            return try decodeDictionary(from: &container)
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decode(from container: inout KeyedDecodingContainer<JSONCodingKey>, forKey key: JSONCodingKey) throws -> Any {
        if let value = try? container.decode(Bool.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Int64.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(Double.self, forKey: key) {
            return value
        }
        if let value = try? container.decode(String.self, forKey: key) {
            return value
        }
        if let value = try? container.decodeNil(forKey: key) {
            if value {
                return JSONNull()
            }
        }
        if var container = try? container.nestedUnkeyedContainer(forKey: key) {
            return try decodeArray(from: &container)
        }
        if var container = try? container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key) {
            return try decodeDictionary(from: &container)
        }
        throw decodingError(forCodingPath: container.codingPath)
    }

    static func decodeArray(from container: inout UnkeyedDecodingContainer) throws -> [Any] {
        var arr: [Any] = []
        while !container.isAtEnd {
            let value = try decode(from: &container)
            arr.append(value)
        }
        return arr
    }

    static func decodeDictionary(from container: inout KeyedDecodingContainer<JSONCodingKey>) throws -> [String: Any] {
        var dict = [String: Any]()
        for key in container.allKeys {
            let value = try decode(from: &container, forKey: key)
            dict[key.stringValue] = value
        }
        return dict
    }

    static func encode(to container: inout UnkeyedEncodingContainer, array: [Any]) throws {
        for value in array {
            if let value = value as? Bool {
                try container.encode(value)
            } else if let value = value as? Int64 {
                try container.encode(value)
            } else if let value = value as? Double {
                try container.encode(value)
            } else if let value = value as? String {
                try container.encode(value)
            } else if value is JSONNull {
                try container.encodeNil()
            } else if let value = value as? [Any] {
                var container = container.nestedUnkeyedContainer()
                try encode(to: &container, array: value)
            } else if let value = value as? [String: Any] {
                var container = container.nestedContainer(keyedBy: JSONCodingKey.self)
                try encode(to: &container, dictionary: value)
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }
    }

    static func encode(to container: inout KeyedEncodingContainer<JSONCodingKey>, dictionary: [String: Any]) throws {
        for (key, value) in dictionary {
            let key = JSONCodingKey(stringValue: key)!
            if let value = value as? Bool {
                try container.encode(value, forKey: key)
            } else if let value = value as? Int64 {
                try container.encode(value, forKey: key)
            } else if let value = value as? Double {
                try container.encode(value, forKey: key)
            } else if let value = value as? String {
                try container.encode(value, forKey: key)
            } else if value is JSONNull {
                try container.encodeNil(forKey: key)
            } else if let value = value as? [Any] {
                var container = container.nestedUnkeyedContainer(forKey: key)
                try encode(to: &container, array: value)
            } else if let value = value as? [String: Any] {
                var container = container.nestedContainer(keyedBy: JSONCodingKey.self, forKey: key)
                try encode(to: &container, dictionary: value)
            } else {
                throw encodingError(forValue: value, codingPath: container.codingPath)
            }
        }
    }

    static func encode(to container: inout SingleValueEncodingContainer, value: Any) throws {
        if let value = value as? Bool {
            try container.encode(value)
        } else if let value = value as? Int64 {
            try container.encode(value)
        } else if let value = value as? Double {
            try container.encode(value)
        } else if let value = value as? String {
            try container.encode(value)
        } else if value is JSONNull {
            try container.encodeNil()
        } else {
            throw encodingError(forValue: value, codingPath: container.codingPath)
        }
    }

    public required init(from decoder: Decoder) throws {
        if var arrayContainer = try? decoder.unkeyedContainer() {
            self.value = try JSONAny.decodeArray(from: &arrayContainer)
        } else if var container = try? decoder.container(keyedBy: JSONCodingKey.self) {
            self.value = try JSONAny.decodeDictionary(from: &container)
        } else {
            let container = try decoder.singleValueContainer()
            self.value = try JSONAny.decode(from: container)
        }
    }

    public func encode(to encoder: Encoder) throws {
        if let arr = self.value as? [Any] {
            var container = encoder.unkeyedContainer()
            try JSONAny.encode(to: &container, array: arr)
        } else if let dict = self.value as? [String: Any] {
            var container = encoder.container(keyedBy: JSONCodingKey.self)
            try JSONAny.encode(to: &container, dictionary: dict)
        } else {
            var container = encoder.singleValueContainer()
            try JSONAny.encode(to: &container, value: self.value)
        }
    }
}
