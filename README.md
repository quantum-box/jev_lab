# JEV AI Decision Lab

判断AIのPoCギャラリー。Next.js App Router + React + TypeScriptで、入力・判断タイプ・評価アダプターを型付きレジストリにまとめています。

## Run

```bash
npm install
npm run dev       # http://localhost:3000
npm run typecheck
npm run build
```

外部APIキーや有料モデル呼び出しはありません。先頭8件は固定レスポンス／リプレイ体験、残り17件はComing soonのカタログ表示です。

## Judgment provider contract

評価画面では Replay / Rule baseline / Jev (live) を明示選択できます。Jev live はサーバーのRoute Handlerからのみ、`typesafe/jev-latest` を呼び出します。設定する環境変数名は `TACHYON_API_URL`（省略時は公開APIの既定URL）、`TACHYON_API_TOKEN`、`TACHYON_TENANT_ID` です。値はクライアントへ渡さず、ログにも出力しません。未設定時はReplayへフォールバックせず、設定エラーを表示します。

契約テストは `npm run test:contract` で実行できます（fetchをモックし、エンドポイント、認証ヘッダー、request shape、typed response、未設定時の非フォールバックを検証します）。

## Jev Playground

`/playground` は25件のPoCカタログとは別の学習用ユーティリティです。経費分類と障害緊急度の例を読み込み、`state` のJSON、1つの `questions`（Choice / Score / Noul）、criteria を編集して、Replay / Rule baseline / Jev live を比較できます。画面のrequest previewはTachyon APIに送る `{ model: "typesafe/jev-latest", state, questions }` と同じ形です。

Jev liveは `app/api/playground/route.ts` のサーバー専用Route Handlerだけが呼び出します。必要な環境変数名は `TACHYON_API_URL`、`TACHYON_API_TOKEN`、`TACHYON_TENANT_ID`、任意の価格表示用 `TACHYON_JEV_PRICING_VERSION` です。未設定時はReplayへフォールバックしません。入力はJSONオブジェクト、質問は1件、Choice/Score criteriaは2〜8件、本文は900KB以下に制限し、8秒でタイムアウトします。トークンや入力本文はログに出しません。

確率・confidenceは真実や承認ではなく、隠れたchain-of-thoughtや存在しない根拠を表すものでもありません。入力データの取り扱いに注意し、実運用の意思決定には人の確認を組み合わせてください。

## Evaluation and local history

## Runtime Lab

`/runtime-lab` はカタログの26件目ではなく、環境tickと判断cadenceを分けた共通連続実験ランタイムの検証ユーティリティです。seed付き状態機械が snapshot → allowed candidates → adapter → validator → apply → trace の順に進み、pause/resume、1 step、reset、trace JSON export/import/replay、baseline比較を支えます。pause時は世代を無効化し、in-flightの遅い判断はapplyされません。step/time/concurrency/cost capとsafe actionを設けています。

`lib/runtime.ts` はPoCごとの `updateEnvironment`、`applyAction`、`validateAction` を受ける独立型コアです。Replay/Rule baselineはローカルで再現可能ですが、同じseedでもliveモデル出力の再現性は保証しません。Jev liveは明示選択した操作だけで `/api/runtime-lab` を経由し、`typesafe/jev-latest` に allowed action IDs のChoice、instructions、criteriaを送ります。未設定時はfallbackしません。

`data/evaluations.json` は schema/dataset version付きのリポジトリ固定fixtureです。初期8 PoCを含み、分類3件は tuning 30 / fixed 20、継続系5件は固定seedシナリオ10件です。期待ラベルは人手／ルールラベルであり、モデル出力をground truthにしません。CI・ローカル評価は Replay / Rule のみを使い、Jev liveは評価画面で明示的に選択した場合に限ります。

`/runs` の履歴はブラウザlocalStorageだけに保存され、DBや外部送信はありません。JSON/CSV export、schema検証付きimport、個別実行の表示、全削除を提供します。評価指標は分類のaccuracy/coverage/error rate/confusion matrix、シナリオのcompletion/constraint/follow-through/p50/p95で、主観的品質とconfidenceは別扱いです。

評価fixtureと履歴処理の確認は `npx tsx --test tests/evaluation.test.ts` で実行します。データは小規模なPoC評価用であり、本番性能・モデル品質・業務上の正解を保証しません。

## Architecture

- `lib/pocs.ts`: 25 PoCの単一レジストリ。`Poc`型がslug/title/description/category/decisionType/status/inputSchema/samples/specializedScreen/evaluationAdapterを保証。
- `app/page.tsx`: カテゴリフィルター付きギャラリー。モバイルでは1列に変わり、キーボード操作可能なbutton/linkを使用。
- `app/pocs/[slug]`: サンプル入力、実行可能／未実装の明示、折りたたみの実装情報。
- `app/pocs/[slug]/eval`: loading/error/canceled/missing-key/unimplementedの状態契約を示すリプレイ画面。
- `app/runs`: サンプル実行履歴の表示。

## New PoC template

1. `lib/pocs.ts` の配列に `slug`, `title`, `description`, `category`, `decisionType`, `inputSchema`, `samples`, `specializedScreen`, `evaluationAdapter` を追加。
2. 実行できる場合は `status: 'foreground'` と専用画面／評価アダプターを追加。固定リプレイで検証してからライブプロバイダーを接続する。
3. `npm run typecheck && npm run build` を実行し、モバイル幅とキーボードで `/`, 詳細, `/eval`, `/runs` を確認する。

ゲーム・音声系の体験は、代替テキスト表示と視覚的な状態表示を必ず併記します。
