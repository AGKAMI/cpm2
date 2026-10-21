param()
$b = (Get-Item '.next\BUILD_ID' -ErrorAction Stop).LastWriteTimeUtc
$n = Get-ChildItem -Recurse -File 'src','package.json','next.config.ts' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTimeUtc | Select-Object -Last 1
if ($n -and $n.LastWriteTimeUtc -gt $b) { exit 1 } else { exit 0 }
