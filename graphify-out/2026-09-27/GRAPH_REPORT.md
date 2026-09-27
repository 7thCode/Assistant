# Graph Report - assistant  (2026-09-27)

## Corpus Check
- 72 files · ~35,559 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 546 nodes · 940 edges · 25 communities (23 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `53879f73`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- index.ts
- MCP Tool Bridging (Local + OpenAI)
- RAG Chunking & Embeddings
- Preload Bridge & Secret Storage
- Project Branding & Scaffolding
- Electron Env Type Declarations
- Vite External Modules Config
- CLAUDE.md
- Sidebar.tsx
- skillsLoader.ts
- Security Policy

## God Nodes (most connected - your core abstractions)
1. `readSettings()` - 36 edges
2. `compilerOptions` - 24 edges
3. `compilerOptions` - 22 edges
4. `writeSettings()` - 19 edges
5. `scripts` - 12 edges
6. `listAllTools()` - 10 edges
7. `ingestFile()` - 10 edges
8. `resolveModelDirectory()` - 9 edges
9. `./electron` - 9 edges
10. `callTool()` - 8 edges

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

## Communities (25 total, 2 thin omitted)

### Community 0 - "RAG Vector Store (Qdrant)"
Cohesion: 0.08
Nodes (66): createEmptySession(), deleteSessionFile(), deriveSessionTitle(), generateSessionId(), getSessionFilePath(), getSessionsDir(), listSessionSummaries(), readSession() (+58 more)

### Community 1 - "ESLint Tooling & Dependencies"
Cohesion: 0.04
Nodes (49): cross-env, electron, eslint, @eslint/compat, eslint-import-resolver-typescript, eslint-plugin-import, eslint-plugin-jsdoc, eslint-plugin-n (+41 more)

### Community 2 - "App Shell & Header UI"
Cohesion: 0.24
Nodes (7): DivProps, FixedDivWithSpacer(), FixedDivWithSpacerProps, InputRow(), InputRowProps, AbortIconSVG(), AddMessageIconSVG()

### Community 3 - "Core Runtime Dependencies"
Cohesion: 0.05
Nodes (41): @anthropic-ai/sdk, apache-arrow, birpc, classnames, @fontsource/ibm-plex-mono, @fontsource/ibm-plex-sans, @google/genai, highlight.js (+33 more)

### Community 4 - "TypeScript Config (Renderer)"
Cohesion: 0.05
Nodes (31): DOM, DOM.Iterable, ./electron, ./src, compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop (+23 more)

### Community 5 - "Chat Model Message UI"
Cohesion: 0.07
Nodes (26): ExecutedProviderId, ProviderId, SimplifiedModelChatItem, SimplifiedUserChatItem, ChatHistory(), ChatHistoryProps, makeEmptyModelMessage(), ModelMessageCopyButton() (+18 more)

### Community 6 - "TypeScript Config (Main Process)"
Cohesion: 0.08
Nodes (25): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib (+17 more)

### Community 7 - "Package Manifest"
Cohesion: 0.08
Nodes (23): allowScripts, node-llama-cpp, author, email, name, homepage, main, name (+15 more)

### Community 8 - "Electron RPC Bridge"
Cohesion: 0.10
Nodes (24): ElectronFunctions, ElectronLlmRpc, ingestDocumentFile(), selectEmbeddingModelFile(), selectLoraAdapterFile(), selectModelDirectory(), selectModelFile(), selectSkillsDirectory() (+16 more)

### Community 9 - "index.ts"
Cohesion: 0.15
Nodes (16): createWindow(), __dirname, MAIN_DIST, RENDERER_DIST, getLastModelResponseText(), getMcpServerStatus(), McpServerStatus, registerTools() (+8 more)

### Community 10 - "MCP Tool Bridging (Local + OpenAI)"
Cohesion: 0.07
Nodes (44): getModelFunctions(), JsonSchemaObject, jsonSchemaToGbnf(), callTool(), ConnectedServer, connectedServers, connectionErrors, connectServer() (+36 more)

### Community 11 - "RAG Chunking & Embeddings"
Cohesion: 0.09
Nodes (33): Chunk, chunkText(), ChunkTextOptions, detokenizeTokens(), embed(), embedPassage(), embedQuery(), getLoadedEmbeddingModelName() (+25 more)

### Community 12 - "Preload Bridge & Secret Storage"
Cohesion: 0.11
Nodes (29): createAndStoreToken(), errorBody(), getOpenAiServerStatus(), handleChatCompletions(), handleRequest(), HttpError, isAuthorized(), isModelId() (+21 more)

### Community 13 - "Project Branding & Scaffolding"
Cohesion: 0.25
Nodes (11): App Icon (chat bubble with 3-node graph glyph), Vite Logo (default template favicon), README: Electron + TypeScript + React + Vite + node-llama-cpp, Electron, ESLint rules, node-llama-cpp, npm, React (+3 more)

### Community 14 - "Electron Env Type Declarations"
Cohesion: 0.50
Nodes (3): NodeJS, ProcessEnv, Window

### Community 20 - "Sidebar.tsx"
Cohesion: 0.12
Nodes (17): getClient(), getEffectiveApiKey(), isJevAvailable(), JevRouteJudgment, judgeWithJev(), setJevApiKeyOverride(), CloudProviderId, decideProvider() (+9 more)

### Community 22 - "skillsLoader.ts"
Cohesion: 0.33
Nodes (9): createSkillFile(), deleteSkillFile(), loadSkills(), parseSkillFile(), resolveSkillDir(), skillFileContent(), SkillInfo, slugify() (+1 more)

### Community 23 - "Security Policy"
Cohesion: 0.50
Nodes (3): Reporting a Vulnerability, Security Policy, Supported Versions

## Knowledge Gaps
- **182 isolated node(s):** `NodeJS`, `ProcessEnv`, `Window`, `__dirname`, `MAIN_DIST` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `ESLint Tooling & Dependencies` to `Package Manifest`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Core Runtime Dependencies` to `Package Manifest`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Why does `./electron` connect `TypeScript Config (Renderer)` to `RAG Vector Store (Qdrant)`, `Electron RPC Bridge`, `index.ts`, `RAG Chunking & Embeddings`, `Preload Bridge & Secret Storage`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **What connects `NodeJS`, `ProcessEnv`, `Window` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RAG Vector Store (Qdrant)` be split into smaller, more focused modules?**
  _Cohesion score 0.07511737089201878 - nodes in this community are weakly interconnected._
- **Should `ESLint Tooling & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Core Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._