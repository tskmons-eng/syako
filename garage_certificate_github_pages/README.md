# 車庫証明PDFフォーム GitHub Pages版

このフォルダの中身をGitHubリポジトリへアップし、GitHub Pagesを有効にするとフォーム画面として使えます。

## アップロードするもの

```text
index.html
styles.css
app.js
config.js
README.md
```

## 設定

GASをウェブアプリとしてデプロイしたら、`config.js` の `GAS_ENDPOINT` を差し替えてください。

```js
window.GARAGE_CERTIFICATE_CONFIG = {
  GAS_ENDPOINT: "https://script.google.com/macros/s/xxxxx/exec",
  APP_PASSWORD: ""
};
```

GAS側の `APP_PASSWORD` を設定した場合は、こちらにも同じ値を入れます。
