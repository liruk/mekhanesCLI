# キャラクターの編集と設定画

キャラクター設定の原本は `mekhanes/<キャラクター>/profile.yaml` です。
Webビルドが直接YAMLを読み、キャラクター一覧と個別ページを生成します。別の一覧生成コマンドは不要です。
`name` は必須、`reading` は一覧の並び順に使います。`aliases` は関係性からのリンク解決にも使います。

## 設定画を掲載する

画像をそのキャラクターのフォルダに置き、YAMLのトップレベルに次の項目を追加します。
既存の `publication` がある場合は、その `images` を編集します。

```yaml
publication:
  images:
    - src: character-sheet.png
      alt: キャラクターの正面・側面・背面の設定画
      caption: 基本衣装
    - src: images/another-outfit.webp
      alt: 別衣装の設定画
      caption: 別衣装
```

- `src`: `profile.yaml` と同じフォルダを基準とした相対パス。日本語のファイル名も使えます。サブフォルダの区切りは `/` にします。
- `alt`: 画像を説明する代替テキスト。省略時は「キャラクター名の設定画」。
- `caption`: 画像の下に表示する説明。省略できます。
- 枚数は1〜3枚。YAMLに書いた順に、個別ページのプロフィールより前に表示します。
- `publication.images` を省略するか `images: []` にすると設定画を掲載しません。
- 対応形式はPNG、JPEG、WebP。原寸画像へのリンクも表示します。

公開対象はこの指定だけで決まります。制作資料の `design.reference_images` や `misc.設定画`、フォルダ内の他の画像は自動掲載しません。
ファイルの不存在、4枚以上の指定、キャラクターフォルダの外への参照、非対応形式はビルドエラーになります。
画像は加工せずコピーします。大きな画像を追加した場合は、スマートフォンでも表示を確認してください。

初回は画像のある22キャラクターに23枚を指定しています。ノワルミアは既存の設定画2枚、レギオン・オブ・ジェワールはアンナの設定画1枚です。

## 別の姿・分岐を公開する

原本を `mekhanes/<元のキャラクター>/variants/<分岐名>/profile.yaml` に置き、元のキャラクターのYAMLで公開する分岐を指定します。

```yaml
publication:
  variants:
    - ベントリコーサ
  images:
    - src: sanmen.png
      caption: 基本衣装 — 三面図
```

`variants` の各項目は直下のフォルダ名です。指定した分岐だけが公開され、未指定のフォルダは読み込みません。存在しない分岐、重複、パス区切りを含む指定、元のキャラクターフォルダの外を参照するリンクはビルドエラーになります。分岐からさらに分岐を公開する指定には対応していません。

公開URLは `/world/characters/<元のキャラクター>/variants/<分岐名>/` です。親ページの「別の姿・分岐」にリンクが付き、分岐ページには親へのリンクとパンくずが付きます。分岐はキャラクター一覧にも載ります。

分岐のYAMLも通常と同じ `publication.images` で設定画を最大3枚まで選べます。画像パスは分岐の `profile.yaml` からの相対パスです。`variant.continuity` は分岐の説明、`forms` は形態の詳細、`profile.speech` またはトップレベルの `speech` は話し方として表示します。`production` の制作メモ・生成プロンプト・音楽ファイルは自動公開されません。

## 確認と公開

```powershell
npm --prefix website run build
npm --prefix website test
npm --prefix website run preview
```

ローカルの `/world/characters/` から対象キャラクターを開き、画像・説明・原寸リンクを確認します。
YAMLと指定画像を一緒にGitへ追加し、`master` にpushするとPagesへ反映されます。
未追跡の画像はローカルでは表示できても、Gitからビルドする本番環境では読み込めません。
