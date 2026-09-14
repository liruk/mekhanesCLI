# 旧構成の退避記録

2026年9月14日、Web公開に運用を一本化し、使わなくなった生成ツールをローカルの
`archive/2026-09-14-web-cleanup/` に退避しました。退避先では元の相対パスを維持しています。

| 元のパス | 退避した内容・理由 |
| --- | --- |
| `mekhaneth-cli/`、`templates/`、`USAGE.md` | Python CLIと一覧・相関表の生成手順。WebビルドがYAMLを直接読むため廃止 |
| `mekhanes/world/characters.md`、`emotion_matrix.md` | 旧CLIの生成物。個別ページと関係性リンクへ移行 |
| `chaimsphere/world/characters.md`、`emotion_matrix.md` | 廃止したCLIの生成物。カイムスフィアのYAML原本は維持 |
| ルートの `package.json`、`pnpm-lock.yaml`、`node_modules/` | Vivliostyle用の依存関係 |
| `vivliostyle.config.cjs`、`vivliostyle.css`、`.vivliostyle/` | PDF組版の設定・生成物 |
| `.codex-skill-build/` | インストール済み画風スキルの作成時コピー。Web公開から参照されていない作業用ファイル |

移動したGit追跡対象24ファイルは、移動前後のSHA-256一致を確認しました。
照合記録は退避先の `sha256-manifest.json` にあります。
`archive/` はGit管理外なので、以後のチェックアウトには含まれません。旧ファイルは過去のGit履歴からも復元できます。
旧ツールを再使用する場合は、元の配置と依存関係を復元してください。

執筆用の `examples/`、`GEMINI.md`、`LINKS.md`、投稿用分割スクリプト、画像・音声の原本は現行の創作資料として残しています。
SQLite関連の旧ツールは、先の整理で既に `archive/` へ退避済みです。
