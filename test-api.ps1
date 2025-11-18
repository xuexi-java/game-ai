# 测试紧急规则 API

# 1. 登录获取 token
Write-Host "1. 登录..." -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Method POST `
  -Uri "http://localhost:3000/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin123"}'

$token = $loginResponse.data.accessToken
Write-Host "Token: $token" -ForegroundColor Green

# 2. 获取紧急规则列表
Write-Host "`n2. 获取紧急规则列表..." -ForegroundColor Cyan
$rulesResponse = Invoke-RestMethod -Method GET `
  -Uri "http://localhost:3000/api/v1/urgency-rules" `
  -Headers @{"Authorization"="Bearer $token"}

Write-Host "规则数量: $($rulesResponse.data.Count)" -ForegroundColor Green
$rulesResponse.data | ForEach-Object {
  Write-Host "`n规则: $($_.name)" -ForegroundColor Yellow
  Write-Host "  ID: $($_.id)"
  Write-Host "  启用: $($_.enabled)"
  Write-Host "  权重: $($_.priorityWeight)"
  Write-Host "  条件: $($_.conditions | ConvertTo-Json -Compress)"
}

# 3. 获取问题类型列表
Write-Host "`n3. 获取问题类型列表..." -ForegroundColor Cyan
$issueTypesResponse = Invoke-RestMethod -Method GET `
  -Uri "http://localhost:3000/api/v1/issue-types"

Write-Host "问题类型数量: $($issueTypesResponse.data.Count)" -ForegroundColor Green
$issueTypesResponse.data | Select-Object -First 5 | ForEach-Object {
  Write-Host "  $($_.icon) $($_.name) (ID: $($_.id))"
}
