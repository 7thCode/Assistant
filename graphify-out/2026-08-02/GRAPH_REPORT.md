# Graph Report - .  (2026-07-26)

## Corpus Check
- Corpus is ~17,098 words - fits in a single context window. You may not need a graph.

## Summary
- 390 nodes · 574 edges · 19 communities (18 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.74)
- Token cost: 70,000 input · 7,238 output

## Community Hubs (Navigation)
- RAG Vector Store (Qdrant)
- ESLint Tooling & Dependencies
- App Shell & Header UI
- Core Runtime Dependencies
- TypeScript Config (Renderer)
- Chat Model Message UI
- TypeScript Config (Main Process)
- Package Manifest
- Electron RPC Bridge
- Main Process Entry & MCP Client
- MCP Tool Bridging (Local + OpenAI)
- RAG Chunking & Embeddings
- Preload Bridge & Secret Storage
- Project Branding & Scaffolding
- Electron Env Type Declarations
- Vite External Modules Config

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 24 edges
2. `compilerOptions` - 22 edges
3. `ingestFile()` - 12 edges
4. `readSettings()` - 12 edges
5. `scripts` - 12 edges
6. `writeSettings()` - 7 edges
7. `resolveModelDirectory()` - 7 edges
8. `./electron` - 7 edges
9. `README: Electron + TypeScript + React + Vite + node-llama-cpp` - 7 edges
10. `listAllTools()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `src/index.html (Electron renderer HTML entry point)` --references--> `Vite Logo (default template favicon)`  [EXTRACTED]
  src/index.html → public/vite.svg
- `createRendererSideBirpc()` --indirect_call--> `serializeErrors()`  [INFERRED]
  src/utils/createRendererSideBirpc.ts → electron/utils/serializeErrors.ts
- `src/index.html (Electron renderer HTML entry point)` --references--> `Electron`  [EXTRACTED]
  src/index.html → README.md
- `src/index.html (Electron renderer HTML entry point)` --references--> `TypeScript`  [EXTRACTED]
  src/index.html → README.md
- `src/index.html (Electron renderer HTML entry point)` --references--> `React`  [EXTRACTED]
  src/index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Electron/TypeScript/React/Vite/node-llama-cpp Tech Stack** — readme_electron, readme_typescript, readme_react, readme_vite, readme_node_llama_cpp [EXTRACTED 1.00]
- **Vite/Electron Template Scaffolding Assets** — readme_document, src_index_document, public_vite_vitelogo [INFERRED 0.75]

## Communities (19 total, 1 thin omitted)

### Community 0 - "RAG Vector Store (Qdrant)"
Cohesion: 0.07
Nodes (44): ChunkToUpsert, clearCollection(), deleteDocument(), DocumentSummary, getDocumentCount(), isReachable(), listDocuments(), RetrievedChunk (+36 more)

### Community 1 - "ESLint Tooling & Dependencies"
Cohesion: 0.04
Nodes (49): cross-env, electron, eslint, @eslint/compat, eslint-import-resolver-typescript, eslint-plugin-import, eslint-plugin-jsdoc, eslint-plugin-n (+41 more)

### Community 2 - "App Shell & Header UI"
Cohesion: 0.09
Nodes (19): App(), errorMessage(), DivProps, FixedDivWithSpacer(), FixedDivWithSpacerProps, Header(), HeaderProps, InputRow() (+11 more)

### Community 3 - "Core Runtime Dependencies"
Cohesion: 0.07
Nodes (29): birpc, classnames, @fontsource-variable/inter, highlight.js, lifecycle-utils, markdown-it, @modelcontextprotocol/sdk, node-llama-cpp (+21 more)

### Community 4 - "TypeScript Config (Renderer)"
Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules (+19 more)

### Community 5 - "Chat Model Message UI"
Cohesion: 0.10
Nodes (17): SimplifiedModelChatItem, ModelMessageCopyButton(), ModelMessageCopyButtonProps, ModelMessage(), ModelMessageProps, ModelResponseComment(), ModelResponseCommentProps, ModelResponseThought() (+9 more)

### Community 6 - "TypeScript Config (Main Process)"
Cohesion: 0.08
Nodes (25): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib (+17 more)

### Community 7 - "Package Manifest"
Cohesion: 0.08
Nodes (23): allowScripts, node-llama-cpp, author, email, name, homepage, main, name (+15 more)

### Community 8 - "Electron RPC Bridge"
Cohesion: 0.17
Nodes (14): ElectronFunctions, ElectronLlmRpc, ingestDocumentFile(), selectEmbeddingModelFile(), selectModelDirectory(), selectModelFile(), resolveModelDirectory(), LlmState (+6 more)

### Community 9 - "Main Process Entry & MCP Client"
Cohesion: 0.12
Nodes (19): createWindow(), __dirname, MAIN_DIST, RENDERER_DIST, ConnectedServer, connectedServers, connectionErrors, connectServer() (+11 more)

### Community 10 - "MCP Tool Bridging (Local + OpenAI)"
Cohesion: 0.15
Nodes (17): getModelFunctions(), JsonSchemaObject, jsonSchemaToGbnf(), callTool(), listAllTools(), getEffectiveApiKey(), getEffectiveModel(), getMcpToolsForOpenAi() (+9 more)

### Community 11 - "RAG Chunking & Embeddings"
Cohesion: 0.19
Nodes (18): Chunk, chunkText(), ChunkTextOptions, detokenizeTokens(), embed(), embedPassage(), embedQuery(), getEmbeddingVectorSize() (+10 more)

### Community 12 - "Preload Bridge & Secret Storage"
Cohesion: 0.16
Nodes (8): getKeyFilePath(), getStoredOpenAiApiKey(), hasStoredOpenAiApiKey(), setStoredOpenAiApiKey(), ./electron, ./src, include, references

### Community 13 - "Project Branding & Scaffolding"
Cohesion: 0.25
Nodes (11): App Icon (chat bubble with 3-node graph glyph), Vite Logo (default template favicon), README: Electron + TypeScript + React + Vite + node-llama-cpp, Electron, ESLint rules, node-llama-cpp, npm, React (+3 more)

### Community 14 - "Electron Env Type Declarations"
Cohesion: 0.50
Nodes (3): NodeJS, ProcessEnv, Window

## Knowledge Gaps
- **156 isolated node(s):** `NodeJS`, `ProcessEnv`, `Window`, `__dirname`, `MAIN_DIST` (+151 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `ESLint Tooling & Dependencies` to `Package Manifest`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Why does `./electron` connect `Preload Bridge & Secret Storage` to `Electron RPC Bridge`, `Main Process Entry & MCP Client`, `RAG Vector Store (Qdrant)`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `ingestFile()` (e.g. with `detokenizeTokens()` and `tokenizeText()`) actually correct?**
  _`ingestFile()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `NodeJS`, `ProcessEnv`, `Window` to the rest of the system?**
  _156 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RAG Vector Store (Qdrant)` be split into smaller, more focused modules?**
  _Cohesion score 0.07294117647058823 - nodes in this community are weakly interconnected._
- **Should `ESLint Tooling & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `App Shell & Header UI` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._