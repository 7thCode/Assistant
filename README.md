# Assistant

ローカルLLM(`node-llama-cpp`)がゲートウェイ役になるElectronデスクトップアプリ。簡単な質問はローカルモデルだけで完結させ、ローカルモデルの手に負えない質問だけを ChatGPT / Claude / Gemini に自動転送することで、レスポンス速度・コスト・プライバシーを両立させる。

## 特徴

- **ローカルLLM実行** — `node-llama-cpp` によるオンデバイス推論(Apple SiliconではMetalアクセラレーション)
- **5つの動作モード** — Local / Auto / ChatGPT / Claude / Gemini をヘッダーからワンクリックで切り替え
- **Autoルーティング** — Autoモードではローカルモデル自身が「この質問に自分で答えられるか」を判定し、無理なら自動でクラウドへ転送。判定理由はチャット上のバッジにツールチップ表示される
- **コマンドによる強制切り替え** — メッセージの先頭に `/local` `/cloud` `/openai` `/claude` `/gemini` を付けると、その1通だけ強制的に指定プロバイダーへ送信できる
- **安全なAPIキー管理** — 各プロバイダーのAPIキーはOSのKeychain経由(Electron `safeStorage`)で暗号化保存。平文キーがrendererプロセスに渡ることはない
- **MCP(Model Context Protocol)対応** — 設定したMCPサーバーのツールを、ローカルモデル・3つのクラウドプロバイダーすべてで共通して呼び出せる
- **RAG(検索拡張生成)** — Qdrant + ローカル埋め込みモデルにより、取り込んだドキュメントの内容を踏まえた回答が可能。関連度の低い質問には参考情報を注入しない
- **複数チャットセッション** — 会話は自動保存され、サイドバーから一覧・切り替え・削除ができる

## セットアップ

前提: Node.js、npm、macOS(Apple Silicon推奨)。

```bash
npm install
```

`npm install` 後、`postinstall` でローカルチャット用モデル(Qwen2.5-7B-Instruct, Q4_K_M)が `./models` に自動ダウンロードされる。

開発モードで起動:

```bash
npm start
```

初回はヘッダーの再生ボタンでモデルを読み込めばローカルチャットがすぐに使える。ChatGPT / Claude / Gemini を使う場合は、設定画面(歯車アイコン)から各プロバイダーのAPIキーを入力するだけでよい(環境変数は不要)。RAGを使う場合は、別途Qdrantを起動しておく(例: `docker run -d -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant`)。

## 開発用コマンド

```bash
npm start            # 開発モードで起動(Vite dev + Electron)
npm run start:inspect # Node インスペクタを有効にして起動
npm run build         # 型チェック→ビルド→electron-builderでmacOS用.dmgを生成
npm run lint          # ESLint
npm run format         # ESLint --fix
npm run clean          # node_modules / ビルド成果物 / モデルを削除
```

## アーキテクチャ概要

- `electron/state/llmState.ts` — アプリ全体の状態と `prompt()` の中心ロジック。プロバイダーの決定・ストリーミング応答・会話履歴の書き戻しを行う
- `electron/router.ts` — Autoモードのトリアージ(ローカルモデルに「自分で答えられるか」を判定させる)
- `electron/providers/` — `openaiProvider.ts` / `anthropicProvider.ts` / `geminiProvider.ts` と、共通の `ChatMessage` 型・変換ロジック(`types.ts`)
- `electron/secretStore.ts` — `safeStorage` を使ったAPIキーの暗号化保存
- `electron/rag/` — 埋め込みモデル・Qdrantクライアント・チャンク分割・取り込み処理
- `electron/mcp/` — MCPサーバーとの接続・ツール一覧・呼び出し
- `src/App/` — React製UI(ヘッダー、チャット履歴、入力欄、セッションサイドバー、設定モーダル)

rendererプロセスはLLMやAPIキーに直接触れず、IPC(birpc)経由でmainプロセスとやり取りする。

## 環境変数(任意)

設定画面からのAPIキー保存が基本だが、開発時の利便性のため以下の環境変数でも上書きできる(設定画面での値が優先される):

- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`
- `GEMINI_API_KEY` / `GEMINI_MODEL`
- `QDRANT_URL`(既定値: `http://localhost:6333`)

---

> `npm create node-llama-cpp@latest` のテンプレートから開発を開始([詳細](https://node-llama-cpp.withcat.ai/guide/))
