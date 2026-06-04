# Starts the Spring Boot backend, downloading Maven automatically if needed.
param([string]$MavenVersion = "3.9.9")

$ErrorActionPreference = "Stop"

# Validate JAVA_HOME is set and javac exists
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\javac.exe")) {
    Write-Host "ERROR: JAVA_HOME is not properly set or javac not found." -ForegroundColor Red
    Write-Host "Set JAVA_HOME to: C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot" -ForegroundColor Yellow
    Write-Host "Then add %JAVA_HOME%\bin to your system PATH." -ForegroundColor Yellow
    exit 1
}

$MavenDir  = Join-Path $PSScriptRoot ".maven\apache-maven-$MavenVersion"
$MavenExe  = Join-Path $MavenDir "bin\mvn.cmd"
$CacheDir  = Join-Path $PSScriptRoot ".maven"

if (Get-Command mvn -ErrorAction SilentlyContinue) {
    Write-Host "Using system Maven." -ForegroundColor Cyan
    mvn spring-boot:run
} else {
    if (-not (Test-Path $MavenExe)) {
        Write-Host "Maven not found. Downloading Maven $MavenVersion..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
        $zipPath = Join-Path $CacheDir "maven.zip"
        $urls = @(
            "https://dlcdn.apache.org/maven/maven-3/$MavenVersion/binaries/apache-maven-$MavenVersion-bin.zip",
            "https://archive.apache.org/dist/maven/maven-3/$MavenVersion/binaries/apache-maven-$MavenVersion-bin.zip"
        )
        $downloaded = $false
        foreach ($u in $urls) {
            try {
                Invoke-WebRequest -Uri $u -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
                Write-Host "Downloaded Maven from $u" -ForegroundColor Green
                $downloaded = $true
                break
            } catch {
                Write-Host "Download failed for $u : $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        if (-not $downloaded) {
            Write-Host "Failed to download Maven. Please install Maven manually or check network access." -ForegroundColor Red
            exit 1
        }
        Expand-Archive -Path $zipPath -DestinationPath $CacheDir -Force
        Remove-Item $zipPath
        Write-Host "Maven downloaded." -ForegroundColor Green
    }
    Write-Host "Starting Spring Boot backend on http://localhost:8080 ..." -ForegroundColor Cyan
    & $MavenExe spring-boot:run
}
