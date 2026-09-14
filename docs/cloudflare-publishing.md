# Cloudflare公開設定

## 公開先と構成

- Pages: `https://mekhanes.3lraven.net`
- Worker: `https://mekhanes.3lraven.net/api/contact`
- メール受信先: `work.liruk@gmail.com`（Worker側の設定のみ。Web出力には含めない）
- 送信元の設定案: `contact@mekhanes.3lraven.net`（Email Routingを有効化したドメインに属する必要がある）

リポジトリの用意だけでは、Pagesプロジェクト・DNS・Turnstile・メールの宛先確認は作成されません。
下記の初期設定後に自動公開が始まります。

## 1. PagesをGitHubへ接続

CloudflareダッシュボードのWorkers & PagesからPagesのGit連携プロジェクトを作成します。
リポジトリは `liruk/mekhanesCLI`、本番ブランチは `master` です。

| 設定 | 値 |
| --- | --- |
| Framework preset | None |
| Root directory | `website` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `NODE_VERSION=22` |

`website/package-lock.json` を使って依存関係をインストールします。
リポジトリ全体はチェックアウトされるので、ビルドは親ディレクトリの `mekhanes/` と `publish/` を参照できます。
ルートにあるVivliostyleのビルドは使用しません。

Build watch pathsは初期値のままならどのファイルへの変更でもビルドします。
絞る場合は `website/*`、`mekhanes/*`、`publish/*` を含め、世界観や本文の変更でビルドが走ることを確認します。
プレビューにも未公開原稿を出したくない場合はPreview deploymentsを無効にします。

## 2. カスタムドメイン

PagesプロジェクトのCustom domainsから `mekhanes.3lraven.net` を追加します。
`3lraven.net` ゾーンに既存の同名DNSレコードがある場合は、用途を確認してから変更します。
Pagesへのドメイン登録を先に行い、ダッシュボードが提示するDNS設定を使います。
WorkerのRouteを重ねるため、このホストのDNSはCloudflareでプロキシする必要があります。

## 3. メール受信の準備

Email Routingで `work.liruk@gmail.com` を宛先として登録し、届く確認メールから認証します。
送信元の `mekhanes.3lraven.net` をEmail Routingのドメイン／サブドメインとして構成します。
`3lraven.net` で既存メールを使っている場合、既存MXを不用意に置換せずサブドメイン側で設定します。
すでにEmail Routingを構成済みのドメインを送信元に使う場合は `MAIL_FROM` を合わせて変更します。

Workers Freeでも、アカウント内で確認済みの宛先への送信は無料で利用できます。
このフォームは固定した管理者宛てに送信し、読者の入力メールは `Reply-To` に使います。
読者宛ての自動返信は実装していません。

## 4. TurnstileとWorker

Turnstileのウィジェットを作成し、許可ホストに `mekhanes.3lraven.net` を登録します。

1. サイトキー（公開可能）はPagesの本番環境変数 `TURNSTILE_SITE_KEY` に登録します。
2. シークレットキーはWorkerのSecret `TURNSTILE_SECRET_KEY` に登録します。
3. Workerの設定を確認してデプロイし、その後Pagesを再ビルドします。

```powershell
Set-Location workers/contact
npm ci
npm test
npm run check  # dry-run。公開しない
npx wrangler login
npx wrangler secret put TURNSTILE_SECRET_KEY
npm run deploy
```

`wrangler.jsonc` にRoute・宛先・送信元・レート制限を記載しています。
SecretはコードやGitへ書きません。ローカルの設定例は `.dev.vars.example` です。
Workerをデプロイする前に送信元ドメインと受信先の確認を完了してください。

フォームはキー未設定なら「準備中」と表示します。キーを設定すると入力欄が表示されます。
Turnstileの成功・ホスト名・actionをサーバーで検証し、入力長、送信元Origin、IPごとの送信回数も確認します。
レート制限はCloudflare拠点ごとの近似的な制限です。厳密なグローバル課金上限としては使いません。
本文とメールアドレスをアプリケーションログへ記録しません。

Pagesの `pages.dev` プレビューにはこの本番Routeは適用されません。
プレビュー環境のサイトキーは空にしておきます。フォームの実送信は本番ドメインの初期設定後に確認します。

## 5. 継続更新

- 世界観: `mekhanes/` のMarkdownを編集。
- 作品: `publish/` の本文を編集。追加時は `website/publication.json` に登録。
- デザイン: `website/` を編集。
- push後、PagesのDeploymentが成功し本番URLへ反映されたことを確認。

Workerの自動デプロイも有効にするなら、Workers Buildsで同じリポジトリを接続し、ルートを
`workers/contact`、デプロイコマンドを `npx wrangler deploy` に設定します。
PagesとWorkerは別のデプロイ対象です。GitHub ActionsのCIだけではWorkerは公開されません。

## 参照

- [Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Pages Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Email Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [Send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
