# GitHubへアップするもの

GitHub Pagesにアップするのは、このフォルダです。

```text
github-pages/
```

中身:

```text
index.html
styles.css
app.js
config.js
README.md
```

GASに貼るのは、このファイルです。

```text
gas/Code.gs
```

## 順番

1. Google Apps Scriptを作る
2. `gas/Code.gs` を貼る
3. Webアプリとしてデプロイ
4. GASのURLをコピー
5. `github-pages/config.js` の `GAS_ENDPOINT` に貼る
6. `github-pages/` の中身をGitHubへアップ
7. GitHub Pagesを有効化

## GitHub Pages設定

GitHubのリポジトリ画面で:

```text
Settings
Pages
Build and deployment
Source: Deploy from a branch
Branch: main
Folder: /root
```

`github-pages` の中身だけをリポジトリ直下にアップする場合は `/root` でOKです。

リポジトリ内に `github-pages/` フォルダごと置く場合は、GitHub Pagesの標準設定だと直下の `index.html` を探すため、フォームが開きません。アップロード時は `github-pages` の中身だけを置いてください。
