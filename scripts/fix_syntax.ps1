$path = "e:\GenAi\expirimental project\code reviewer H\code-sentinel-ai\src\agents\projectBuilder.js"
if (Test-Path $path) {
    Write-Host "Reading file..."
    $content = Get-Content $path -Raw
    
    # Backslash + Backtick
    $bad = [char]92 + [char]96
    # Just Backtick
    $good = [char]96
    
    if ($content.Contains($bad)) {
        Write-Host "Found bad sequence (Backslash+Backtick)."
        $content = $content.Replace($bad, $good)
        Set-Content $path $content -Encoding UTF8
        Write-Host "File saved successfully."
    } else {
        Write-Host "No bad sequence found. File is clean or pattern mismatch."
    }
}
