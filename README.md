```
 ███████╗██╗   ██╗███████╗███╗   ██╗████████╗ ██████╗███████╗███╗   ██╗████████╗███████╗██████╗
 ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔══██╗
 █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║   ██║     █████╗  ██╔██╗ ██║   ██║   █████╗  ██████╔╝
 ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║   ██║     ██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗
 ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║   ╚██████╗███████╗██║ ╚████║   ██║   ███████╗██║  ██║
 ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
```

# 🛡️ EventCenter · OpenWrt 路由器事件通知中心

> **「你的路由器不是哑巴。让它开口说话。」**

每一次节点故障转移、每一台设备悄然离线、每一次系统资源告警——
这些发生在你网络深处的 **关键事件**，
不应该只存在于晦涩的日志文件里。

**EventCenter** 是 OpenWrt 路由器的 **中枢神经系统**：
5 大事件源 × 7 大通知渠道 × 卡片式 LuCI 管理界面，
让你的路由器学会 **主动汇报**，而不是等你来翻日志。

---

## ⚡ 核心能力矩阵

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    ⚙️  EVENT PROCESSING ENGINE                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              ║
║   │  EVENT       │    │  DEDUP       │    │  NOTIFY      │              ║
║   │  SOURCES     │───►│  ENGINE      │───►│  DISPATCHER  │───► 📱🔔    ║
║   │              │    │              │    │              │              ║
║   │ • OpenClash  │    │ • MD5 指纹   │    │ • Telegram   │              ║
║   │ • Node Health│    │ • 时间窗口   │    │ • Ntfy       │              ║
║   │ • System     │    │ • 自动去重   │    │ • 企业微信    │              ║
║   │ • Device     │    │              │    │ • Bark       │              ║
║   │ • Subscribe  │    │              │    │ • PushPlus   │              ║
║   └──────────────┘    └──────────────┘    │ • Server酱   │              ║
║                                           │ • Server酱³  │              ║
║                                           └──────────────┘              ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 🔭 事件源 · 五大感知维度

| 事件源 | 脚本 | 检测周期 | 感知能力 |
|:-------|:-----|:--------:|:---------|
| 🌐 **OpenClash** | `openclash.sh` | 5min | 订阅配置变更、节点新增/下线、地区统计 |
| 💓 **节点健康** | `node-health.sh` | 30min | 代理组故障转移、节点恢复、延迟记录 |
| 🖥️ **系统监控** | `system-health.sh` | 5min | CPU/内存/温度/磁盘阈值告警与恢复 |
| 📱 **设备监控** | `device-monitor.sh` | 10min | DHCP/ARP 检测设备上下线状态 |
| 📅 **订阅提醒** | `sub.sh` | 1h | 从 YAML/API 提取到期时间，7 天前提醒 |

---

## 📡 通知渠道 · 七路并行推送

```
                         ┌─────────────┐
                         │   EventC-   │
                         │   enter     │
                         │   Engine    │
                         └──────┬──────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
     ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
     │  Telegram   │    │    Ntfy     │    │  企业微信    │
     │  Bot Token  │    │  WebSocket  │    │  Webhook    │
     └─────────────┘    └─────────────┘    └─────────────┘
            │                   │                   │
     ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
     │    Bark     │    │  PushPlus   │    │  Server酱   │
     │  Device Key │    │    Token    │    │   SendKey   │
     └─────────────┘    └─────────────┘    └─────────────┘
```

| 渠道 | 认证方式 | 特点 |
|:-----|:---------|:-----|
| 📨 **Telegram** | Bot Token + Chat ID | Markdown 格式、国旗 emoji |
| 🔔 **Ntfy** | 用户名密码 / Bearer Token | WebSocket 实时推送、标签分类 |
| 💬 **企业微信** | Webhook URL | 群机器人、Markdown |
| 🍎 **Bark** | Device Key | iOS 原生推送、自定义铃声 |
| ➕ **PushPlus** | Token | 微信公众号推送 |
| 🥢 **Server酱** | SendKey | 微信/钉钉/飞书/邮箱 |
| 🥢 **Server酱³** | SendKey | 新版 API、更稳定 |

---

## 🏗️ 系统架构

```
╔═══════════════════════════════════════════════════════════════════════╗
║                         OpenWrt Router                                ║
║                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │                      LuCI Web Interface                         │  ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │  ║
║  │  │ 概览页   │ │ 设置页   │ │ 通知渠道 │ │ 节点健康 │           │  ║
║  │  │overview  │ │settings  │ │ notify   │ │ health   │           │  ║
║  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │  ║
║  │       │            │            │            │                   │  ║
║  │       └────────────┴────────────┴────────────┘                   │  ║
║  │                          │ ubus RPC                              │  ║
║  └──────────────────────────┼───────────────────────────────────────┘  ║
║                             │                                          ║
║  ┌──────────────────────────┼───────────────────────────────────────┐  ║
║  │                    EVENT ENGINE                                   │  ║
║  │                          │                                        │  ║
║  │  ┌──────────┐    ┌──────┴──────┐    ┌──────────┐                │  ║
║  │  │ Sources  │───►│  engine.sh  │───►│ Notifiers│                │  ║
║  │  │ (cron)   │    │  dedup      │    │ (push)   │                │  ║
║  │  └──────────┘    │  log        │    └──────────┘                │  ║
║  │                  │  format     │                                 │  ║
║  │                  └─────────────┘                                 │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌──────────────────────────────────────────────────────────────────┐  ║
║  │                    STORAGE                                        │  ║
║  │  /etc/config/eventcenter    UCI 配置                              │  ║
║  │  /etc/eventcenter/          运行时数据                            │  ║
║  │  /tmp/eventcenter_*         临时状态                              │  ║
║  └──────────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 📂 目录结构

```
luci-app-eventcenter/
├── Makefile                          # OpenWrt 编译规则
├── root/
│   ├── etc/
│   │   ├── config/eventcenter        # UCI 配置文件
│   │   ├── init.d/eventcenter        # procd 服务脚本
│   │   └── uci-defaults/             # 首次安装初始化
│   └── usr/
│       ├── bin/
│       │   ├── eventcenter           # 🔧 CLI 主入口
│       │   └── notifier_*.sh         # 📡 通知渠道脚本 ×7
│       └── share/eventcenter/
│           ├── engine.sh             # 🧠 事件引擎核心
│           ├── utils.sh              # 🛠️ 工具函数库
│           ├── auth_header.sh        # 🔑 Clash API 认证
│           └── sources/              # 🔭 事件源 ×5
│               ├── openclash.sh
│               ├── node-health.sh
│               ├── system-health.sh
│               ├── device-monitor.sh
│               └── sub.sh
├── htdocs/luci-static/resources/view/eventcenter/
│   ├── overview.js                   # 📊 概览页
│   ├── settings.js                   # ⚙️ 设置页
│   ├── notify.js                     # 📡 通知渠道页
│   ├── health.js                     # 💓 节点健康页
│   └── logs.js                       # 📜 日志页
└── README.md                         # 📖 你在看的这个
```

---

## 🚀 部署指南

### 编译安装

```bash
cp -r luci-app-eventcenter package/
make menuconfig    # LuCI → Applications → luci-app-eventcenter
make package/luci-app-eventcenter/compile V=s
```

### 手动安装

```bash
opkg install luci-app-eventcenter_*.ipk
```

### 源码部署（开发调试）

```bash
cp -r root/* /
cp -r htdocs/* /www/
chmod +x /usr/bin/eventcenter
chmod +x /usr/bin/notifier_*.sh
chmod +x /usr/share/eventcenter/*.sh
chmod +x /usr/share/eventcenter/sources/*.sh
/etc/init.d/rpcd restart
```

---

## 🎮 CLI 命令手册

```bash
# ─── 基础操作 ────────────────────────────────────────────────
eventcenter help                    # 📖 查看帮助
eventcenter status                  # 📊 服务状态
eventcenter sources                 # 🔭 列出可用事件源

# ─── 事件操作 ────────────────────────────────────────────────
eventcenter test                    # 🧪 发送测试通知
eventcenter emit <src> <evt> <lvl> <title> [msg] [tags]  # 📡 发送事件
eventcenter check openclash         # 🔍 触发事件源检查
eventcenter check node-health
eventcenter check system-health
eventcenter check device-monitor
eventcenter check sub

# ─── 日志管理 ────────────────────────────────────────────────
eventcenter list                    # 📜 查看事件日志
eventcenter list --limit 20         # 📜 查看最近 20 条
eventcenter dedup-clear             # 🧹 清除去重缓存

# ─── 服务管理 ────────────────────────────────────────────────
/etc/init.d/eventcenter start       # ▶️ 启动
/etc/init.d/eventcenter stop        # ⏹️ 停止
/etc/init.d/eventcenter restart     # 🔄 重启
```

---

## ⚙️ UCI 配置参考

```bash
# ─── 全局配置 ────────────────────────────────────────────────
uci set eventcenter.global.enable=1
uci set eventcenter.global.dedup_ttl=300      # 去重窗口（秒）
uci set eventcenter.global.log_max_lines=1000  # 日志最大行数

# ─── Ntfy 通知 ──────────────────────────────────────────────
uci set eventcenter.ntfy.enable=1
uci set eventcenter.ntfy.url='https://ntfy.example.com'
uci set eventcenter.ntfy.topic='Openwrt'
uci set eventcenter.ntfy.user='username'
uci set eventcenter.ntfy.pass='password'
uci set eventcenter.ntfy.priority='default'   # min/low/default/high/urgent

# ─── Telegram 通知 ──────────────────────────────────────────
uci set eventcenter.telegram.enable=1
uci set eventcenter.telegram.token='123456:ABC-DEF'
uci set eventcenter.telegram.chatid='123456789'
uci set eventcenter.telegram.parse_mode='Markdown'

# ─── 事件源配置 ─────────────────────────────────────────────
uci set eventcenter.openclash.enable=1
uci set eventcenter.openclash.interval=5
uci set eventcenter.openclash.realtime=1

uci set eventcenter.health.enable=1
uci set eventcenter.health.interval=30
uci set eventcenter.health.delay_threshold=3000

uci set eventcenter.system_health.enable=1
uci set eventcenter.system_health.interval=5

uci set eventcenter.device_monitor.enable=1
uci set eventcenter.device_monitor.interval=10

uci set eventcenter.sub.enable=1
uci set eventcenter.sub.check_interval=24
uci set eventcenter.sub.remind_days=7

uci commit eventcenter
/etc/init.d/eventcenter restart
```

---

## 🔗 事件管线

```
   事件源 (cron 定时触发)
        │
        ▼
   eventcenter emit <source> <event> <level> <title> <message> <tags>
        │
        ▼
   ┌─────────────────────────────────────────┐
   │  engine_emit()                          │
   │  ┌──────────────┐                       │
   │  │  dedup_check │ ← MD5(source:event)   │
   │  │  300s 窗口   │   重复则跳过          │
   │  └──────┬───────┘                       │
   │         ▼                               │
   │  ┌──────────────┐                       │
   │  │  log_write   │ ← 追加日志文件        │
   │  │  自动截断    │   超 max_lines 截断   │
   │  └──────┬───────┘                       │
   │         ▼                               │
   │  ┌──────────────┐                       │
   │  │format_message│ ← 来源名 + 消息体    │
   │  │  Markdown    │                       │
   │  └──────┬───────┘                       │
   │         ▼                               │
   │  ┌──────────────┐                       │
   │  │ notify_send  │ ← 遍历所有通知渠道    │
   │  │  标题透传    │   事件标题 → ntfy Title│
   │  │  标签透传    │   ec:xxx → ntfy Tags  │
   │  └──────────────┘                       │
   └─────────────────────────────────────────┘
        │
        ├──► Telegram   (Bot API)
        ├──► Ntfy       (HTTP POST + Host Header)
        ├──► 企业微信    (Webhook)
        ├──► Bark       (APNs)
        ├──► PushPlus   (WeChat)
        ├──► Server酱   (Multi-channel)
        └──► Server酱³  (Multi-channel)
```

---

## 📦 依赖

| 依赖 | 用途 | 备注 |
|:-----|:-----|:-----|
| `curl` | HTTP API 调用 | OpenWrt 自带 |
| `md5sum` | 去重 key 计算 | busybox 自带 |
| `inotifywait` | 实时文件监听 | `inotify-tools` 包，可选 |
| `awk` | 文本处理 | busybox 自带 |
| `sed` | 文本替换 | busybox 自带 |

---

## 📜 版本编年史

| 版本 | 日期 | 里程碑 |
|:-----|:-----|:-------|
| **v1.4.0** | 2026-06-28 | 🔧 消息推送管道修复：标题透传、tags 参数修复、格式统一 |
| **v1.3.0** | 2026-06-26 | ⚡ 批量修复 + 功能完善：Server酱/订阅/设备/系统监控 |
| **v1.0.3** | 2026-06-22 | 📡 通知修复 + 国旗自动补全 |
| **v1.0.2** | 2026-06-22 | 📋 按订阅名称分组推送 |
| **v1.0.1** | 2026-06-22 | 🏷️ 节点变更分类 + 通知模板优化 |
| **v1.0.0** | 2026-06-21 | 🎉 初始版本 |

---

## 📜 许可

```
MIT License

Copyright (c) 2026 FlyPigs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

<div align="center">

**「在网络的暗流中，做你的守夜人。」**

*Built with ❤️ by FlyPigs*

[⬆ 回到顶部](#️-eventcenter--openwrt-路由器事件通知中心)

</div>
