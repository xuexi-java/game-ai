# 紧急规则问题类型显示测试

## 问题描述

管理端的紧急规则页面中，触发条件没有正确显示问题类型信息。

## 测试步骤

### 1. 打开浏览器控制台

访问: http://localhost:5175/settings/urgency-rules

打开浏览器开发者工具 (F12)，查看 Console 标签

### 2. 查看调试日志

应该看到以下日志：
```
加载的问题类型数据: [...]
加载的紧急规则数据: [...]
渲染规则条件: {...}
```

### 3. 检查数据格式

**问题类型数据应该是:**
```javascript
[
  {
    id: "issue-type-01",
    name: "充值未到账",
    icon: "💰",
    ...
  },
  ...
]
```

**规则数据的 conditions 应该是:**
```javascript
{
  issueTypeIds: ["issue-type-01", "issue-type-02"],
  keywords: [...],
  ...
}
```

### 4. 可能的问题

#### 问题 A: issueTypes 数组为空
- 检查 API 调用是否成功
- 检查 `getIssueTypes()` 返回的数据格式

#### 问题 B: conditions.issueTypeIds 不存在
- 检查规则数据中是否有 `issueTypeIds` 字段
- 可能是旧数据，需要重新创建规则

#### 问题 C: 数据加载时序问题
- issueTypes 可能在规则渲染后才加载完成
- 需要确保数据加载顺序

## 解决方案

### 方案 1: 确保数据加载完成后再渲染

```typescript
const [dataLoaded, setDataLoaded] = useState(false);

useEffect(() => {
  const loadData = async () => {
    await Promise.all([
      loadRules(),
      loadGames(),
      loadIssueTypes(),
    ]);
    setDataLoaded(true);
  };
  loadData();
}, []);

// 在 Table 中添加条件
{dataLoaded && <Table ... />}
```

### 方案 2: 使用 useMemo 缓存问题类型映射

```typescript
const issueTypeMap = useMemo(() => {
  const map = new Map();
  issueTypes.forEach(type => {
    map.set(type.id, type);
  });
  return map;
}, [issueTypes]);

// 在渲染时使用
const issueType = issueTypeMap.get(id);
```

### 方案 3: 添加加载状态检查

```typescript
if (conditions.issueTypeIds?.length) {
  if (issueTypes.length === 0) {
    tags.push(
      <Tag color="magenta" key="issueTypes">
        问题类型: 加载中...
      </Tag>
    );
  } else {
    // 正常渲染
  }
}
```

## 测试命令

### 测试后端 API

```powershell
# 获取问题类型列表
curl http://localhost:3000/api/v1/issue-types | ConvertFrom-Json

# 获取紧急规则列表（需要登录）
$token = "your-admin-token"
curl -Method GET `
  -Uri "http://localhost:3000/api/v1/urgency-rules" `
  -Headers @{"Authorization"="Bearer $token"} | ConvertFrom-Json
```

### 在浏览器控制台测试

```javascript
// 测试 API 调用
fetch('http://localhost:3000/api/v1/issue-types')
  .then(r => r.json())
  .then(d => console.log('问题类型:', d));

// 测试规则 API
fetch('http://localhost:3000/api/v1/urgency-rules', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
  }
})
  .then(r => r.json())
  .then(d => console.log('紧急规则:', d));
```

## 预期结果

触发条件列应该显示：
```
问题类型: 💰 充值未到账, 🎮 游戏BUG
关键词: 充值, 未到账
优先级: HIGH
```

## 实际结果

当前显示：
```
关键词: 充值, 未到账
优先级: HIGH
```

问题类型标签缺失或显示为 ID。

## 下一步

1. 查看浏览器控制台的调试日志
2. 确认数据加载顺序和格式
3. 根据日志信息选择合适的解决方案
