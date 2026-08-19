param(
  [switch]$SkipSelfExtract,
  [switch]$RefreshDependencies,
  [string]$OutputPath = ""
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Source = Join-Path $Root "src\index.template.html"
$ConfigPath = Join-Path $Root "app.config.json"
$DepsPath = Join-Path $Root "dependencies.json"
$VendorDir = Join-Path $Root "vendor"
$SelfExtractBuilder = Join-Path $Root "scripts\build-self-extract.ps1"
function Get-Sha256Hex([string]$Path) {$stream=[IO.File]::OpenRead($Path);try{$sha=[Security.Cryptography.SHA256]::Create();try{return (($sha.ComputeHash($stream)|ForEach-Object{$_.ToString("x2")})-join"")}finally{$sha.Dispose()}}finally{$stream.Dispose()}}
function Get-Sha256HexFromBytes([byte[]]$Bytes) {$sha=[Security.Cryptography.SHA256]::Create();try{return (($sha.ComputeHash($Bytes)|ForEach-Object{$_.ToString("x2")})-join"")}finally{$sha.Dispose()}}
function Compress-GzipBytes([byte[]]$Bytes) {
  $buffer=New-Object System.IO.MemoryStream
  try{
    $gzip=New-Object -TypeName System.IO.Compression.GZipStream -ArgumentList $buffer, ([System.IO.Compression.CompressionMode]::Compress)
    try{$gzip.Write($Bytes,0,$Bytes.Length)}finally{$gzip.Dispose()}
    return ,$buffer.ToArray()
  }finally{$buffer.Dispose()}
}
if(-not(Test-Path $Source)){throw "Source file not found: $Source"}
$app=Get-Content -Raw -Encoding UTF8 $ConfigPath|ConvertFrom-Json
$deps=Get-Content -Raw -Encoding UTF8 $DepsPath|ConvertFrom-Json
$mp4dep=$deps.dependencies|Where-Object{$_.name -eq 'mp4box'}|Select-Object -First 1
if(-not $mp4dep){throw 'mp4box dependency is missing'}
New-Item -ItemType Directory -Force -Path $VendorDir|Out-Null
foreach($depFile in $mp4dep.files){
  $local=Join-Path $VendorDir ([string]$depFile.file)
  if($RefreshDependencies -or -not(Test-Path $local)){
    Write-Host "Downloading $($depFile.file) (MP4Box.js $($mp4dep.version))..." -ForegroundColor Cyan
    try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$wc=New-Object Net.WebClient;try{$wc.DownloadFile([string]$depFile.url,$local)}finally{$wc.Dispose()}}catch{throw "Could not download $($depFile.url). Save it manually as $local. $($_.Exception.Message)"}
  }
}
$specified=-not[string]::IsNullOrWhiteSpace($OutputPath)
if(-not $specified){$OutputPath=[string]$app.build.output}
if(-not[IO.Path]::IsPathRooted($OutputPath)){$OutputPath=Join-Path $Root $OutputPath}
$OutDir=Split-Path -Parent $OutputPath;New-Item -ItemType Directory -Force -Path $OutDir|Out-Null
$html=[IO.File]::ReadAllText($Source,[Text.Encoding]::UTF8)
foreach($depFile in $mp4dep.files){
  $local=Join-Path $VendorDir ([string]$depFile.file)
  $placeholder=[string]$depFile.placeholder
  if(-not $html.Contains($placeholder)){throw "Dependency placeholder missing: $placeholder"}
  $rawBytes=[IO.File]::ReadAllBytes($local)
  $gzipBytes=Compress-GzipBytes $rawBytes
  $payload=[Convert]::ToBase64String($gzipBytes)
  $html=$html.Replace($placeholder,$payload)
}
$required=@('Video Face Redactor','connect-src ''none''','ORT_JS_GZIP','ORT_WASM_GZIP','YUNET_GZIP','VideoDecoder','VideoEncoder','MP4Box.createFile()','MP4BOX_MAIN_GZIP_B64','gunzipTextB64','emoji')
foreach($item in $required){if(-not $html.Contains($item)){throw "Required content missing: $item"}}
if($html.Contains('__MP4BOX_')){throw 'Unresolved MP4Box build placeholder found'}
if($html -match '<script[^>]+src=["'']https?://'){throw 'Runtime external script source detected'}
[IO.File]::WriteAllText($OutputPath,$html,(New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $OutDir '.nojekyll'),'',(New-Object Text.UTF8Encoding($false)))
# Keep a convenient expanded root-level copy for local use and GitHub releases.
$RootHtml = Join-Path $Root 'video-face-redactor.html'
[IO.File]::WriteAllText($RootHtml,$html,(New-Object Text.UTF8Encoding($false)))
# Record exact dependency bytes used for this build.
$manifestFiles=@()
foreach($depFile in $mp4dep.files){
  $local=Join-Path $VendorDir ([string]$depFile.file)
  $rawBytes=[IO.File]::ReadAllBytes($local)
  $gzipBytes=Compress-GzipBytes $rawBytes
  $manifestFiles += [pscustomobject]@{
    file=[string]$depFile.file
    source=[string]$depFile.url
    sha256=(Get-Sha256Hex $local)
    bytes=$rawBytes.Length
    embedded=[pscustomobject]@{
      compression='gzip'
      bytes=$gzipBytes.Length
      sha256=(Get-Sha256HexFromBytes $gzipBytes)
      encoding='base64'
    }
  }
}
$manifest=[pscustomobject]@{
  generatedAt=[DateTime]::UtcNow.ToString('o')
  app=[pscustomobject]@{name=[string]$app.name;version=[string]$app.version}
  dependencies=@([pscustomobject]@{name=[string]$mp4dep.name;version=[string]$mp4dep.version;license=[string]$mp4dep.license;files=$manifestFiles})
}
$manifestPath=Join-Path $OutDir 'dependency-manifest.json'
$manifestJson=$manifest|ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($manifestPath,$manifestJson,(New-Object Text.UTF8Encoding($false)))
Write-Host "Built Video Face Redactor $($app.version)" -ForegroundColor Green
Write-Host "Output: $OutputPath"
Write-Host "Root copy: $RootHtml"
Write-Host "Dependency manifest: $manifestPath"
Write-Host "Size: $([Math]::Round((Get-Item $OutputPath).Length/1MB,2)) MB"
Write-Host "Embedded libraries: gzip + Base64 (runtime remains offline)" -ForegroundColor DarkGray
Write-Host "SHA-256: $(Get-Sha256Hex $OutputPath)"
if(-not $SkipSelfExtract -and [bool]$app.build.selfExtract.enabled){
  if(-not(Test-Path $SelfExtractBuilder)){throw "Self-extract builder not found: $SelfExtractBuilder"}
  $selfOut=if($specified){Join-Path (Split-Path -Parent $OutputPath) (([IO.Path]::GetFileNameWithoutExtension($OutputPath))+'.self-extract.html')}else{Join-Path $Root ([string]$app.build.selfExtract.output)}
  & $SelfExtractBuilder -InputPath $OutputPath -OutputPath $selfOut -AppName ([string]$app.name) -AppNameJa ([string]$app.nameJa)
}
