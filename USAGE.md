# Mekhaneth CLI 活用ガイド

このプロジェクトでは、キャラクター情報を YAML ファイルで一元管理し、閲覧用ドキュメントを自動生成します。

## 構造

- **`<world>/<character>/profile.yaml`**: キャラクター情報の Source of Truth です。
- **`<world>/<character>/*.wav`**: そのキャラクターの音声リファレンスです。
- **`mekhanes/`** と **`chaimsphere/`**: 世界観ごとのキャラクターデータ置き場です。
- **`<world>/world/`**: 世界観ごとの設定資料・生成ドキュメント置き場です。
- **`<world>/world/characters.md`**: YAML から自動生成される閲覧用ドキュメントです。
- **`<world>/world/emotion_matrix.md`**: YAML から自動生成される相関図です。

## 基本的な使い方

### 1. キャラクター情報を編集する

`<world>/<character>/profile.yaml` を直接編集してください。背景、外見、性格、他キャラクターへの感情などを記述できます。

現在は `mekhanes` と `chaimsphere` を同列の世界観ディレクトリとして扱います。

### 2. ドキュメントを更新する

編集した内容を各世界観の `<world>/world/characters.md` や `<world>/world/emotion_matrix.md` に反映させるには、以下のコマンドを実行します。

```powershell
cd mekhaneth-cli
uv run python main.py build
```

## 技術的な詳細

- **環境管理**: [uv](https://github.com/astral-sh/uv) を使用しています。
- **言語**: Python 3.10+（`pyproject.toml` に準拠）
- **依存ライブラリ**:
  - `ruamel.yaml`: コメントや順序を保持したまま YAML を操作します。
  - `jinja2`: Markdown のテンプレートエンジンとして使用します。

## 注意事項

> [!WARNING]
> `<world>/world/characters.md` や `emotion_matrix.md` を手動で編集しないでください。ビルド時に YAML の内容で上書きされます。必ず `<world>/<character>/profile.yaml` を編集してください。

世界観の走査対象は `mekhaneth-cli/main.py` の `WORLD_NAMES` で明示しています。
新しい世界観を追加する場合はここへ登録します。`publish/` や `archive/` は走査しません。

Web公開用の構成とコマンドは [README.md](README.md) を参照してください。
