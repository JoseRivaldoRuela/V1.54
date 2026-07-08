$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$ticketsDir = Join-Path $root 'tickets'

function Parse-Objects {
  param([string]$Pdf)

  $objects = @{}
  $regex = [regex]'(?s)(\d+)\s+0\s+obj\s*(.*?)\s*endobj'
  foreach ($match in $regex.Matches($Pdf)) {
    $objects[[int]$match.Groups[1].Value] = $match.Groups[2].Value
  }
  return $objects
}

function Extract-Stream {
  param([string]$ObjectBody)

  $match = [regex]::Match($ObjectBody, '(?s)stream\r?\n(.*?)\r?\nendstream')
  if ($match.Success) {
    return $match.Groups[1].Value
  }
  return ''
}

function Parse-CMap {
  param([string]$Stream)

  $map = @{}
  $regex = [regex]'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>'
  foreach ($match in $regex.Matches($Stream)) {
    $src = $match.Groups[1].Value.ToUpperInvariant()
    $dst = $match.Groups[2].Value
    $chars = ''
    for ($i = 0; $i -lt $dst.Length; $i += 4) {
      $piece = $dst.Substring($i, [Math]::Min(4, $dst.Length - $i))
      if ($piece.Length -eq 4) {
        $chars += [char]([Convert]::ToInt32($piece, 16))
      }
    }
    $map[$src] = $chars
  }
  return $map
}

function Decode-HexText {
  param(
    [string]$Hex,
    [hashtable]$CMap
  )

  $clean = ($Hex -replace '\s+', '').ToUpperInvariant()
  $out = ''
  $i = 0
  while ($i -lt $clean.Length) {
    $code4 = if ($i + 4 -le $clean.Length) { $clean.Substring($i, 4) } else { '' }
    $code2 = if ($i + 2 -le $clean.Length) { $clean.Substring($i, 2) } else { '' }

    if ($code4 -and $CMap -and $CMap.ContainsKey($code4)) {
      $out += $CMap[$code4]
      $i += 4
    } elseif ($code2 -and $CMap -and $CMap.ContainsKey($code2)) {
      $out += $CMap[$code2]
      $i += 2
    } else {
      $out += '?'
      if ($code4) { $i += 4 } else { $i += 2 }
    }
  }
  return $out
}

function Extract-TextItems {
  param([string]$Pdf)

  $objects = Parse-Objects $Pdf
  $fontToCMapObject = @{}

  foreach ($objectBody in $objects.Values) {
    $fontMatches = [regex]::Matches($objectBody, '/(F\d+)\s+(\d+)\s+0\s+R')
    foreach ($fontMatch in $fontMatches) {
      $fontName = $fontMatch.Groups[1].Value
      $fontObjectId = [int]$fontMatch.Groups[2].Value
      if ($objects.ContainsKey($fontObjectId)) {
        $toUnicodeMatch = [regex]::Match($objects[$fontObjectId], '/ToUnicode\s+(\d+)\s+0\s+R')
        if ($toUnicodeMatch.Success) {
          $fontToCMapObject[$fontName] = [int]$toUnicodeMatch.Groups[1].Value
        }
      }
    }
  }

  $fontMaps = @{}
  foreach ($fontName in $fontToCMapObject.Keys) {
    $cmapObjectId = $fontToCMapObject[$fontName]
    if ($objects.ContainsKey($cmapObjectId)) {
      $fontMaps[$fontName] = Parse-CMap (Extract-Stream $objects[$cmapObjectId])
    }
  }

  $items = New-Object System.Collections.Generic.List[object]
  foreach ($objectBody in $objects.Values) {
    if ($objectBody -notmatch 'stream' -or $objectBody -notmatch '\bTj\b|\bTf\b|\bBT\b') {
      continue
    }

    $stream = Extract-Stream $objectBody
    $currentFont = $null
    $x = 0.0
    $y = 0.0
    $tokenMatches = [regex]::Matches($stream, '/(F\d+)\s+[\d.]+\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|<([0-9A-Fa-f\s]+)>\s*Tj')
    foreach ($match in $tokenMatches) {
      if ($match.Groups[1].Success) {
        $currentFont = $match.Groups[1].Value
      } elseif ($match.Groups[2].Success) {
        $x = [double]::Parse($match.Groups[2].Value, [Globalization.CultureInfo]::InvariantCulture)
        $y = [double]::Parse($match.Groups[3].Value, [Globalization.CultureInfo]::InvariantCulture)
      } elseif ($match.Groups[4].Success) {
        $cmap = if ($currentFont -and $fontMaps.ContainsKey($currentFont)) { $fontMaps[$currentFont] } else { $null }
        $text = Decode-HexText $match.Groups[4].Value $cmap
        if ($text.Trim()) {
          $items.Add([pscustomobject]@{ X = $x; Y = $y; Text = $text }) | Out-Null
        }
      }
    }
  }

  return $items
}

function Group-Lines {
  param([object[]]$Items)

  $lines = New-Object System.Collections.Generic.List[object]
  foreach ($item in ($Items | Sort-Object @{ Expression = { -$_.Y } }, X)) {
    $line = $null
    foreach ($candidate in $lines) {
      if ([Math]::Abs($candidate.Y - $item.Y) -le 2) {
        $line = $candidate
        break
      }
    }
    if (-not $line) {
      $line = [pscustomobject]@{ Y = $item.Y; Parts = New-Object System.Collections.Generic.List[object] }
      $lines.Add($line) | Out-Null
    }
    $line.Parts.Add($item) | Out-Null
  }

  foreach ($line in $lines) {
    (($line.Parts | Sort-Object X | ForEach-Object { $_.Text }) -join ' ') -replace '\s+', ' '
  }
}

foreach ($file in (Get-ChildItem -LiteralPath $ticketsDir -Filter *.pdf | Sort-Object Name)) {
  $bytes = [IO.File]::ReadAllBytes($file.FullName)
  $pdf = [Text.Encoding]::GetEncoding(28591).GetString($bytes)
  Write-Output ''
  Write-Output "===== $($file.Name) ====="
  Group-Lines (Extract-TextItems $pdf)
}
