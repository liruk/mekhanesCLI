# 公開用作品

公開する本文だけを `publish/<作品ID>/` に置き、Gitで管理します。
執筆途中の原稿・プロット・参考資料は、引き続きGit管理外の `products/` に置けます。

作品を載せるときは、`website/publication.json` の `works` に次の形式で登録します。
掲載順は配列の順です。`chapters` の `source` は作品ディレクトリからの相対パスです。

```json
{
  "slug": "my-story",
  "title": "作品名",
  "description": "作品紹介",
  "chapters": [
    { "slug": "01", "title": "第一話", "source": "01.md" }
  ]
}
```

この場合は `publish/my-story/01.md` を作成します。MarkdownまたはUTF-8の `.txt` が使えます。
登録された本文のみがWebサイトに取り込まれます。未登録の原稿は出力しません。
画像の自動コピーやPDF配信は現時点では実装していません。
