# メーカネース・ナーヴィス 創作・公開リポジトリ

設定の原本はYAMLとMarkdown、作品本文はUTF-8テキストで管理します。
公開先は `https://mekhanes.3lraven.net`。静的サイトをCloudflare Pages、問い合わせをWorkers Freeで動かす構成です。

## ディレクトリ

| パス | 用途 | Git管理 |
| --- | --- | --- |
| `mekhanes/` | メーカネース・ナーヴィスの設定・キャラクター・参照画像と音声 | 対象 |
| `chaimsphere/` | カイムスフィアの設定 | 対象 |
| `publish/` | 公開用の作品本文 | 対象 |
| `website/` | Pages用のサイト生成・公開対象リスト・デザイン | 対象（distと依存パッケージを除く） |
| `workers/contact/` | メールフォーム受付Worker | 対象（秘密鍵と依存パッケージを除く） |
| `scripts/` | 公開原稿から投稿先別の分割テキストを作る補助スクリプト | 対象 |
| `products/` | 旧版、執筆資料、投稿先別の出力、音楽・挿絵の制作資料 | 対象外 |
| `archive/` | SQLite旧ツール、Python CLI、PDF組版環境などのローカル退避 | 対象外（旧コードは過去のGit履歴にも残る） |

`settings/` は廃止し、その中の世界観ディレクトリをルート直下へ移しました。
現在のWeb公開に必要な実行環境はNode.js 22以降です。Python CLIとVivliostyleによる一覧生成・PDF組版は廃止しました。

## ローカル確認

PowerShell 7でリポジトリのルートから実行します。

```powershell
npm --prefix website ci
npm --prefix website run build
npm --prefix website test
npm --prefix website run preview
```

`http://127.0.0.1:4173` で閲覧できます。Web用のビルドは `website/` に独立しています。
ビルド・プレビュー・テストは上記の `npm --prefix website ...` を使います。

キャラクターの編集・設定画の指定は [docs/characters.md](docs/characters.md)、作品の追加は [publish/README.md](publish/README.md)、
Cloudflareの公開設定は [docs/cloudflare-publishing.md](docs/cloudflare-publishing.md) を参照してください。
旧構成の退避先は [docs/repository-cleanup.md](docs/repository-cleanup.md) に記録しています。

## 公開対象

`website/publication.json` が公開リストです。現在は世界観資料・企業資料・二次創作ガイドラインと
『THE WITCH OF MIASMA』の本編31話＋外伝1話を出力します。
世界観ページは「世界設定」「企業」「キャラクター」の3分類で、子ページにそれぞれの一覧を置きます。
`characters: true` のとき、`mekhanes/*/profile.yaml` をビルド時に解析し、読み順のキャラクター一覧と個別ページを生成します。
プロフィール・外見・性格・能力・背景・装備・関係性などを表示し、関係性の相手は名前・別名・企業名が一意に一致するとリンクになります。
表示する項目は `website/scripts/characters.mjs` で定義しています。
設定画は各YAMLの `publication.images` に指定した最大3枚を掲載します。`publication.variants` に指定した別分岐は `variants/<分岐名>/profile.yaml` から生成し、親ページと相互リンクします。指定していない画像や音声、生YAML、制作メタデータ、カイムスフィアはWeb出力に含めません。

`publish/the-witch-of-miasma/chapters/` の原稿は、2026年9月14日に `products/THE_WITCH_OF_MIASMA/` 直下から
内容を変更せず移動しました。以後の本文修正はこちらに行います。投稿用分割スクリプトもこちらを参照します。

`master` へのpushによりPagesが自動ビルド・公開します。GitHub Actionsはビルドと検証を実行します。
問い合わせWorkerの更新は `workers/contact/` から手動でデプロイします。
