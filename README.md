# luci-app-eventcenter

路由器通用事件通知中心 — 实时监控 OpenClash 订阅配置变更，按订阅名称分组推送 Telegram 通知，包含节点变更分类和地区统计。

## 功能特性

- **实时文件监听**: inotifywait 内核级事件驱动，文件变更秒级感知
- **按订阅分组**: 每个配置文件 = 一个独立订阅，变更时按订阅名称分别推送
- **节点变更分类**: ➕新增线路 / ➖下线线路 / 🔄参数更新
- **地区变化检测**: 🚀新地区上线 / ⚠️地区缩减 / 各地区节点增减统计
- **Telegram 通知**: 精美 Markdown 格式，包含变更摘要、地区统计、主要变化列表
- **事件引擎**: 标准化流水线（去重 → 记录 → 格式化 → 推送）
- **LuCI 管理界面**: 概览、设置、日志三个页面
- **busybox 兼容**: 无 comm/paste/yq 依赖，纯 shell 实现

## 目录结构

```
luci-app-eventcenter/
├── Makefile                          # OpenWrt 编译脚本
├── root/
│   ├── etc/
│   │   ├── config/eventcenter        # UCI 配置
│   │   └── init.d/eventcenter        # procd 服务脚本
│   ├── usr/
│   │   ├── bin/
│   │   │   ├── eventcenter           # CLI 主入口
│   │   │   └── notifier_telegram.sh  # Telegram 通知器
│   │   ├── share/
│   │   │   ├── eventcenter/
│   │   │   │   ├── engine.sh         # 事件引擎
│   │   │   │   ├── utils.sh          # 工具函数库
│   │   │   │   ├── watcher.sh        # inotifywait 实时监听
│   │   │   │   └── sources/
│   │   │   │       └── openclash.sh  # OpenClash 事件源
│   │   │   ├── rpcd/acl.d/eventcenter.json   # RPC 权限
│   │   │   └── luci/menu.d/luci-app-eventcenter.json  # 菜单
│   │   └── lib/upgrade/keep.d/luci-app-eventcenter    # 升级保留配置
├── htdocs/
│   └── luci-static/resources/view/eventcenter/
│       ├── overview.js               # 概览页
│       ├── settings.js               # 设置页
│       └── logs.js                   # 日志页
└── README.md
```

## 安装方法

### 方式一：OpenWrt 编译系统

将 `luci-app-eventcenter` 目录放入 `package/` 或 `feeds/luci/applications/`，然后：

```bash
make menuconfig  # 选中 LuCI -> Applications -> luci-app-eventcenter
make package/luci-app-eventcenter/compile V=s
```

生成的 `.ipk` 文件在 `bin/packages/` 目录下。

### 方式二：手动安装 ipk

```bash
opkg install luci-app-eventcenter_1.0.3-1_all.ipk
```

### 方式三：源码直接部署（开发调试）

```bash
# 复制 root/ 下的文件到对应系统目录
cp -r root/* /
cp -r htdocs/* /www/

# 设置执行权限
chmod +x /usr/bin/eventcenter
chmod +x /usr/bin/notifier_telegram.sh
chmod +x /etc/init.d/eventcenter
chmod +x /usr/share/eventcenter/engine.sh
chmod +x /usr/share/eventcenter/utils.sh
chmod +x /usr/share/eventcenter/watcher.sh
chmod +x /usr/share/eventcenter/sources/openclash.sh

# 重启 rpcd 和 uhttpd
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

## 使用方法

### CLI 命令

```bash
# 查看帮助
eventcenter help

# 查看服务状态
eventcenter status

# 发送测试通知
eventcenter test

# 手动触发 OpenClash 检查
eventcenter check openclash

# 查看事件日志
eventcenter list
eventcenter list --limit 20

# 手动发送事件
eventcenter emit <source> <event> <level> <title> [message]

# 清除去重缓存
eventcenter dedup-clear

# 列出可用事件源
eventcenter sources
```

### 服务管理

```bash
# 启动服务（添加 cron 任务 + inotifywait 监听）
/etc/init.d/eventcenter start

# 停止服务（移除 cron 任务 + 停止监听）
/etc/init.d/eventcenter stop

# 重启服务
/etc/init.d/eventcenter restart

# 查看服务日志
logread | grep eventcenter
```

### LuCI Web 界面

访问 **服务 → Event Center**，包含：

- **概览页**: 服务状态、快速操作按钮、最近 10 条事件
- **设置页**: 全局开关、Telegram 配置、OpenClash 监控配置
- **日志页**: 完整事件日志、分页浏览、自动刷新

## 通知示例

按订阅名称分组推送的 Telegram 通知格式：

```
📡 OpenClash 订阅更新 — 我的机场

⏰ 时间: 2026-06-22 15:30:45

📊 变更摘要
├── ➕ 新增线路: 8 条
├── ➖ 下线线路: 2 条
└── 🔄 参数更新: 3 条

🌍 地区统计
├── 🇭🇰 香港: +5 -1 (共 42 条)
├── 🇯🇵 日本: +3 +1 (共 28 条)
├── 🇸🇬 新加坡: +0 -2 (共 15 条)
└── 🇺🇸 美国: +0 +0 (共 12 条)

📋 主要变化
➕ 新增: 香港 IPLC 05 · 香港 IPLC 06 · 东京 IIJ 03 ...
➖ 下线: 新加坡 02 · 新加坡 03
```

## UCI 配置说明

```
config eventcenter 'global'
    option enable '1'              # 总开关
    option log_path '/tmp/eventcenter.log'   # 日志路径
    option log_max_lines '1000'    # 日志最大行数
    option dedup_ttl '300'         # 去重 TTL（秒）
    option dedup_path '/tmp/eventcenter_dedup'
    option dedup_max '500'         # 去重缓存最大条目

config notifier 'telegram'
    option enable '0'              # Telegram 开关
    option token ''                # Bot Token
    option chatid ''               # Chat ID
    option parse_mode 'Markdown'   # Markdown 或 HTML

config monitor 'openclash'
    option enable '1'              # OpenClash 监控开关
    option paths ''                # 自定义配置路径（逗号分隔，空则自动发现）
    option realtime '1'            # inotifywait 实时监听开关
    option debounce '5'            # 防抖延迟（秒）
```

## 扩展事件源

在 `/usr/share/eventcenter/sources/` 下创建 `<name>.sh`，实现 `check()` 函数：

```sh
#!/bin/sh
# /usr/share/eventcenter/sources/my_monitor.sh

check() {
    # 检测逻辑
    if [ 某个条件 ]; then
        eventcenter emit my_monitor some_event info \
            "事件标题" "事件详细描述"
    fi
}
```

然后添加对应的 cron 任务或在现有任务中增加 `check my_monitor`。

## 依赖

- `curl` — Telegram API 调用
- `md5sum` — 去重 key 计算（busybox 自带）
- `inotifywait` — 实时文件监听（inotify-tools 包）

## 版本历史

- **v1.0.3** (2026-06-22) — 通知修复 + 国旗自动补全
  - 修复 awk 写入 state 文件时未指定 `-F'\t'` 分隔符，导致含空格的 emoji 节点名被劈断
  - 修复 server:port 提取逻辑，改用逗号分割字段精确匹配，避免 `skip-cert-verify` 等字段干扰
  - 新增 `prepend_flag()` 函数，自动为纯中文节点名补上对应国家/地区国旗 emoji
  - 优化变更列表格式，所有节点名统一带国旗前缀

- **v1.0.2** (2026-06-22) — 按订阅名称分组推送
  - 每个配置文件视为独立订阅，变更时按订阅名称分别推送通知
  - 通知标题显示订阅名称，便于区分不同来源的变更
  - 优化 inotifywait 监听逻辑，支持多文件并行监听

- **v1.0.1** (2026-06-22) — 节点变更分类 + 通知模板优化
  - 节点变更智能分类：新增线路 / 下线线路 / 参数更新
  - 地区变化检测：新地区上线 / 地区缩减 / 各地区节点增减统计
  - Telegram 通知模板重构，包含变更摘要、地区统计、主要变化列表
  - 新增 inotifywait 实时文件监听，替代轮询模式
  - 新增 watcher.sh 实时监听模块
  - 移除 geo_files 和 interval 配置项，改用 realtime + debounce

- **v1.0.0** (2026-06-21) — 初始版本
  - 事件引擎 + CLI
  - Telegram 通知器
  - OpenClash 事件源
  - LuCI Web 管理界面
  - Makefile + init.d + 打包
