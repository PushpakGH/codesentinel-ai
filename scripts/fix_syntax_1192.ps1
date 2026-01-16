$path = "e:\GenAi\expirimental project\code reviewer H\code-sentinel-ai\src\agents\projectBuilder.js"
if (Test-Path $path) {
    Write-Host "Reading file..."
    $content = Get-Content $path -Raw
    $lines = $content -split '\r?\n'
    $modified = $false
    
    for ($i=0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "bg-amber-50/10") {
            Write-Host "Found target line at $($i+1)"
            $original = $lines[$i]
            
            # 1. Escape start: className={` -> className={\`
            # using char 96 for backtick to be safe
            $backtick = [char]96
            $search1 = "className={$backtick"
            $replace1 = "className={\$backtick"
            
            if ($lines[$i].Contains($search1)) {
                 $lines[$i] = $lines[$i].Replace($search1, $replace1)
            }
            
            # 2. Escape variable: ${className} -> \${className}
            $search2 = '${className}'
            $replace2 = '\${className}'
            if ($lines[$i].Contains($search2)) {
                 $lines[$i] = $lines[$i].Replace($search2, $replace2)
            }
            
            # 3. Escape end: }`} -> }\`}
            $search3 = "}$backtick}"
            $replace3 = "}\$backtick}"
            if ($lines[$i].Contains($search3)) {
                 $lines[$i] = $lines[$i].Replace($search3, $replace3)
            }
            
            if ($lines[$i] -ne $original) {
                $modified = $true
                Write-Host "Line fixed."
            }
        }
    }
    
    if ($modified) {
        $newContent = $lines -join "`r`n"
        Set-Content $path $newContent -Encoding UTF8
        Write-Host "File saved successfully."
    } else {
        Write-Host "Target line not found or already fixed."
    }
} else {
    Write-Host "File not found."
}
