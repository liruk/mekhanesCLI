$ErrorActionPreference = 'Stop'

$sourceDir = Join-Path $PSScriptRoot '..\products\THE_WITCH_OF_MIASMA'
$outputDir = Join-Path $sourceDir 'separeted'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# Line numbers are one-based and refer to the fixed source manuscript.
# Marker cuts remove the marker line. Paragraph cuts occur after a blank line.
$rules = @{
    '01' = @{ Marker = @();        After = @(186); Remove = @() }
    '02' = @{ Marker = @(185);     After = @();    Remove = @() }
    '03' = @{ Marker = @(273);     After = @();    Remove = @() }
    '04' = @{ Marker = @(238);     After = @();    Remove = @() }
    '05' = @{ Marker = @(240);     After = @();    Remove = @() }
    '06' = @{ Marker = @(118);     After = @();    Remove = @() }
    '07' = @{ Marker = @();        After = @(161); Remove = @() }
    '08' = @{ Marker = @(143);     After = @();    Remove = @() }
    '09' = @{ Marker = @(179);     After = @();    Remove = @() }
    '10' = @{ Marker = @();        After = @(241); Remove = @() }
    '12' = @{ Marker = @(263);     After = @();    Remove = @() }
    '13' = @{ Marker = @(410);     After = @();    Remove = @() }
    '16' = @{ Marker = @();        After = @(223); Remove = @() }
    '17' = @{ Marker = @(440);     After = @();    Remove = @() }
    '19' = @{ Marker = @();        After = @(225); Remove = @() }
    '20' = @{ Marker = @(221);     After = @();    Remove = @() }
    '21' = @{ Marker = @();        After = @(164); Remove = @() }
    '22' = @{ Marker = @(210);     After = @();    Remove = @() }
    '24' = @{ Marker = @();        After = @(178); Remove = @() }
    '25' = @{ Marker = @();        After = @(150, 308); Remove = @(115, 299) }
    '27' = @{ Marker = @(278);     After = @();    Remove = @() }
    '28' = @{ Marker = @(119);     After = @();    Remove = @() }
    '31' = @{ Marker = @(149);     After = @();    Remove = @() }
}

$sourceFiles = Get-ChildItem -LiteralPath $sourceDir -Filter '*.txt' -File |
    Sort-Object Name

foreach ($file in $sourceFiles) {
    $lines = [System.IO.File]::ReadAllLines($file.FullName, $utf8NoBom)
    $sourceStem = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $sourceTokens = $sourceStem -split '_', 2
    $rule = $rules[$sourceTokens[0]]
    $parts = [System.Collections.Generic.List[object]]::new()
    $current = [System.Collections.Generic.List[string]]::new()

    for ($index = 0; $index -lt $lines.Length; $index++) {
        $lineNumber = $index + 1

        if ($null -ne $rule -and $rule.Marker -contains $lineNumber) {
            $parts.Add($current.ToArray())
            $current = [System.Collections.Generic.List[string]]::new()
            continue
        }

        if ($null -ne $rule -and $rule.Remove -contains $lineNumber) {
            continue
        }

        $current.Add($lines[$index])

        if ($null -ne $rule -and $rule.After -contains $lineNumber) {
            $parts.Add($current.ToArray())
            $current = [System.Collections.Generic.List[string]]::new()
        }
    }

    $parts.Add($current.ToArray())

    $episode = $sourceTokens[0]
    $title = $sourceTokens[1]

    for ($partIndex = 0; $partIndex -lt $parts.Count; $partIndex++) {
        $partLines = [System.Collections.Generic.List[string]]::new()
        foreach ($line in $parts[$partIndex]) {
            $partLines.Add($line)
        }

        while ($partLines.Count -gt 0 -and [string]::IsNullOrWhiteSpace($partLines[0])) {
            $partLines.RemoveAt(0)
        }
        while ($partLines.Count -gt 0 -and [string]::IsNullOrWhiteSpace($partLines[$partLines.Count - 1])) {
            $partLines.RemoveAt($partLines.Count - 1)
        }

        $partNumber = ($partIndex + 1).ToString('00')
        $outputName = "${episode}_${partNumber}_${title}.txt"
        $outputPath = Join-Path $outputDir $outputName
        $content = ($partLines -join "`r`n") + "`r`n"
        [System.IO.File]::WriteAllText($outputPath, $content, $utf8NoBom)
    }
}
