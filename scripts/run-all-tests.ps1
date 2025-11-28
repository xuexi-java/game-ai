# 运行所有测试的 PowerShell 脚本
# 使用方法: .\scripts\run-all-tests.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "开始运行系统测试" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$totalTests = 0
$passedTests = 0
$failedTests = 0

# 运行后端测试
Write-Host "`n[1/3] 运行后端测试..." -ForegroundColor Yellow
Set-Location backend
try {
    npm test
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 后端测试通过" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "✗ 后端测试失败" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "✗ 后端测试失败: $_" -ForegroundColor Red
    $failedTests++
}
$totalTests++
Set-Location ..

# 运行管理端测试
Write-Host "`n[2/3] 运行管理端测试..." -ForegroundColor Yellow
Set-Location admin-portal
try {
    npm test -- --run
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 管理端测试通过" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "✗ 管理端测试失败" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "✗ 管理端测试失败: $_" -ForegroundColor Red
    $failedTests++
}
$totalTests++
Set-Location ..

# 运行玩家端测试
Write-Host "`n[3/3] 运行玩家端测试..." -ForegroundColor Yellow
Set-Location player-app
try {
    npm test -- --run
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 玩家端测试通过" -ForegroundColor Green
        $passedTests++
    } else {
        Write-Host "✗ 玩家端测试失败" -ForegroundColor Red
        $failedTests++
    }
} catch {
    Write-Host "✗ 玩家端测试失败: $_" -ForegroundColor Red
    $failedTests++
}
$totalTests++
Set-Location ..

# 输出总结
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "测试总结" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "总测试套件: $totalTests"
Write-Host "通过: $passedTests" -ForegroundColor Green
if ($failedTests -gt 0) {
    Write-Host "失败: $failedTests" -ForegroundColor Red
    exit 1
} else {
    Write-Host "所有测试通过！" -ForegroundColor Green
    exit 0
}

