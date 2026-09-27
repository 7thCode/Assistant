# Assistant

ローカルLLM(`node-llama-cpp`)がゲートウェイ役になるElectronデスクトップアプリ。簡単な質問はローカルモデルだけで完結させ、ローカルモデルの手に負えない質問だけを ChatGPT / Claude / Gemini に自動転送することで、レスポンス速度・コスト・プライバシーを両立させる。

## 特徴

- **ローカルLLM実行** — `node-llama-cpp` によるオンデバイス推論(Apple SiliconではMetalアクセラレーション)
- **5つの動作モード** — Local / Auto / ChatGPT / Claude / Gemini をヘッダーからワンクリックで切り替え
- **Autoルーティング** — Autoモードでは「この質問にローカルで答えられるか」を判定し、無理なら自動でクラウドへ転送。既定ではローカルモデル自身が判定し、設定でTypeSafeのAPIキーを入れるとJevが判定する(入力したメッセージ本文のみ送信。失敗時はローカル判定に切り替わる)。判定理由はチャット上のバッジにツールチップ表示される
- **コマンドによる強制切り替え** — メッセージの先頭に `/local` `/cloud` `/openai` `/claude` `/gemini` を付けると、その1通だけ強制的に指定プロバイダーへ送信できる
- **安全なAPIキー管理** — 各プロバイダーのAPIキーはOSのKeychain経由(Electron `safeStorage`)で暗号化保存。平文キーがrendererプロセスに渡ることはない
- **MCP(Model Context Protocol)対応** — 設定したMCPサーバーのツールを、ローカルモデル・3つのクラウドプロバイダーすべてで共通して呼び出せる
- **OpenAI互換API** — 設定で有効化すると、`http://127.0.0.1:11500/v1` で OpenAI 互換の `/v1/chat/completions`(ストリーミング対応)と `/v1/models` を提供する。既存のOpenAIクライアントやツールから、ローカル/Autoルーティング付きのゲートウェイとして利用できる(詳細は下記「OpenAI互換API」)
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

## OpenAI互換API

設定画面の「OpenAI互換API」を有効化すると、`127.0.0.1:11500` でサーバーが起動する(既定は無効。外部からは到達できない)。設定画面に表示される Base URL と APIキーをクライアントに設定して使う。APIキーは初回起動時に生成され、OSのKeychainで暗号化して保存されるため、再起動しても変わらない。

```bash
curl http://127.0.0.1:11500/v1/chat/completions \
  -H "Authorization: Bearer <設定画面のAPIキー>" \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "こんにちは"}]}'
```

- **対応エンドポイント**: `GET /v1/models`、`POST /v1/chat/completions`(`stream: true` のSSEに対応)
- **`model` の指定**: ヘッダーのモード切り替えと同じ意味で、`auto` / `local` / `openai` / `anthropic` / `gemini` を指定する。それ以外の値は404(`model_not_found`)になる。`GET /v1/models` は現在利用可能なものだけを返す
- **会話の扱い**: リクエストごとに完結する(履歴はクライアントが `messages` で送る)。アプリ側のチャット画面・履歴・保存セッションには影響しない。`system` メッセージが無い場合は設定画面のシステムプロンプトが使われる
- **ローカル推論**: UIとは別のコンテキストで実行される(初回のローカルリクエスト時に作成。追加のメモリを消費する)。ローカルへのリクエストは1つずつ順番に処理される
- **MCPツール**: アプリに設定したMCPサーバーのツールは、UIと同様にどのプロバイダーでも使われる
- **APIキーの再生成**: 設定画面の「再生成」で新しいキーを発行できる。サーバーの再起動は不要で、古いキーは即座に無効になる
- **未対応**: クライアント側の `tools`(指定すると400)、画像などテキスト以外の `content`、`max_tokens` のクラウドプロバイダーへの反映(ローカルのみ有効)、`usage` の返却

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
- `electron/router.ts` — Autoモードのトリアージ(Jevが使えるときはJev、使えない・失敗したときはローカルモデルに「自分で答えられるか」を判定させる)
- `electron/jevClient.ts` — TypeSafe SDKでJevに「ローカル/クラウド」を問い合わせる
- `electron/providers/` — `openaiProvider.ts` / `anthropicProvider.ts` / `geminiProvider.ts` と、共通の `ChatMessage` 型・変換ロジック(`types.ts`)
- `electron/secretStore.ts` — `safeStorage` を使ったAPIキーの暗号化保存
- `electron/rag/` — 埋め込みモデル・Qdrantクライアント・チャンク分割・取り込み処理
- `electron/mcp/` — MCPサーバーとの接続・ツール一覧・呼び出し
- `electron/openaiServer/` — OpenAI互換のHTTPサーバー。実際の推論は `llmFunctions.createStatelessCompletion()`(`llmState.ts`)に委譲する
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
