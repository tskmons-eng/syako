# Google Apps Script設定手順

## 1. Apps Scriptを作る

Google Driveで「新規」→「その他」→「Google Apps Script」を開きます。

## 2. Code.gsを貼る

このフォルダの `Code.gs` の中身を、Apps Scriptの `Code.gs` に貼り付けます。

## 3. 保存先フォルダを設定

PDF保存先を固定したい場合は、DriveフォルダのURLからフォルダIDをコピーして、先頭の `OUTPUT_FOLDER_ID` に入れます。

```js
const OUTPUT_FOLDER_ID = "xxxxxxxxxxxxxxxxxxxx";
```

空のままでも動きます。その場合は `車庫証明PDF出力` というフォルダを自動作成します。

## 4. 必要なら簡易パスワード

```js
const APP_PASSWORD = "好きな文字列";
```

設定した場合は、GitHub Pages側の `config.js` にも同じ値を入れます。

## 5. Webアプリとしてデプロイ

Apps Script画面右上の「デプロイ」→「新しいデプロイ」を開きます。

```text
種類: ウェブアプリ
実行するユーザー: 自分
アクセスできるユーザー: 全員
```

初回はGoogle Driveなどの権限承認が出ます。承認後、表示された `/exec` で終わるURLをコピーします。

## 6. GitHub Pages側へURL設定

`github-pages/config.js` の `GAS_ENDPOINT` に貼ります。

```js
GAS_ENDPOINT: "https://script.google.com/macros/s/xxxxx/exec"
```

## 注意

この最初の版は、Googleドキュメント形式で内容をまとめてPDF化します。警察様式のPDFにぴったり重ねる版ではありません。

まず無料構成で送信とPDF生成を通すための土台です。あとでGoogleスライドの帳票テンプレート差し込み方式に拡張できます。
