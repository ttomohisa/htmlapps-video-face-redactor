param([switch]$Build)
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$required=@('src\index.template.html','app.config.json','dependencies.json','build-standalone.ps1','build-standalone.bat','README.md','README.ja.md','LICENSE','THIRD_PARTY_NOTICES.md')
foreach($r in $required){if(-not(Test-Path(Join-Path $Root $r))){throw "Missing: $r"}}
$source=[IO.File]::ReadAllText((Join-Path $Root 'src\index.template.html'),[Text.Encoding]::UTF8)
foreach($s in @('Video Face Redactor','VideoDecoder','VideoEncoder','__MP4BOX_MAIN_GZIP_B64__','__MP4BOX_CORE_GZIP_B64__','__MP4BOX_RUNTIME_GZIP_B64__','ORT_JS_GZIP','ORT_WASM_GZIP','YUNET_GZIP','gunzipTextB64','value="emoji"','analysisDone','MP4Box.createFile(true)','VideoDecoder.isConfigSupported','VideoEncoder.isConfigSupported','capDecoder','capEncoder','app-header','prevFrame','nextFrame','manualDuration','manualInterp','lastVideoFrameTimeUs','compactTracks(fps)','requestVideoFrameCallback','manualAnchorTime','anchorTime','redetectCurrentFrame','decodeExactReviewFrame','reviewState','letterbox','appMobileBottomBar','has-mobile-bottom-bar','data-mobile-key="style"','preview-padding-mobile-overlay','effectMobileMount','data-effect-choice="emoji"','data-manual-duration="3"','.viewer.empty canvas{display:none}','viewerOpen','outputName','pendingAutoAnalyze','startAutoAnalysisIfReady','grid-template-columns:repeat(4,minmax(0,1fr))','確認・編集','analysisPreviewProgress','setAnalysisPreviewProgress','review-state.playing','前後から位置を予測','hvc1|hev1','hvcC','decoderCodecCandidates','probeDecoderCodec','input.decoderCodec||input.codec')){if(-not $source.Contains($s)){throw "Source requirement missing: $s"}}
if($source -match '<script[^>]+src=["'']https?://'){throw 'Runtime external script source detected'}
if($source.Contains('const ORT_JS="') -or $source.Contains('const YUNET="')){throw 'Uncompressed embedded detector asset found'}
Write-Host 'Repository checks passed.' -ForegroundColor Green
if($Build){& (Join-Path $Root 'build-standalone.ps1') -SkipSelfExtract}
