# PowerShell 项目启动脚本
# 用于快速启动 AI 客服系统项目

param(
    [string]$Mode = "all",
    [switch]$AutoExit,
    [switch]$SkipDocker
)

# 设置错误处理
$ErrorActionPreference = "Continue"
$script:AutoExitTriggered = $false

# 颜色输出函数
function Write-ColorOutput {
    param($ForegroundColor, $Message)
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Host $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { param($msg) Write-ColorOutput Green $msg }
function Write-Error { param($msg) Write-ColorOutput Red $msg }
function Write-Info { param($msg) Write-ColorOutput Cyan $msg }
function Write-Warning { param($msg) Write-ColorOutput Yellow $msg }

# 显示标题
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "        AI 客服系统 - 项目启动脚本" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
Write-Info "检查 Node.js 环境..."
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Error "未检测到 Node.js，请先安装 Node.js 20.19.5"
    exit 1
}
$nodeVersion = node --version
$nodeExecutable = (Get-Command node | Select-Object -First 1).Source
Write-Success "Node.js 版本: $nodeVersion"

# 检查 npm
$npmCheck = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCheck) {
    Write-Error "未检测到 npm"
    exit 1
}
$npmVersion = npm --version
$npmCommand = (Get-Command npm | Select-Object -First 1).Source
Write-Success "npm 版本: $npmVersion"

# 检查并启动 Docker 服务
if (-not $SkipDocker) {
    Write-Info "检查 Docker 环境..."
    $dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCheck) {
        Write-Error "未检测到 Docker，请先安装 Docker Desktop"
        exit 1
    }

    # 检查 Docker 是否运行
    $dockerInfo = & docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Docker 未运行，尝试自动启动 Docker Desktop..."
        
        # 尝试查找 Docker Desktop 可执行文件
        $dockerDesktopPaths = @(
            "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
            "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
            "${env:LOCALAPPDATA}\Docker\Docker Desktop.exe",
            "${env:ProgramFiles}\Docker\Docker\resources\com.docker.backend.exe"
        )
        
        $dockerDesktopPath = $null
        foreach ($path in $dockerDesktopPaths) {
            if (Test-Path $path) {
                $dockerDesktopPath = $path
                break
            }
        }
        
        if ($dockerDesktopPath) {
            Write-Info "正在启动 Docker Desktop..."
            try {
                Start-Process -FilePath $dockerDesktopPath -ErrorAction Stop
                Write-Success "Docker Desktop 启动命令已执行"
                
                # 等待 Docker 启动（最多等待 60 秒）
                Write-Info "等待 Docker 启动..."
                $maxWaitTime = 60
                $waitTime = 0
                $dockerReady = $false
                
                while ($waitTime -lt $maxWaitTime) {
                    Start-Sleep -Seconds 2
                    $waitTime += 2
                    $dockerCheck = & docker info 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        $dockerReady = $true
                        break
                    }
                    if ($waitTime % 10 -eq 0) {
                        Write-Host "等待 Docker 启动... ($waitTime/$maxWaitTime 秒)" -ForegroundColor Yellow
                    }
                }
                
                if ($dockerReady) {
                    Write-Success "Docker 已启动并运行"
                } else {
                    Write-Warning "Docker 启动超时，但继续尝试..."
                    Write-Warning "如果后续步骤失败，请手动启动 Docker Desktop"
                }
            } catch {
                Write-Error "无法启动 Docker Desktop: $_"
                Write-Error "请手动启动 Docker Desktop 后重试"
                exit 1
            }
        } else {
            Write-Error "未找到 Docker Desktop 可执行文件"
            Write-Error "请手动启动 Docker Desktop 后重试"
            Write-Info "Docker Desktop 通常位于: C:\Program Files\Docker\Docker\Docker Desktop.exe"
            exit 1
        }
    } else {
        Write-Success "Docker 已运行"
    }

    # 检查 docker-compose
    $dockerComposeCheck = Get-Command docker-compose -ErrorAction SilentlyContinue
    if (-not $dockerComposeCheck) {
        Write-Error "docker-compose 不可用，请检查 Docker 安装"
        exit 1
    }
    Write-Success "docker-compose 可用"

    # 启动 Docker 服务
    Write-Info '启动 Docker 服务 (PostgreSQL)...'
    $script:DockerStarted = $false
    $dockerResult = & docker-compose up -d 2>&1
    if ($LASTEXITCODE -eq 0) {
        $script:DockerStarted = $true
        Write-Success "Docker 服务已启动"
    } else {
        Write-Warning "Docker 服务启动可能有问题，继续尝试..."
    }

    # 等待数据库就绪
    Write-Info "等待数据库就绪..."
    $maxRetries = 30
    $retryCount = 0
    $dbReady = $false

    while ($retryCount -lt $maxRetries) {
        $dbCheck = & docker-compose exec -T postgres pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dbReady = $true
            break
        }
        if ($retryCount -lt 5 -or ($retryCount % 5 -eq 0)) {
            Write-Host "等待数据库连接... ($retryCount/$maxRetries)" -ForegroundColor Yellow
        }
        Start-Sleep -Seconds 2
        $retryCount++
    }

    if ($dbReady) {
        Write-Success "数据库已就绪"
    } else {
        Write-Warning "数据库连接超时，但继续启动应用服务..."
        Write-Warning "如果应用启动失败，请检查 Docker 服务状态"
    }
} else {
    Write-Warning "已跳过 Docker 检查和数据库启动步骤"
    $script:DockerStarted = $false
}

# 检查依赖
Write-Info "检查项目依赖..."
$needInstall = $false
if (-not (Test-Path "node_modules")) {
    Write-Warning "根目录依赖未安装"
    $needInstall = $true
}
if (-not (Test-Path "backend/node_modules")) {
    Write-Warning "后端依赖未安装"
    $needInstall = $true
}
if (-not (Test-Path "admin-portal/node_modules")) {
    Write-Warning "管理端依赖未安装"
    $needInstall = $true
}
if (-not (Test-Path "player-app/node_modules")) {
    Write-Warning "玩家端依赖未安装"
    $needInstall = $true
}

if ($needInstall) {
    Write-Warning "检测到依赖未安装，是否现在安装？(Y/N)"
    $installChoice = Read-Host
    if ($installChoice -eq "Y" -or $installChoice -eq "y") {
        Write-Info "正在安装依赖，这可能需要几分钟..."
        & $npmCommand run install:all
        if ($LASTEXITCODE -ne 0) {
            Write-Error "依赖安装失败"
            exit 1
        }
        Write-Success "依赖安装完成"
    } else {
        Write-Warning "跳过依赖安装，如果启动失败请先运行: npm run install:all"
    }
}

# 检查 Prisma Client
if (-not (Test-Path "node_modules/.prisma")) {
    Write-Info "生成 Prisma Client..."
    & $npmCommand run db:generate
}

# 存储进程 ID
$script:processes = @{}

# 获取当前脚本目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptPath) {
    $scriptPath = Get-Location
}

# 启动函数
function Start-Backend {
    Write-Info "启动后端服务..."
    
    # 确保在正确的目录
    $backendPath = Join-Path $scriptPath "backend"
    if (-not (Test-Path $backendPath)) {
        Write-Error "后端目录不存在: $backendPath"
        return $false
    }
    
    # 创建日志目录
    $logDir = Join-Path $scriptPath "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    # 使用 Start-Process 启动后端，这样可以更好地控制环境
    $backendLog = Join-Path $logDir "backend.log"
    $backendErrLog = Join-Path $logDir "backend-error.log"
    
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $npmCommand
    $processInfo.Arguments = "run start:dev"
    $processInfo.WorkingDirectory = $backendPath
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    # 设置环境变量
    $processInfo.EnvironmentVariables["NODE_ENV"] = "development"
    $processInfo.EnvironmentVariables["PORT"] = "3000"
    
    # 继承当前环境变量（特别是 PATH）
    foreach ($key in [System.Environment]::GetEnvironmentVariables("Process").Keys) {
        if (-not $processInfo.EnvironmentVariables.ContainsKey($key)) {
            $processInfo.EnvironmentVariables[$key] = [System.Environment]::GetEnvironmentVariable($key, "Process")
        }
    }
    
    try {
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        
        # 重定向输出到文件
        $stdoutWriter = [System.IO.StreamWriter]::new($backendLog, $true, [System.Text.Encoding]::UTF8)
        $stderrWriter = [System.IO.StreamWriter]::new($backendErrLog, $true, [System.Text.Encoding]::UTF8)
        
        $process.add_OutputDataReceived({
            param($sender, $e)
            if ($e.Data) {
                $stdoutWriter.WriteLine($e.Data)
                $stdoutWriter.Flush()
            }
        })
        
        $process.add_ErrorDataReceived({
            param($sender, $e)
            if ($e.Data) {
                $stderrWriter.WriteLine($e.Data)
                $stderrWriter.Flush()
            }
        })
        
        $process.Start() | Out-Null
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        $script:processes["backend"] = @{
            Process = $process
            LogFile = $backendLog
            ErrLogFile = $backendErrLog
            StdoutWriter = $stdoutWriter
            StderrWriter = $stderrWriter
        }
        
        Write-Success "后端服务已启动 (PID: $($process.Id))"
        Write-Info "后端地址: http://localhost:3000"
        Write-Info "日志文件: $backendLog"
        
        # 等待服务启动（最多等待30秒）
        Write-Info "等待后端服务就绪..."
        $maxWait = 30
        $waited = 0
        $isReady = $false
        
        while ($waited -lt $maxWait) {
            Start-Sleep -Seconds 2
            $waited += 2
            
            # 检查进程是否还在运行
            if ($process.HasExited) {
                Write-Error "后端进程意外退出，退出代码: $($process.ExitCode)"
                Write-Error "请查看错误日志: $backendErrLog"
                if (Test-Path $backendErrLog) {
                    Write-Error "错误日志最后10行:"
                    Get-Content $backendErrLog -Tail 10 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
                }
                return $false
            }
            
            # 尝试连接健康检查端点
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    $isReady = $true
                    break
                }
            } catch {
                # 继续等待
            }
            
            if ($waited % 5 -eq 0) {
                Write-Host "等待后端启动... ($waited/$maxWait 秒)" -ForegroundColor Yellow
            }
        }
        
        if ($isReady) {
            Write-Success "后端服务已就绪"
        } else {
            Write-Warning "后端服务启动超时，但进程仍在运行"
            Write-Warning "请检查日志: $backendLog"
            Write-Warning "如果服务未正常启动，请查看错误日志: $backendErrLog"
        }
        
        return $true
    } catch {
        Write-Error "启动后端服务失败: $_"
        return $false
    }
}

function Start-Admin {
    Write-Info "启动管理端前端..."
    
    $adminPath = Join-Path $scriptPath "admin-portal"
    if (-not (Test-Path $adminPath)) {
        Write-Error "管理端目录不存在: $adminPath"
        return $false
    }
    
    $logDir = Join-Path $scriptPath "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    $adminLog = Join-Path $logDir "admin.log"
    $adminErrLog = Join-Path $logDir "admin-error.log"
    
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $npmCommand
    $processInfo.Arguments = "run dev"
    $processInfo.WorkingDirectory = $adminPath
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    # 继承当前环境变量（特别是 PATH）
    foreach ($key in [System.Environment]::GetEnvironmentVariables("Process").Keys) {
        if (-not $processInfo.EnvironmentVariables.ContainsKey($key)) {
            $processInfo.EnvironmentVariables[$key] = [System.Environment]::GetEnvironmentVariable($key, "Process")
        }
    }
    
    try {
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        
        $stdoutWriter = [System.IO.StreamWriter]::new($adminLog, $true, [System.Text.Encoding]::UTF8)
        $stderrWriter = [System.IO.StreamWriter]::new($adminErrLog, $true, [System.Text.Encoding]::UTF8)
        
        $process.add_OutputDataReceived({
            param($sender, $e)
            if ($e.Data) {
                $stdoutWriter.WriteLine($e.Data)
                $stdoutWriter.Flush()
            }
        })
        
        $process.add_ErrorDataReceived({
            param($sender, $e)
            if ($e.Data) {
                $stderrWriter.WriteLine($e.Data)
                $stderrWriter.Flush()
            }
        })
        
        $process.Start() | Out-Null
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        $script:processes["admin"] = @{
            Process = $process
            LogFile = $adminLog
            ErrLogFile = $adminErrLog
            StdoutWriter = $stdoutWriter
            StderrWriter = $stderrWriter
        }
        
        Write-Success "管理端前端已启动 (PID: $($process.Id))"
        Write-Info "管理端地址: http://localhost:5173 (默认)"
        Write-Info "日志文件: $adminLog"
        return $true
    } catch {
        Write-Error "启动管理端前端失败: $_"
        return $false
    }
}

function Start-Player {
    Write-Info "启动玩家端前端..."
    
    $playerPath = Join-Path $scriptPath "player-app"
    if (-not (Test-Path $playerPath)) {
        Write-Error "玩家端目录不存在: $playerPath"
        return $false
    }
    
    $logDir = Join-Path $scriptPath "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    $playerLog = Join-Path $logDir "player.log"
    $playerErrLog = Join-Path $logDir "player-error.log"
    
    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = $npmCommand
    $processInfo.Arguments = "run dev"
    $processInfo.WorkingDirectory = $playerPath
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true
    
    # 继承当前环境变量（特别是 PATH）
    foreach ($key in [System.Environment]::GetEnvironmentVariables("Process").Keys) {
        if (-not $processInfo.EnvironmentVariables.ContainsKey($key)) {
            $processInfo.EnvironmentVariables[$key] = [System.Environment]::GetEnvironmentVariable($key, "Process")
        }
    }
    
    try {
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        
        $stdoutWriter = [System.IO.StreamWriter]::new($playerLog, $true, [System.Text.Encoding]::UTF8)
        $stderrWriter = [System.IO.StreamWriter]::new($playerErrLog, $true, [System.Text.Encoding]::UTF8)
        
        $process.add_OutputDataReceived({
            param($sender, $e)
            if ($e.Data) {
                $stdoutWriter.WriteLine($e.Data)
                $stdoutWriter.Flush()
            }
        })
        
        $process.add_ErrorDataReceived({
            param($sender, $e)
            if ($e.Data) {
                $stderrWriter.WriteLine($e.Data)
                $stderrWriter.Flush()
            }
        })
        
        $process.Start() | Out-Null
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()
        
        $script:processes["player"] = @{
            Process = $process
            LogFile = $playerLog
            ErrLogFile = $playerErrLog
            StdoutWriter = $stdoutWriter
            StderrWriter = $stderrWriter
        }
        
        Write-Success "玩家端前端已启动 (PID: $($process.Id))"
        Write-Info "玩家端地址: http://localhost:5174 (默认)"
        Write-Info "日志文件: $playerLog"
        return $true
    } catch {
        Write-Error "启动玩家端前端失败: $_"
        return $false
    }
}

# 根据模式启动服务
Write-Host ""
switch ($Mode.ToLower()) {
    "all" {
        Write-Info "启动模式: 全部服务"
        $null = Start-Backend
        Start-Sleep -Seconds 2
        $null = Start-Admin
        Start-Sleep -Seconds 1
        $null = Start-Player
    }
    "backend" {
        Write-Info "启动模式: 仅后端"
        $null = Start-Backend
    }
    "admin" {
        Write-Info "启动模式: 仅管理端"
        $null = Start-Admin
    }
    "player" {
        Write-Info "启动模式: 仅玩家端"
        $null = Start-Player
    }
    default {
        Write-Error "未知的启动模式: $Mode"
        Write-Info "可用模式: all, backend, admin, player"
        exit 1
    }
}

if ($AutoExit) {
    Write-Info "AutoExit 模式已启用，等待服务初始化..."
    Start-Sleep -Seconds 5
    $script:AutoExitTriggered = $true
    Stop-AllServices
    [Environment]::Exit(0)
}

# 显示启动信息
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "              服务启动完成！" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""

Write-Info "运行中的服务:"
foreach ($key in $script:processes.Keys) {
    $procInfo = $script:processes[$key]
    try {
        if ($procInfo.Process -and -not $procInfo.Process.HasExited) {
            Write-Host "   - $key : 运行中 (PID: $($procInfo.Process.Id))" -ForegroundColor Green
        } else {
            Write-Host "   - $key : 已停止" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   - $key : 未知状态" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Warning "提示:"
Write-Host "   - 按 Ctrl+C 停止所有服务（包括 Docker）"
Write-Host "   - 查看日志文件: logs\*.log"
Write-Host "   - 查看后端日志: Get-Content logs\backend.log -Tail 50 -Wait"
Write-Host "   - 查看管理端日志: Get-Content logs\admin.log -Tail 50 -Wait"
Write-Host "   - 查看玩家端日志: Get-Content logs\player.log -Tail 50 -Wait"
Write-Host ""

# 清理函数
function Stop-AllServices {
    Write-Host ""
    Write-Warning "正在停止所有服务..."
    
    # 停止所有进程
    foreach ($key in $script:processes.Keys) {
        $procInfo = $script:processes[$key]
        try {
            if ($procInfo.Process -and -not $procInfo.Process.HasExited) {
                Write-Info "正在停止: $key (PID: $($procInfo.Process.Id))"
                $procInfo.Process.Kill()
                $procInfo.Process.WaitForExit(5000)
                Write-Success "已停止: $key"
            } else {
                Write-Info "$key 已停止"
            }
            
            # 关闭日志写入器
            if ($procInfo.StdoutWriter) {
                $procInfo.StdoutWriter.Close()
            }
            if ($procInfo.StderrWriter) {
                $procInfo.StderrWriter.Close()
            }
        } catch {
            Write-Warning "停止 $key 时出错: $_"
        }
    }
    
    # 停止 Docker 服务
    if ($script:DockerStarted) {
        Write-Info "正在停止 Docker 服务..."
        $dockerDown = & docker-compose down 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Docker 服务已停止"
        } else {
            Write-Warning "Docker 服务停止可能有问题"
        }
    }
    
    Write-Host ""
    Write-Success "所有服务已停止"
    Write-Host ""
}

# 注册 Ctrl+C 处理
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent PowerShell.Exiting -Action {
    if (-not $script:AutoExitTriggered) {
        Stop-AllServices
    }
}

# 等待用户中断
try {
    Write-Info "服务正在运行中，按 Ctrl+C 停止..."
    while ($true) {
        Start-Sleep -Seconds 5
        
        # 检查服务状态
        $allRunning = $true
        foreach ($key in $script:processes.Keys) {
            $procInfo = $script:processes[$key]
            try {
                if ($procInfo.Process -and $procInfo.Process.HasExited) {
                    Write-Warning "服务 $key 已停止 (退出代码: $($procInfo.Process.ExitCode))"
                    Write-Warning "请查看日志: $($procInfo.LogFile)"
                    $allRunning = $false
                }
            } catch {
                Write-Warning "检查 $key 状态时出错: $_"
                $allRunning = $false
            }
        }
        
        if (-not $allRunning) {
            Write-Warning '部分服务已停止，但脚本继续运行...'
        }
    }
} catch {
    # 捕获中断（Ctrl+C）
    Write-Host ""
    Write-Warning "收到中断信号..."
} finally {
    # 确保清理（包括 Ctrl+C）
    if (-not $script:AutoExitTriggered) {
        Stop-AllServices
    }
}

