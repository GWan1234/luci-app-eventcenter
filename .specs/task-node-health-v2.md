# P6: 节点故障转移通知 — 详细方案

## 目标

mihomo 原生处理故障转移，eventcenter 监测切换事件并发送 Telegram 通知。

## 架构

```
┌──────────────────────────────────────────────────┐
│                    OpenClash                       │
│  地区组(url-test) → mihomo 自动选最快、自动故障转移  │
│                      ↓                             │
│              Clash API :9090                       │
└──────────────────────┬───────────────────────────┘
                       │ GET /proxies (只读)
                       ▼
┌──────────────────────────────────────────────────┐
│              eventcenter 插件                       │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐               │
│  │ openclash.sh │  │ node-health  │  ← 新增       │
│  │ 文件变更通知  │  │ 切换事件通知  │               │
│  └──────────────┘  └──────────────┘               │
│                       │                            │
│                       ▼                            │
│              eventcenter emit                      │
│                       ▼                            │
│              Telegram 推送                         │
└──────────────────────────────────────────────────┘
```

**mihomo 做所有重活**（健康检测、自动切换），eventcenter **只读 API + 通知**。

## 检测逻辑

```
每 30 秒（可配置）：

  curl -s -H "Authorization: Bearer $SECRET" \
    http://127.0.0.1:9090/proxies

  提取每个 url-test 组的 .now 字段（当前选中节点）

  对比 state 文件中的上次记录：
    相同 → 跳过
    不同 → 记录切换事件，发通知，更新 state
```

**不测延迟，不轮询健康**——mihomo 已经在做这些了。eventcenter 只关心".now 变了没"。

## 状态文件

路径：`/tmp/eventcenter_node_state`

格式：
```
组名|上次选中节点|上次更新时间
🇭🇰 香港节点|🇭🇰 香港直连1|2026-06-22 15:00:00
🇯🇵 日本节点|🇯🇵 日本直连1|2026-06-22 15:00:00
```

## 通知格式

**节点切换**（mihomo 自动故障转移）：
```
🛡️ 节点自动切换

📅 2026-06-22 15:05:00

🇭🇰 香港节点
  ❌ 🇭🇰 香港直连1 (超时)
  → ✅ 🇭🇰 香港直连2 (120ms)
```

**节点恢复**（原节点恢复，mihomo 切回）：
```
🔄 节点已恢复

📅 2026-06-22 15:10:00

🇭🇰 香港节点
  ❌ 🇭🇰 香港直连2 (180ms)
  → ✅ 🇭🇰 香港直连1 (85ms)
```

**多个组同时切换**（合并为一条消息）：
```
🛡️ 节点自动切换

📅 2026-06-22 15:05:00

🇭🇰 香港节点
  ❌ 🇭🇰 香港直连1 → ✅ 🇭🇰 香港直连2 (120ms)

🇯🇵 日本节点
  ❌ 🇯🇵 日本直连1 → ✅ 🇯🇵 日本直连2 (200ms)
```

## 区分用户手动切换 vs 自动故障转移

问题：用户在 LuCI 手动切节点，eventcenter 也会检测到".now 变了"，误报为故障转移。

解决方案：**冷却窗口**。
- 用户通过 Clash API/Put 切换时，mihomo 不区分"手动"还是"自动"
- 但我们可以加逻辑：如果切换后新节点延迟正常（<500ms）且原节点也正常 → 大概率是手动切换 → 不通知
- 如果切换后原节点延迟超时/不可达 → 是故障转移 → 通知

简化版（推荐）：**只在原节点不可达时通知**。
```
检测到 .now 变了
  ↓
测原节点延迟
  ↓
原节点正常 → 可能是手动切换 → 不通知（静默更新 state）
原节点不通 → 确认是故障转移 → 通知
```

## 实现文件

| 文件 | 改动 |
|------|------|
| `root/usr/share/eventcenter/sources/node-health.sh` | **新增**：读 Clash API、对比 state、触发通知 |
| `root/etc/init.d/eventcenter` | **修改**：启动 node-health 定时器 |
| `htdocs/.../eventcenter/settings.js` | **修改**：新增健康监测配置 Section |
| `root/etc/config/eventcenter` | **修改**：新增 health section |

## LuCI 设置页

```
┌─ 节点故障转移通知 ─────────────────────┐
│  ☐ 启用节点切换通知                      │
│  检测间隔: [30] 秒                       │
│  原节点延迟阈值: [3000] ms               │
│  （超过此值判定为故障转移，低于则认为手动切换）│
│  测试URL: http://www.gstatic.com/generate_204 │
└─────────────────────────────────────────┘
```

UCI 配置：
```
config health 'node_health'
    option enable '0'
    option interval '30'
    option delay_threshold '3000'
    option test_url 'http://www.gstatic.com/generate_204'
```

## 前置条件

1. **模板修改**：地区组从 `select` 改 `url-test`（让 mihomo 原生做故障转移）
2. **Clash API Secret**：已有（`uci get openclash.config.dashboard_password`）
3. **eventcenter 插件**：已部署运行

## 实现步骤

1. 修改 `acl4ssr-custom` 模板，地区组改 `url-test`
2. 新增 `sources/node-health.sh` 事件源
3. 修改 `init.d/eventcenter` 添加 node-health 定时器
4. 修改 `settings.js` 添加配置页面
5. 更新 UCI 默认配置
6. 部署测试

## 待确认

1. 检测间隔 30 秒可以吗？还是更长/更短？
2. "只在原节点不可达时通知" 这个策略可以吗？还是所有切换都通知？
3. 哪些组需要监测？只监测地区组，还是所有 url-test 组？
