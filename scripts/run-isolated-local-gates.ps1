param([switch]$FormatOnly)

$originalEnvironment = [Environment]::GetEnvironmentVariables("Process")
$originalLocation = Get-Location

try {
  $ErrorActionPreference = "Stop"
  $projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  Set-Location $projectRoot

  $allowlist = @(
    "PATH", "Path", "PATHEXT", "ComSpec", "SystemRoot", "WINDIR",
    "SystemDrive", "TEMP", "TMP", "USERPROFILE", "APPDATA",
    "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH", "ProgramFiles",
    "ProgramFiles(x86)"
  )

  foreach ($entry in [Environment]::GetEnvironmentVariables("Process").GetEnumerator()) {
    if ($allowlist -notcontains [string]$entry.Key) {
      [Environment]::SetEnvironmentVariable([string]$entry.Key, $null, "Process")
    }
  }

  Get-ChildItem -LiteralPath $projectRoot -Force -File |
    Where-Object { $_.Name -match '^\.env(?:\..+)?$' } |
    ForEach-Object {
      foreach ($line in Get-Content -LiteralPath $_.FullName) {
        if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=') {
          [Environment]::SetEnvironmentVariable($Matches[1], "", "Process")
        }
      }
    }

  $env:APP_ENV = "local"
  $env:APP_URL = "http://127.0.0.1:3112"
  $env:CATALOG_SOURCE = "local"
  $env:NODE_ENV = "production"
  $env:NEXT_DIST_DIR = ".next-nav-security-review"
  $env:NEXT_TELEMETRY_DISABLED = "1"
  $env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9"
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ""

  $changedFiles = @(
    "docs/progress.md",
    "docs/test-evidence.md",
    "docs/remediation/agents/navigation-performance.md",
    "playwright.navigation.config.ts",
    "scripts/run-isolated-navigation-playwright.mjs",
    "src/features/account/ProfileEditor.tsx",
    "src/sections/BottomNavigation.tsx",
    "src/sections/RouteLoading.tsx",
    "src/sections/route-loading.module.css",
    "src/app/(storefront)/loja/[categoria]/loading.tsx",
    "src/app/(storefront)/produto/[slug]/loading.tsx",
    "src/app/admin/produtos/[id]/loading.tsx",
    "tests/e2e/navigation-initial-indicator.spec.ts"
  )
  $changedFileCheck = "npx prettier --check " + (($changedFiles | ForEach-Object { "`"$_`"" }) -join " ")

  $gates = if ($FormatOnly) {
    @("npm run format:check", $changedFileCheck)
  } else {
    @(
      "npm run typecheck",
      "npm run lint",
      "npm run format:check",
      $changedFileCheck,
      "npm run build"
    )
  }

  foreach ($gate in $gates) {
    Write-Output "RUN: $gate"
    Invoke-Expression $gate
    if ($LASTEXITCODE -ne 0) {
      throw "A validation gate failed with exit code $LASTEXITCODE."
    }
  }
}
finally {
  try {
    $currentEnvironment = [Environment]::GetEnvironmentVariables("Process")
    foreach ($name in $currentEnvironment.Keys) {
      [Environment]::SetEnvironmentVariable([string]$name, $null, "Process")
    }

    foreach ($entry in $originalEnvironment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable(
        [string]$entry.Key,
        [string]$entry.Value,
        "Process"
      )
    }
  }
  finally {
    try {
      Set-Location -LiteralPath $originalLocation.Path -ErrorAction Stop
    }
    catch {
      # Do not replace a gate failure with a location-restore failure.
    }
  }
}
