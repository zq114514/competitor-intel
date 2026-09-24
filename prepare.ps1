# add helper files to webapp
$webapp = "c:\Users\chunsheng\Desktop\S59\AI场景\AI1\webapp"
# .nojekyll
if (-not (Test-Path "$webapp\.nojekyll")) { New-Item -ItemType File -Path "$webapp\.nojekyll" | Out-Null; Write-Host "Created .nojekyll" }
# pages workflow
$wf = "$webapp\.github\workflows"
if (-not (Test-Path $wf)) { New-Item -ItemType Directory -Path $wf -Force | Out-Null; Write-Host "Created .github/workflows" }
@"
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: "https://zq114514.github.io/competitor-intel/"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - id: deployment
        uses: actions/deploy-pages@v4
"@ | Set-Content "$wf\pages.yml" -Encoding UTF8
Write-Host "Created pages.yml"
