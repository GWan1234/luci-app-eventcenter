# P5: 节点健康监测 — 设计方案

## 目标

定时检测 OpenClash 代理节点的连通性，状态变化时通过 Telegram 通知用户。

## 架构

```
┌─────────────────────────────────────────────────┐
│                eventcenter 插件                    │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐               │
│  │ openclash.sh │  │ node-health  │  ← 新增       │
│  │ 文件变更检测  │  │ 节点健康监测  │               │
│  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                        │
│         └────────┬────────┘                        │
│                  ▼                                 │
│           eventcenter emit                         │
│                  ▼                                 │
│           Telegram 通知                            │
└─────────────────────────────────────────────────┘
```

**与现有功能完全独立**：文件变更检测不受影响，健康监测作为第二个事件源。

## 检测机制

利用路由器上 OpenClash 的 Clash API：

```bash
# 测单个节点延迟（返回 ms 或 error）
curl -s -H "Authorization: Bearer $SECRET" \
  "http://127.0.0.1:9090/proxies/节点名/delay?timeout=5000&url=http://www.gstatic.com/generate_204"

# 返回示例（通）: {"delay": 120}
# 返回示例（不通）: {"error": "context deadline exceeded"}
```

**API Secret 来源**：`uci get openclash.config.dashboard_password`

## 检测流程

```
每 N 分钟执行一次：

1. 从 Clash API 获取所有代理节点列表
2. 筛选：只测叶子节点（排除 proxy-groups）
3. 逐个测延迟（并发 5 个，避免串行太慢）
4. 对比上次状态（state 文件）：
   - 上次通 → 这次不通 → 🔴 下线通知
   - 上次不通 → 这次通 → 🟢 恢复通知（附延迟）
   - 状态不变 → 不通知
5. 更新 state 文件
```

## 状态文件

路径：`/tmp/eventcenter_health_state`

格式（每行一个节点）：
```
节点名|状态|最后检测时间|延迟ms
🇭🇰 香港直连1|up|2026-06-22 15:00:00|120
🇺🇸 美国直连1|down|2026-06-22 15:00:00|timeout
```

## 通知格式

**节点下线**：
```
🔴 节点下线 — 红杏云

📅 2026-06-22 15:05:00

📋 下线节点 (3)
  ❌ 🇭🇰 香港直连1 — 超时
  ❌ 🇺🇸 美国直连1 — 连接拒绝
  ❌ 🇯🇵 日本直连1 — 超时

📊 当前状态
  在线: 63 | 离线: 3
```

**节点恢复**：
```
🟢 节点恢复 — 红杏云

📅 2026-06-22 15:10:00

📋 恢复节点 (2)
  ✅ 🇭🇰 香港直连1 — 120ms
  ✅ 🇺🇸 美国直连1 — 230ms

📊 当前状态
  在线: 65 | 离线: 1
```

## LuCI 设置页

在现有 settings.js 中新增一个 Section：

```
┌─ 节点健康监测 ─────────────────────────┐
│  ☐ 启用节点健康监测                      │
│  检测间隔: [5] 分钟                      │
│  超时时间: [5000] 毫秒                   │
│  并发数:   [5]                           │
│  最低延迟阈值: [500] ms（超过则标记慢）    │
│  ☐ 慢节点也通知                          │
│  测试URL: http://www.gstatic.com/generate_204 │
└─────────────────────────────────────────┘
```

UCI 配置：
```
config health 'node_health'
    option enable '0'
    option interval '5'
    option timeout '5000'
    option concurrency '5'
    option slow_threshold '500'
    option notify_slow '0'
    option test_url 'http://www.gstatic.com/generate_204'
```

## 实现文件

| 文件 | 作用 |
|------|------|
| `root/usr/share/eventcenter/sources/node-health.sh` | 新事件源：测延迟 + diff 状态 + 触发通知 |
| `root/etc/init.d/eventcenter` | 增加 health 定时器（cron 或 while 循环） |
| `htdocs/.../eventcenter/settings.js` | 新增健康监测配置 Section |
| `root/etc/config/eventcenter` | 新增 health section |

## 资源控制

| 项目 | 约束 |
|------|------|
| 并发数 | 默认 5，避免同时打开太多连接 |
| 单次超时 | 默认 5 秒，超时立即标记 down |
| 一轮总时长 | 66 节点 / 5 并发 × 5 秒 ≈ 66 秒 |
| 检测间隔 | 默认 5 分钟，最短 1 分钟 |
| State 文件 | /tmp（tmpfs），重启清空（重新建立基线） |

## 边界处理

1. **首次运行**：所有节点记为 unknown，只建立基线不通知
2. **Clash API 不可用**：跳过本轮，日志记录错误，不发通知
3. **节点被删除**：state 文件中存在但 API 中不存在 → 清理记录
4. **新节点出现**：API 中存在但 state 中不存在 → 记为 unknown，下次检测判断
5. **批量下线**（如订阅更新重载）：检测到 >50% 节点同时下线 → 判定为 OpenClash 重载中，跳过通知
6. **与文件变更检测的冲突**：订阅更新会短暂重启 OpenClash，导致大量节点同时 down → health 检测应在文件变更通知后延迟 30 秒再执行

## 待确认

1. 检测间隔默认 5 分钟够不够？还是需要更频繁？
2. "慢节点通知"功能需要吗？还是只关心通/不通？
3. 需要区分不同订阅的节点吗？还是统一监测所有？
