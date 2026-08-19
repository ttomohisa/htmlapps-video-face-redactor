# GitHub Pages公開ガイド

このリポジトリでは、完全内包版のVideo Face RedactorをGitHub Actionsで生成し、`dist/` をGitHub Pagesへ自動公開します。

公開URL：

```text
https://ttomohisa.github.io/htmlapps-video-face-redactor/
```

## 1. 最初にGitHub Pagesを有効にする

1. GitHubでこのリポジトリを開きます。
2. **Settings -> Pages** を開きます。
3. **Build and deployment** の **Source** で **GitHub Actions** を選択します。

ブランチの `/root` や `/docs` を公開する方式ではありません。Actionsで生成した `dist/` をPages用成果物として公開します。

## 2. デプロイする

次のどちらかで実行できます。

- `main` ブランチへプッシュ
- **Actions -> Deploy standalone app to GitHub Pages -> Run workflow** を手動実行

ワークフローでは次の処理を行います。

1. リポジトリをチェックアウト
2. 利用可能なら固定版MP4Box.jsのキャッシュを復元
3. リポジトリ検査を実行
4. `dist/index.html` と自己解凍HTMLを生成
5. Pagesが有効か確認
6. `dist/` をGitHub Pages用成果物としてアップロード
7. `github-pages` 環境へデプロイ

Pagesがまだ有効になっていない場合でもビルド自体は成功扱いとし、公開だけをスキップしてActionsの概要に設定手順を表示します。

## 3. 公開を確認する

Deployジョブが成功したら次を開きます。

```text
https://ttomohisa.github.io/htmlapps-video-face-redactor/
```

GitHub Pages版は最初のHTMLだけGitHubから取得します。ユーザーが選択した動画はその後ブラウザ内で処理され、アプリから外部へアップロードされません。

## 更新の流れ

通常は変更を `main` へプッシュするだけです。Pages用ワークフローがソースと固定依存からHTMLを再生成するため、`dist/index.html` を手動でコミットする必要はありません。

Pull Requestでは `build-standalone.yml` がビルド検証を行い、Pages公開は `main` へのpushまたは手動実行時に行います。

## トラブルシューティング

### PagesのURLが404になる

- **Settings -> Pages -> Source** が **GitHub Actions** になっているか確認します。
- **Deploy standalone app to GitHub Pages** が成功しているか確認します。
- 初回公開直後は少し待ってから再読み込みします。

### `configure-pages` でPagesサイトが存在しないエラーになる

最初に **Settings -> Pages -> GitHub Actions** を一度設定し、その後ワークフローを再実行してください。このリポジトリの公開ワークフローは、`configure-pages` より前にPagesの有効状態を確認するため、未設定でもビルドそのものは失敗しません。

### 依存ファイルの取得で失敗する

ビルド時には `dependencies.json` で固定したMP4Box.jsを取得します。一時的な通信エラーの場合はActionsから再実行してください。
