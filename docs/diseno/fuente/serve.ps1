# Servidor estatico minimo para previsualizar los diagramas en http://localhost:8765/
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8765/")
$listener.Start()
Write-Output "Sirviendo $root en http://localhost:8765/"
$types = @{ ".html" = "text/html; charset=utf-8"; ".js" = "application/javascript; charset=utf-8"; ".svg" = "image/svg+xml" }
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = $ctx.Request.Url.LocalPath.TrimStart('/')
  if (-not $path) { $path = "index.html" }
  $file = Join-Path $root $path
  if ($ctx.Request.HttpMethod -eq "POST" -and $path -match '^export(-servicios)?/[A-Za-z0-9_\-]+\.(svg|png)$') {
    # Guarda en diagramas/export (o export-servicios) los diagramas que envia la pagina
    New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
    $ms = New-Object IO.MemoryStream
    $ctx.Request.InputStream.CopyTo($ms)
    [IO.File]::WriteAllBytes($file, $ms.ToArray())
  } elseif (Test-Path $file -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file)
    if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] }
    $ctx.Response.Headers.Add("Cache-Control", "no-store")
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
