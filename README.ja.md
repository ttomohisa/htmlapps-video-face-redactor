# Video Face Redactor / 動画顔ぼかし

[![Build standalone HTML](https://github.com/ttomohisa/htmlapps-video-face-redactor/actions/workflows/build-standalone.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-video-face-redactor/actions/workflows/build-standalone.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](#すぐに使う)

[English README](README.md)

動画内の顔を自動で見つけ、**モザイク / ぼかし / 塗りつぶし / 絵文字**で隠してMP4へ保存できる、プライバシー重視の単一HTMLアプリです。

選択した動画はサーバーへアップロードせず、顔検出・確認と修正・マスク処理・動画の書き出しまでブラウザ内で行います。H.264/AVC動画に加え、ブラウザ・端末が対応している場合はH.265/HEVC動画も読み込めます。

## 主な機能

- 動画を読み込むと顔検出を自動開始
- YuNet + ONNX Runtime Webによる端末内の顔検出
- 再解析時は **1 / 2 / 5 / 10回/秒** から顔を探す細かさを選択
- 最後の1コマも追加で確認し、動画末尾の顔漏れを抑制
- 元動画の縦横比を保った顔解析でマスク位置のズレを低減
- **1コマ前 / 1コマ次** と連続再生による確認・編集
- 実際の動画フレーム時刻に合わせた正確な1コマ確認
- 位置がずれた場面だけ **この場面の顔を探し直す** で修正
- モザイク / ぼかし / 塗りつぶし / 絵文字
- 顔の端まで隠すための余白調整
- 自動検出で見つからなかった顔への手動マスク
- 手動マスクの時間を **1コマ / 前後1秒 / 前後3秒 / 前後5秒 / 動画全体** から選択
- 手動マスクごとに、動きに合わせる / 同じ位置のままを選択
- 元解像度 / 1080p / 720pで書き出し
- 書き出すMP4のファイル名を指定可能
- 対応するAAC音声は無変換で引き継ぎ
- 1つのHTML内で日本語・英語を切り替え
- Safe Area対応のスマートフォン固定ボトムナビ
- スマートフォンでは顔検出の進捗を動画プレビュー上に表示
- SVG faviconをHTML内に埋め込み
- `connect-src 'none'` で実行時ネットワーク通信を遮断
- 単一HTML + 自己解凍HTMLを生成可能

> 顔検出・追跡は完全ではありません。共有する前に、書き出した動画を最初から最後まで必ず確認してください。

## すぐに使う

### 単一HTMLで使う

1. Windowsで一度 `build-standalone.bat` を実行します。
2. 生成された `dist/index.html` またはリポジトリ直下の `video-face-redactor.html` を対応ブラウザで開きます。
3. MP4 / MOV動画を選びます。
4. 動画の読み込み後、自動で顔検出が始まります。

アカウント登録、動画のアップロード、Python、Node.js、ローカルWebサーバーは不要です。

### 完全オフラインで使う

一度ビルドした後は `dist/index.html` を好きな場所へコピーして、そのHTML単体をインターネット接続なしで開けます。

顔検出モデルや実行ライブラリはHTML内に入っています。初回ビルド時のみ、ビルドに必要な固定版MP4Box.jsを取得するためネットワーク接続を使います。

## 使い方

1. ファイル選択または空のプレビュー画面からMP4 / MOV動画を選びます。
2. 動画を読み込むと顔検出が自動で始まります。進捗はプレビュー上にも表示されます。
3. **確認・編集** で動画を連続再生するか、**1コマ前 / 1コマ次** で細かく確認します。
4. マスク位置がずれている場面では動画を止め、**この場面の顔を探し直す** を使います。
5. **隠し方** からモザイク / ぼかし / 塗りつぶし / 絵文字を選びます。
6. 顔の端が見える場合は **隠す範囲の余白** を調整します。
7. 顔を見つけられていない場面では **この場面に手動で追加** を使い、時間と動き方を設定します。
8. 書き出すファイル名、解像度、画質、音声を設定します。
9. H.264 MP4を書き出し、共有前に動画全体をもう一度確認します。

### スマートフォンでの操作

画面幅600px以下では、画面下に固定ナビを表示します。

- **動画** — 動画の選択・入れ替え
- **顔検出** — 顔を探す設定・再解析
- **確認・編集** — 再生、1コマ確認、位置修正
- **隠し方** — モザイク / ぼかし / 塗りつぶし / 絵文字、手動マスク
- **保存** — ファイル名・画質・書き出し

スマートフォンでは隠し方をプレビューのすぐ下に配置し、動画を見ながら4種類を横一列で切り替えられます。**隠す範囲の余白** は動画位置バーと混同しないよう、小さな補助操作として表示します。

## 対応形式

### 読み込み動画

| 映像 | 対応状況 |
| --- | --- |
| H.264 / AVC (`avc1.*`, `avc3.*`) | その動画をブラウザが再生処理できる場合に対応 |
| H.265 / HEVC (`hvc1.*`, `hev1.*`) | ブラウザ・OS・端末がWebCodecsのHEVCデコードに対応している場合に対応 |
| AV1 / VP9 | v1では非対応 |

Pixelで撮影した動画に見られる `hvc1.1.6.L123` のようなHEVC動画も、現在のブラウザ・端末がHEVCデコードに対応していれば利用できます。動画を選んだときに、この端末で開けるかを自動確認します。

### 書き出し動画

書き出しは **H.264 MP4** です。入力がH.265/HEVCでも、出力はH.264へ変換します。

選択した解像度でこのブラウザ・端末がH.264を書き出せるかを自動確認し、対応していない場合は書き出しを有効にしません。

### 音声

対応するAAC (`mp4a`) 音声は再圧縮せず、そのまま新しいMP4へ引き継ぎます。v1で扱えない音声形式の場合は警告を表示し、無音で書き出します。

## 開発とビルド

```text
.
├─ src/index.template.html          # アプリ本体と内包ランタイム
├─ app.config.json                  # アプリ情報・出力設定
├─ dependencies.json                # 固定版MP4Box.jsの情報
├─ build-standalone.bat             # Windows用ビルド入口
├─ build-standalone.ps1             # 単一HTML生成処理
├─ scripts/
│  ├─ build-self-extract.ps1        # 自己解凍HTML生成
│  ├─ check-repository.ps1          # リポジトリ検査
│  └─ verify-self-extract.ps1       # 自己解凍版の検証
├─ dist/index.html                  # 生成される単一HTML
├─ video-face-redactor.html         # リポジトリ直下にも生成する単一HTML
└─ .github/workflows/
   └─ build-standalone.yml          # push / Pull Request時のビルド検証
```

### Windowsでビルド

```bat
build-standalone.bat
```

初回だけ `dependencies.json` で固定した **MP4Box.js 2.4.1** を取得し、`vendor/` にキャッシュします。

依存ファイルを再取得する場合：

```powershell
.\build-standalone.ps1 -RefreshDependencies
```

自己解凍版を生成しない場合：

```powershell
.\build-standalone.ps1 -SkipSelfExtract
```

ビルド処理は以下を自動で行います。

- 固定版MP4Box.js 2.4.1のESMファイルを、未取得時だけダウンロード
- MP4Box.jsをgzip圧縮してからBase64で単一HTMLへ内包
- ONNX Runtime WebのJavaScript、WASM、YuNetモデルをgzip圧縮した状態でHTMLへ内包
- 依存ファイルの未置換プレースホルダーを検査
- 実行時の外部 `<script src="https://...">` が残っていないことを検査
- 元URL、ファイルサイズ、SHA-256を `dist/dependency-manifest.json` に記録
- `dist/index.html` を生成
- `dist/index.self-extract.html` を生成
- リポジトリ直下に `video-face-redactor.html` も生成

Python、Node.js、ローカルWebサーバーは必要ありません。

## 処理の流れ

```text
MP4 / MOV
   ↓
MP4Box.js
   ↓
H.264 / H.265 の動画データ
   ↓
ブラウザの動画デコード
   ↓
各フレーム
   ├─ YuNetで顔検出 → 顔位置をつなぐ → 確認・手動修正
   └─ Canvasで顔を隠す → H.264へ再エンコード
                                      ↓
対応するAAC音声 ─────── そのままコピー ─┤
                                      ↓
                                  MP4Box.js
                                      ↓
                                     MP4
```

## プライバシーと通信防止

生成した単一HTMLには、顔検出と動画処理に必要な実行データを内包します。

- 選択した動画はブラウザ内で処理
- 動画・音声をサーバーへアップロードする処理なし
- YuNetモデル、ONNX Runtime Web JavaScript、ONNX Runtime WebAssemblyをHTMLへ内包
- MP4Box.jsもビルド時にHTMLへ内包
- `connect-src 'none'` を含むContent Security Policyで実行時通信を遮断
- 生成済みアプリの実行中はCDNへ接続しない

ビルド時には固定依存ファイルの取得でネットワークを使用する場合がありますが、これは動画処理時の通信とは別です。

## 制限事項

- 顔検出・追跡は完全ではありません。速い動き、顔の一時的な隠れ、極端な角度、とても小さい顔では見逃しや位置ずれが起きる場合があります。
- H.265 / HEVC入力は、ブラウザ・OS・端末側の対応状況に依存します。
- 入力がHEVCでも、書き出しはH.264 MP4です。
- v1では非AAC音声を再エンコードしないため、入力によっては無音で書き出します。
- 長時間動画や4K動画では、MP4完成まで圧縮済みデータや書き出し結果をメモリに保持するため、メモリ使用量が増えます。
- 特殊なMOV構成や回転情報の組み合わせは、今後の互換性改善対象です。
- 書き出した動画は、共有前に必ず最初から最後まで確認してください。

## 使用ライブラリ

| ライブラリ / モデル | バージョン | ライセンス | 用途 |
| --- | ---: | --- | --- |
| ONNX Runtime Web | 1.27.0 | MIT | ブラウザ内でYuNetを実行 |
| YuNet顔検出モデル | 内包モデル | MIT | 顔検出 |
| MP4Box.js | 2.4.1 | BSD-3-Clause | MP4/MOVの読み込み、動画データ抽出、MP4生成 |
| WebCodecs | ブラウザAPI | — | 動画のデコードとH.264エンコード |

第三者ライブラリの詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を確認してください。

## コントリビューション

バグ報告や機能提案はGitHub Issuesからお願いします。

## ライセンス

Copyright © 2026 ttomohisa

このプロジェクトは [MIT License](LICENSE) で公開されています。
