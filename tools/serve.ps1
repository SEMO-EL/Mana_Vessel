# Dev server for Mana Vessel 3D.
#   GET  /<path>          -> static file from the project root
#   PUT  /__save/<path>   -> writes the request body to <project>/<path>
#                            (only under assets/ or build/, so a page can
#                             never overwrite source by accident)
# There is no Node or Python on this machine, hence PowerShell.
param([int]$Port = 8140)
$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Output "LISTEN-FAIL: $_"; exit 1 }
Write-Output "SERVING $root on http://localhost:$Port/"

$types = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.png'='image/png';
  '.jpg'='image/jpeg'; '.glb'='model/gltf-binary'; '.gltf'='model/gltf+json';
  '.bin'='application/octet-stream'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $res.Headers.Add('Cache-Control', 'no-store')
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')

    if ($req.HttpMethod -eq 'PUT' -and $rel.StartsWith('__save/')) {
      $target = $rel.Substring(7)
      if (-not ($target.StartsWith('assets/') -or $target.StartsWith('build/')) -or $target.Contains('..')) {
        $res.StatusCode = 403
      } else {
        $full = Join-Path $root $target
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $full) | Out-Null
        $ms = New-Object System.IO.MemoryStream
        $req.InputStream.CopyTo($ms)
        [System.IO.File]::WriteAllBytes($full, $ms.ToArray())
        Write-Output ("SAVED {0} ({1} bytes)" -f $target, $ms.Length)
        $res.StatusCode = 200
      }
      $res.OutputStream.Close(); continue
    }

    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $path = Join-Path $root $rel
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $types[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
    $res.OutputStream.Close()
  } catch { Write-Output "ERR: $_" }
}
