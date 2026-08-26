param(
  [string]$DnsName = 'localhost',
  [string]$OutputDir = 'local-certs',
  [string]$CertFileName = 'localhost.crt',
  [string]$KeyFileName = 'localhost.key'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Convert-ToPem {
  param(
    [Parameter(Mandatory = $true)]
    [byte[]]$Bytes,
    [Parameter(Mandatory = $true)]
    [string]$Header
  )

  $base64 = [Convert]::ToBase64String($Bytes)
  $lines = ($base64 -split '(.{1,64})' | Where-Object { $_ })
  return @(
    "-----BEGIN $Header-----"
    $lines
    "-----END $Header-----"
    ''
  ) -join [Environment]::NewLine
}

function Export-PrivateKeyBytes {
  param(
    [Parameter(Mandatory = $true)]
    [System.Security.Cryptography.RSA]$Rsa
  )

  if ($Rsa.PSObject.Methods.Name -contains 'ExportPkcs8PrivateKey') {
    return $Rsa.ExportPkcs8PrivateKey()
  }

  if ($Rsa -is [System.Security.Cryptography.RSACng]) {
    return $Rsa.Key.Export([System.Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
  }

  if ($Rsa.PSObject.Methods.Name -contains 'ExportRSAPrivateKey') {
    return $Rsa.ExportRSAPrivateKey()
  }

  throw 'Impossible d’exporter la clé privée RSA sur cet environnement PowerShell/.NET.'
}

$resolvedOutputDir = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
  $OutputDir
} else {
  Join-Path (Get-Location) $OutputDir
}

New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$subject = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new("CN=$DnsName")
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  $subject,
  $rsa,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)

$sanBuilder = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$sanBuilder.AddDnsName($DnsName)
$request.CertificateExtensions.Add($sanBuilder.Build())
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $false)
)
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,
    $false
  )
)
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
)

$notBefore = [DateTimeOffset]::UtcNow.AddDays(-1)
$notAfter = $notBefore.AddYears(2)
$certificate = $request.CreateSelfSigned($notBefore, $notAfter)

$certPem = Convert-ToPem -Bytes $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert) -Header 'CERTIFICATE'
$keyPem = Convert-ToPem -Bytes (Export-PrivateKeyBytes -Rsa $rsa) -Header 'PRIVATE KEY'

[System.IO.File]::WriteAllText((Join-Path $resolvedOutputDir $CertFileName), $certPem, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $resolvedOutputDir $KeyFileName), $keyPem, [System.Text.UTF8Encoding]::new($false))

Write-Host "Certificat exporté : $(Join-Path $resolvedOutputDir $CertFileName)"
Write-Host "Clé privée exportée : $(Join-Path $resolvedOutputDir $KeyFileName)"
Write-Host 'Note : certificat non installé comme autorité de confiance.'
