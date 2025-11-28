# 排队逻辑问题诊断报告

## 🔴 发现的关键问题

### 问题1: `reorderQueue()` 在 `autoAssignSession()` 之前调用
**位置**: `session.service.ts` 第 1067-1074 行

```typescript
// 重新排序队列
await this.reorderQueue();

// 尝试自动分配（如果未手动分配过）
try {
  await this.autoAssignSession(sessionId);
  this.logger.log(`会话 ${sessionId} 已自动分配给客服`);
} catch (error) {
  // ...
}
```

**问题**: 
- `reorderQueue()` 会计算排队位置并发送 WebSocket 通知
- 但紧接着 `autoAssignSession()` 可能会将会话状态改为 `IN_PROGRESS`
- 导致玩家先收到排队通知，然后状态又变了

**影响**: 玩家端可能看到闪烁的排队信息，或者排队页面显示不正确

---

### 问题2: `autoAssignSession()` 成功后没有重新排序队列
**位置**: `session.service.ts` 第 889-895 行

```typescript
const normalizedSession = this.enrichSession(updatedSession);

// 重新排序队列（移除已接入的会话）
await this.reorderQueue();

// 通知 WebSocket 客户端会话状态更新
this.websocketGateway.notifySessionUpdate(sessionId, normalizedSession);
```

**问题**: 
- `autoAssignSession()` 内部已经调用了 `reorderQueue()`
- 但在 `transferToAgent()` 中调用 `autoAssignSession()` 后，没有再次调用 `reorderQueue()`
- 如果自动分配成功，其他排队的会话位置应该更新，但没有触发

---

### 问题3: 排队位置计算时机不对
**位置**: `session.service.ts` 第 1094-1102 行

```typescript
const queuePosition =
  finalSession.status === 'QUEUED'
    ? (finalSession.queuePosition ??
      (await this.getQueuePosition(sessionId)))
    : 0;
```

**问题**:
- 在 `autoAssignSession()` 可能已经将状态改为 `IN_PROGRESS` 后才计算排队位置
- 如果状态已经是 `IN_PROGRESS`，返回的 `queuePosition` 是 0
- 但前端可能还在排队页面，收到的数据不一致

---

### 问题4: `reorderQueue()` 中的 WebSocket 通知可能发送到错误的房间
**位置**: `session.service.ts` 第 1253-1257 行

```typescript
// 发送 WebSocket 通知
this.websocketGateway.notifyQueueUpdate(
  sessions[i].id,
  queuePosition,
  estimatedWaitTime,
);
```

**问题**:
- `notifyQueueUpdate()` 发送到 `session:${sessionId}` 房间
- 但玩家可能还没有加入这个房间（在转人工的瞬间）
- 或者玩家已经离开了排队页面

---

### 问题5: 直接转人工时的排队信息缺失
**位置**: `ticket.service.ts` 第 1196-1210 行

```typescript
// 重新排序队列（计算排队位置和预计等待时间）
try {
  await this.sessionService.reorderQueue();
} catch (error) {
  console.warn(`重新排序队列失败: ${error.message}`);
}

// 通知管理端有新会话（让客服能看到待接入队列）
try {
  // 重新排序队列后，获取完整的会话信息（包含排队位置和预计等待时间）
  const enrichedSession = await this.sessionService.findOne(session.id);
  // 通知新会话创建
  this.websocketGateway.notifyNewSession(enrichedSession);
  // 通知会话更新（确保客服端能刷新待接入队列，包含排队信息）
  this.websocketGateway.notifySessionUpdate(session.id, enrichedSession);
```

**问题**:
- 创建会话后立即调用 `reorderQueue()`
- 但玩家端可能还没有连接 WebSocket 或加入房间
- 导致玩家端收不到排队更新

---

## 🔧 建议的修复方案

### 修复1: 调整 `transferToAgent()` 中的执行顺序

```typescript
// 确认有在线客服：正常进入排队流程
// 更新会话状态为排队
const updatedSession = await this.prisma.session.update({
  where: { id: sessionId },
  data: {
    status: 'QUEUED',
    playerUrgency: transferDto.urgency,
    priorityScore,
    queuedAt: new Date(),
    allowManualTransfer: false,
    transferReason: transferDto.reason,
    transferIssueTypeId: transferDto.issueTypeId,
    transferAt: new Date(),
    manuallyAssigned: false,
  },
});

// 尝试自动分配（如果未手动分配过）
let autoAssigned = false;
try {
  await this.autoAssignSession(sessionId);
  autoAssigned = true;
  this.logger.log(`会话 ${sessionId} 已自动分配给客服`);
} catch (error) {
  // 自动分配失败，保持排队状态
  this.logger.warn(`自动分配失败，会话 ${sessionId} 保持在排队状态: ${error.message}`);
  // 只有在自动分配失败时才重新排序队列
  await this.reorderQueue();
}

// 获取最新的会话信息
const finalSession = await this.findOne(sessionId);

// 通知会话更新
this.websocketGateway.notifySessionUpdate(sessionId, finalSession);

// 返回结果
return {
  queued: finalSession.status === 'QUEUED',
  queuePosition: finalSession.queuePosition || null,
  estimatedWaitTime: finalSession.estimatedWaitTime || null, // 需要添加这个字段
  onlineAgents: currentOnlineAgents,
  autoAssigned: finalSession.status === 'IN_PROGRESS',
  message: undefined,
  convertedToTicket: false,
};
```

### 修复2: 在 `reorderQueue()` 后添加延迟通知

```typescript
async reorderQueue() {
  // ... 现有的排序逻辑 ...
  
  // 批量收集需要通知的会话
  const notifications: Array<{sessionId: string, position: number, waitTime: number | null}> = [];
  
  // 3. 更新已分配会话的排队位置（按客服分组计算）
  for (const [agentId, sessions] of sessionsByAgent.entries()) {
    for (let i = 0; i < sessions.length; i++) {
      const queuePosition = i + 1;
      await this.prisma.session.update({
        where: { id: sessions[i].id },
        data: { queuePosition },
      });

      const estimatedWaitTime = Math.ceil(queuePosition * averageProcessingTime);
      notifications.push({
        sessionId: sessions[i].id,
        position: queuePosition,
        waitTime: estimatedWaitTime,
      });
    }
  }
  
  // 4. 更新未分配会话的排队位置
  for (let i = 0; i < unassignedSessions.length; i++) {
    const queuePosition = i + 1;
    await this.prisma.session.update({
      where: { id: unassignedSessions[i].id },
      data: { queuePosition },
    });

    const estimatedWaitTime = onlineAgentsCount > 0
      ? Math.ceil((queuePosition / onlineAgentsCount) * averageProcessingTime)
      : null;
      
    notifications.push({
      sessionId: unassignedSessions[i].id,
      position: queuePosition,
      waitTime: estimatedWaitTime,
    });
  }
  
  // 延迟发送通知，确保客户端已经准备好
  setTimeout(() => {
    for (const notif of notifications) {
      this.websocketGateway.notifyQueueUpdate(
        notif.sessionId,
        notif.position,
        notif.waitTime,
      );
    }
  }, 500); // 延迟500ms
}
```

### 修复3: 在会话模型中添加 `estimatedWaitTime` 字段

这样可以直接从数据库读取，而不是每次计算。

### 修复4: 前端添加重连和重新加入房间的逻辑

确保在转人工后，前端能正确加入 WebSocket 房间并接收更新。

---

## 📊 测试场景

1. **场景1**: 有在线客服，转人工后立即被分配
   - 预期: 玩家直接跳转到聊天页面，不显示排队
   - 实际: 可能先显示排队，然后跳转

2. **场景2**: 有在线客服，但都在忙，需要排队
   - 预期: 显示排队位置和预计等待时间
   - 实际: 排队位置可能不准确或不更新

3. **场景3**: 没有在线客服
   - 预期: 转为加急工单
   - 实际: 应该正常

4. **场景4**: 排队中，客服接入
   - 预期: 立即跳转到聊天页面
   - 实际: 可能有延迟或不跳转

5. **场景5**: 多个玩家同时排队
   - 预期: 排队位置实时更新
   - 实际: 可能不同步
