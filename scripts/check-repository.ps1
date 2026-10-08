param([switch]$Build)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$required = @(
    'src\index.template.html',
    'app.config.json',
    'dependencies.json',
    'build-standalone.ps1',
    'build-standalone.bat',
    'README.md',
    'README.ja.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    '.github\workflows\deploy-pages.yml',
    'docs\GITHUB_PAGES.md',
    'docs\GITHUB_PAGES.ja.md'
)

foreach ($relativePath in $required) {
    $fullPath = Join-Path $Root $relativePath
    if (-not (Test-Path $fullPath)) {
        throw "Missing: $relativePath"
    }
}

$sourcePath = Join-Path $Root 'src\index.template.html'
$source = [IO.File]::ReadAllText($sourcePath, [Text.Encoding]::UTF8)

# Keep this list ASCII-only so Windows PowerShell 5.1 can parse this script
# correctly regardless of the machine's legacy ANSI code page.
$sourceRequirements = @(
    'Video Face Redactor',
    'VideoDecoder',
    'VideoEncoder',
    '__MP4BOX_MAIN_GZIP_B64__',
    '__MP4BOX_CORE_GZIP_B64__',
    '__MP4BOX_RUNTIME_GZIP_B64__',
    'ORT_JS_GZIP',
    'ORT_WASM_GZIP',
    'YUNET_GZIP',
    'gunzipTextB64',
    'value="emoji"',
    'analysisDone',
    'MP4Box.createFile(true)',
    'VideoDecoder.isConfigSupported',
    'VideoEncoder.isConfigSupported',
    'capDecoder',
    'capEncoder',
    'app-header',
    'prevFrame',
    'nextFrame',
    'manualDuration',
    'manualInterp',
    'lastVideoFrameTimeUs',
    'compactTracks(fps)',
    'requestVideoFrameCallback',
    'manualAnchorTime',
    'anchorTime',
    'redetectCurrentFrame',
    'decodeExactReviewFrame',
    'reviewState',
    'letterbox',
    'appMobileBottomBar',
    'has-mobile-bottom-bar',
    'data-mobile-key="style"',
    'preview-padding-mobile-overlay',
    'effectMobileMount',
    'data-effect-choice="emoji"',
    'data-manual-duration="3"',
    '.viewer.empty canvas{display:none}',
    'viewerOpen',
    'outputName',
    'pendingAutoAnalyze',
    'startAutoAnalysisIfReady',
    'grid-template-columns:repeat(4,minmax(0,1fr))',
    'data-en="Review/Edit"',
    'analysisPreviewProgress',
    'setAnalysisPreviewProgress',
    'review-state.playing',
    'Position estimated',
    'hvc1|hev1',
    'hvcC',
    'decoderCodecCandidates',
    'probeDecoderCodec',
    'input.decoderCodec||input.codec'
)

foreach ($requirement in $sourceRequirements) {
    if (-not $source.Contains($requirement)) {
        throw "Source requirement missing: $requirement"
    }
}

if (($source -match '<script[^>]+src="https?://') -or ($source -match "<script[^>]+src='https?://")) {
    throw 'Runtime external script source detected'
}

if ($source.Contains('const ORT_JS="') -or $source.Contains('const YUNET="')) {
    throw 'Uncompressed embedded detector asset found'
}

& node --test (Join-Path $Root 'tests/export-review.test.cjs') (Join-Path $Root 'tests/audio-timeline.test.cjs') (Join-Path $Root 'tests/help-dialog.test.cjs') (Join-Path $Root 'tests/regression-gates.test.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Application regression tests failed.' }

& node (Join-Path $Root "tests\header-normalization.test.mjs")
if ($LASTEXITCODE -ne 0) { throw "Header normalization regression failed." }
Write-Host 'Repository checks passed.' -ForegroundColor Green

if ($Build) {
    & (Join-Path $Root 'build-standalone.ps1') -SkipSelfExtract
    & node (Join-Path $Root 'scripts/test-artifacts.cjs') --without-self-extract
    if ($LASTEXITCODE -ne 0) { throw 'Built artifact regression tests failed.' }
}
