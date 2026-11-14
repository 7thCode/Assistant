## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## 開発メモ

コードから読み取れない運用上の事実。

- 起動: `npm run start`(vite dev)。Docker が IPv6 の 5173 を占有していることがあり、Electron が別アプリに接続してしまう。Electron の実機検証では `--port 5199 --strictPort` を付ける。`.claude/launch.json` は `autoPort: true`。
- 検証コマンド: `npx tsc --noEmit` と `npm run lint`。テストスクリプトは無い。
- 開発時の Electron の bundle id は `com.github.Electron`(computer-use のアクセス申請は "Electron")。
- 署名: Apple 証明書が失効しているため、パッケージングは ad-hoc 署名のみ(afterPack の `codesign --force --deep --sign -`)。
- macOS 向けの見た目は `:root.platform-mac`(`src/index.tsx` が付与)と `process.platform === "darwin"`(`electron/index.ts`)でゲートする。Windows/Linux に影響させない。
- ブランチは `master` 基準。作業は feature ブランチ → PR → master へマージ。
- GitHub Pages は master の `/docs`(静的 HTML、共通 `docs/style.css`)。
