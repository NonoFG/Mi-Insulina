[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ProjectUrl,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PublishableKey
)

$ErrorActionPreference = "Stop"
$baseUrl = $ProjectUrl.TrimEnd("/")
$select = [Uri]::EscapeDataString("id,nombre,categorias(nombre),detalles_medida(medida,raciones_hc)")
$order = [Uri]::EscapeDataString("nombre.asc,id.asc")
$uri = "$baseUrl/rest/v1/alimentos?select=$select&order=$order&limit=1"
$headers = @{
  apikey = $PublishableKey
  Authorization = "Bearer $PublishableKey"
  Prefer = "count=exact"
}

try {
  # This audit intentionally makes one bounded GET only. It never probes private
  # relations and never sends POST, PATCH, PUT, or DELETE requests.
  $response = Invoke-WebRequest -Uri $uri -Method Get -Headers $headers -UseBasicParsing
  $rows = @($response.Content | ConvertFrom-Json)
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) {
    throw "REST returned HTTP $([int]$response.StatusCode)."
  }
  if ($rows.Count -eq 0 -or -not $rows[0].id -or -not $rows[0].nombre) {
    throw "The public endpoint returned no recognizable catalog row."
  }

  $contentRange = [string]$response.Headers["Content-Range"]
  Write-Output "GET /rest/v1/alimentos: HTTP $([int]$response.StatusCode)"
  Write-Output "Content-Range: $contentRange"
  Write-Output "Rows returned: $($rows.Count) (query limit: 1)"
  Write-Output "Observed nested fields: categorias.nombre and detalles_medida"
  Write-Output "This confirms public-key read access only; it does not verify RLS metadata, private reads, or write denial."
} catch {
  $status = $null
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $status = [int]$_.Exception.Response.StatusCode
  }
  if ($status) {
    Write-Error "Read-only catalog request failed with HTTP $status. $($_.Exception.Message)"
  } else {
    Write-Error "Read-only catalog request failed. $($_.Exception.Message)"
  }
  exit 1
}
