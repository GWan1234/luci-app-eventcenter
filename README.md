# luci-app-eventcenter

OpenWrt 路由器事件通知中心 — 多事件源监控 + 多通知渠道推送，卡片式 LuCI 管理界面。

## 功能特性

- **多事件源**: OpenClash 配置变更、节点故障切换、系统资源告警、设备上下线、订阅到期提醒
- **多通知渠道**: Telegram、Ntfy、企业微信、Bark、PushPlus、Server酱、Server酱³
- **告警聚合防轰炸**: 相同事件自动聚合，避免通知洪水
- **事件去重**: 时间窗口内相同事件只通知一次
- **卡片式 LuCI 界面**: 5 个页面，暗夜模式自适应，标准 `form.Map` 保存按钮
- **CLI 命令行**: `eventcenter` 命令，支持 emit/test/status/check 等操作
- **procd 服务管理**: 标准 OpenWrt 服务框架，支持 config trigger 自动重启
- **busybox 兼容**: 纯 shell 实现，无 bash/yq 依赖

## 事件源

| 事件源 | 说明 | 检测内容 |
|--------|------|----------|
| `openclash` | 订阅配置监控 | 节点新增/下线/参数变更、地区统计 |
| `node-health` | 节点健康监控 | 代理组故障切换、节点恢复、延迟记录 |
| `system-health` | 系统资源监控 | CPU/内存/温度/磁盘阈值告警 |
| `device-monitor` | 设备上下线 | DHCP/ARP 检测设备在线状态变化 |
| `sub` | 订阅到期提醒 | 从 YAML/API 提取到期时间，提前提醒 |

## 通知渠道

| 渠道 | 脚本 | 认证方式 |
|------|------|----------|
| Telegram | `notifier_telegram.sh` | Bot Token + Chat ID |
| Ntfy | `notifier_ntfy.sh` | 用户名密码 / Bearer Token |
| 企业微信 | `notifier_wechat.sh` | Webhook URL |
| Bark | `notifier_bark.sh` | Device Key |
| PushPlus | `notifier_pushplus.sh` | Token |
| Server酱 | `notifier_serverchan.sh` | SendKey |
| Server酱³ | `notifier_serverchan3.sh` | SendKey |

## 目录结构

```
luci-app-eventcenter/
├── Makefile
├── root/
│   ├── etc/
│   │   ├── config/eventcenter                    # UCI 配置
│   │   ├── init.d/eventcenter                    # procd 服务脚本
│   │   └── uci-defaults/luci-app-eventcenter     # 首次安装初始化
│   └── usr/
│       ├── bin/
│       │   ├── eventcenter                       # CLI 主入口
│       │   ├── notifier_telegram.sh              # 通知器脚本
│       │   ├── notifier_ntfy.sh
│       │   ├── notifier_wechat.sh
│       │   ├── notifier_bark.sh
│       │   ├── notifier_pushplus.sh
│       │   ├── notifier_serverchan.sh
│       │   └── notifier_serverchan3.sh
│       └── share/
│           ├── eventcenter/
│           │   ├── engine.sh                     # 事件引擎
│           │   ├── utils.sh                      # 工具函数库
│           │   ├── auth_header.sh                # Clash API 认证
│           │   ├── watcher.sh                    # inotifywait 监听
│           │   └── sources/
│           │       ├── openclash.sh              # OpenClash 事件源
│           │       ├── node-health.sh            # 节点健康监控
│           │       ├── system-health.sh          # 系统资源监控
│           │       ├── device-monitor.sh         # 设备上下线监控
│           │       └── sub.sh                    # 订阅到期监控
│           ├── luci/menu.d/luci-app-eventcenter.json
│           └── rpcd/acl.d/eventcenter.json
├── htdocs/luci-static/resources/view/eventcenter/
│   ├── overview.js                               # 概览页
│   ├── settings.js                               # 设置页
│   ├── notify.js                                 # 通知渠道页
│   ├── health.js                                 # 节点健康页
│   └── logs.js                                   # 日志页
└── README.md
```

## 安装

### 编译

```bash
# 放入 OpenWrt SDK
cp -r luci-app-eventcenter package/
make menuconfig   # LuCI -> Applications -> luci-app-eventcenter
make package/luci-app-eventcenter/compile V=s
```

### 手动安装 ipk

```bash
opkg install luci-app-eventcenter_*.ipk
```

### 源码部署（开发调试）

```bash
cp -r root/* /
cp -r htdocs/* /www/
chmod +x /usr/bin/eventcenter
chmod +x /usr/bin/notifier_*.sh
chmod +x /etc/init.d/eventcenter
chmod +x /usr/share/eventcenter/*.sh
chmod +x /usr/share/eventcenter/sources/*.sh
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

## 使用

### CLI 命令

```bash
eventcenter help                    # 查看帮助
eventcenter status                  # 服务状态
eventcenter test                    # 发送测试通知
eventcenter check openclash         # 触发事件源检查
eventcenter check node-health
eventcenter check system-health
eventcenter check device-monitor
eventcenter check sub
eventcenter list                    # 查看事件日志
eventcenter list --limit 20
eventcenter emit <source> <event> <level> <title> [message]
eventcenter dedup-clear             # 清除去重缓存
eventcenter sources                 # 列出可用事件源
```

### 服务管理

```bash
/etc/init.d/eventcenter start       # 启动（cron + watcher）
/etc/init.d/eventcenter stop        # 停止
/etc/init.d/eventcenter restart     # 重启
```

### LuCI 界面

访问 **服务 → Event Center**：

- **概览**: 系统状态、在线设备、服务运行状态
- **设置**: 全局配置、各事件源开关和参数
- **通知渠道**: 各推送渠道配置、发送测试按钮
- **节点健康**: 当前节点选择、延迟记录、故障切换事件
- **日志**: 运行日志查看和清除

## UCI 配置

```bash
# 全局
uci set eventcenter.global.enable=1
uci set eventcenter.global.dedup_ttl=300

# 通知渠道
uci set eventcenter.ntfy.enable=1
uci set eventcenter.ntfy.url='https://ntfy.example.com'
uci set eventcenter.ntfy.topic='Openwrt'
uci set eventcenter.ntfy.user='username'
uci set eventcenter.ntfy.pass='password'

uci set eventcenter.telegram.enable=1
uci set eventcenter.telegram.token='123456:ABC-DEF'
uci set eventcenter.telegram.chatid='123456789'

# 事件源
uci set eventcenter.openclash.enable=1
uci set eventcenter.openclash.interval=5
uci set eventcenter.openclash.realtime=1

uci set eventcenter.health.enable=1
uci set eventcenter.health.interval=30
uci set eventcenter.health.delay_threshold=3000

uci set eventcenter.system_health.enable=1
uci set eventcenter.system_health.interval=5

uci set eventcenter.device_monitor.enable=1
uci set eventcenter.device_monitor.interval=2

uci commit eventcenter
/etc/init.d/eventcenter restart
```

## 事件管线

```
事件源 check() → eventcenter emit
  ↓
去重检查 (dedup_ttl 窗口内相同事件跳过)
  ↓
写入日志 (log_path, log_max_lines 自动截断)
  ↓
格式化消息 → 分发到所有启用的通知渠道
```

## 依赖

- `curl` — HTTP API 调用
- `md5sum` — 去重 key 计算（busybox 自带）
- `inotifywait` — 实时文件监听（inotify-tools 包，可选）

## 版本历史

- **v1.3.0** (2026-06-26) — 批量修复 + 功能完善
  - 新增：Server酱/Server酱³ 通知渠道
  - 新增：订阅到期监控 (`sub.sh`)
  - 新增：设备上下线监控 (`device-monitor.sh`)
  - 新增：系统健康监控 (`system-health.sh`)
  - 修复：聚合逻辑顺序、status 显示、日志解析格式
  - 修复：所有 LuCI 页面 `E()` click 事件绑定
  - 改进：init.d 全面重写为 procd 框架
  - 改进：共享函数提取到 `utils.sh`，消除重复代码

- **v1.0.3** (2026-06-22) — 通知修复 + 国旗自动补全
- **v1.0.2** (2026-06-22) — 按订阅名称分组推送
- **v1.0.1** (2026-06-22) — 节点变更分类 + 通知模板优化
- **v1.0.0** (2026-06-21) — 初始版本

## 许可

MIT License
