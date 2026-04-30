# 車庫証明PDFフォーム GitHub Pages版

このフォルダの中身をGitHubリポジトリ直下へアップすると、GitHub Pagesだけで車庫証明PDFを作成できます。

## アップロードするもの

```text
index.html
styles.css
app.js
templates/
README.md
```

`templates/` の中には警察様式PDFが入っています。

```text
templates/application.pdf
templates/map_layout.pdf
templates/permission.pdf
templates/self_certification.pdf
```

## 動き

- ブラウザ内で既存PDFテンプレートを読み込みます。
- `pdf-lib` で文字、丸印、地図画像を重ねます。
- 作成したPDFはブラウザ内の一時URLとしてプレビューします。
- Google DriveやGASには送信しません。

## 地図

フォーム上の地図はOpenStreetMapです。住所検索または地図クリックで地点を設定できます。

PDF作成時は、選択した緯度経度からOpenStreetMapタイルをブラウザで合成して、所在図・配置図に貼り付けます。画像を手動アップロードした場合は、アップロード画像を優先します。
