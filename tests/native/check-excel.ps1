# Opens only synthetic native-test workbooks in a separate, invisible Excel instance.
$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $PSScriptRoot '../../test-results/native'
$excel = $null
$results = @()
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $excel.AutomationSecurity = 3
    foreach ($filename in @('reporte-sintetico.xlsx', 'workload-35.xlsx', 'workload-100.xlsx')) {
        $workbookPath = (Resolve-Path -LiteralPath (Join-Path $outputDirectory $filename)).Path
        $workbook = $null
        try {
            # UpdateLinks=0, ReadOnly=true; normal open, without repair mode.
            $workbook = $excel.Workbooks.Open($workbookPath, 0, $true)
            $sheets = @()
            foreach ($sheet in $workbook.Worksheets) {
                if ($sheet.UsedRange.HasFormula -ne $false) {
                    throw "Se encontró una fórmula o mezcla de fórmulas en $filename."
                }
                $sheets += @{ name = $sheet.Name; rows = $sheet.UsedRange.Rows.Count; noFormulas = $true }
            }
            if (($sheets.name -join ',') -ne 'Alumnos,Asistencia,Tareas,Lecturas') {
                throw "Las cuatro hojas no coinciden en $filename."
            }
            $results += @{ file = $filename; normalReadOnlyOpen = $true; sheets = $sheets }
        }
        finally {
            if ($null -ne $workbook) { $workbook.Close($false) }
        }
    }
    @{ success = $true; excelVersion = $excel.Version; checkedAt = [DateTime]::UtcNow.ToString('o'); workbooks = $results } |
        ConvertTo-Json -Depth 8 |
        Set-Content -LiteralPath (Join-Path $outputDirectory 'excel-compatible-result.json') -Encoding utf8
    Write-Output 'Tres libros sintéticos abiertos normalmente por Microsoft Excel; cuatro hojas y ninguna fórmula.'
}
finally {
    if ($null -ne $excel) {
        $excel.Quit()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)
    }
}
