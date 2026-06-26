'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require view.eventcenter.common as ec';

/* ── 页面特有CSS ── */
var PAGE_CSS = [
	'.cbi-section .cbi-section-table-row { background:var(--background-color-white, #fff);border:1px solid var(--border-color-light, #eee);border-radius:8px;padding:12px;margin-bottom:8px }',
	'.cbi-button-action { background:var(--background-color-secondary, #f0f0f0);color:var(--text-color, #333);border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:600 }',
	'.cbi-button-action:hover { background:var(--background-color-secondary, #e0e0e0) }',
	'.cbi-button-reset { background:var(--background-color-secondary, #f0f0f0);color:var(--text-color-secondary, #666);border:none;border-radius:6px;padding:10px 24px;cursor:pointer }'
].join(' ');

var CARD_COLORS = {
	'global': '#3b82f6',
	'openclash': '#f59e0b',
	'health': '#10b981',
	'device': '#8b5cf6',
	'system': '#ef4444',
	'sub': '#06b6d4',
};

ec.injectCSS(ec.FORM_CSS + ' ' + PAGE_CSS);

function applyCardColors() {
	var sections = document.querySelectorAll('.cbi-section');
	sections.forEach(function(sec) {
		var title = sec.querySelector('h3');
		if (!title) return;
		var text = title.textContent;
		Object.keys(CARD_COLORS).forEach(function(key) {
			if (text.toLowerCase().indexOf(key) !== -1) {
				sec.style.borderTopColor = CARD_COLORS[key];
			}
		});
	});
}

window.addEventListener('load', function() { setTimeout(applyCardColors, 100); });

return view.extend({

	load: function() {
		return Promise.all([
			uci.load('eventcenter')
		]);
	},

	render: function() {
		var m, s, o;

		// --- Main Map ---
		m = new form.Map('eventcenter', '事件中心',
			'配置事件中心监控和通知系统。');

		// --- Global Settings ---
		s = m.section(form.NamedSection, 'global', 'eventcenter', '全局设置');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用或禁用事件中心服务');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'log_path', '日志路径',
			'事件日志文件路径');
		o.default = '/tmp/eventcenter.log';
		o.rmempty = false;

		o = s.option(form.Value, 'log_max_lines', '最大日志行数',
			'超过此行数将自动截断旧日志');
		o.default = '1000';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_ttl', '去重时间窗口(秒)',
			'在此时间窗口内相同事件只通知一次');
		o.default = '300';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_path', '去重缓存路径',
			'去重缓存文件路径');
		o.default = '/tmp/eventcenter_dedup';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_max', '去重最大条目数',
			'去重缓存最大条目数');
		o.default = '500';
		o.datatype = 'uinteger';
		o.rmempty = false;

		// --- OpenClash Monitor ---
		s = m.section(form.NamedSection, 'openclash', 'monitor', 'OpenClash 订阅监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 OpenClash 订阅配置变更监控');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'定期检查订阅变化的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('3', '3 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.value('60', '1 小时');
		o.value('120', '2 小时');
		o.value('360', '6 小时');
		o.value('720', '12 小时');
		o.value('1440', '24 小时');
		o.default = '5';
		o.rmempty = false;

		o = s.option(form.Flag, 'realtime', '实时监听',
			'inotifywait 监听配置目录，变更后立即推送');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'debounce', '防抖延迟',
			'配置变更后等待多久再触发检查');
		o.value('3', '3 秒');
		o.value('5', '5 秒');
		o.value('10', '10 秒');
		o.value('15', '15 秒');
		o.value('30', '30 秒');
		o.value('60', '60 秒');
		o.default = '5';
		o.rmempty = false;
		o.depends('realtime', '1');

		o = s.option(form.Value, 'paths', '配置目录',
			'OpenClash 配置文件路径，逗号分隔');
		o.rmempty = true;
		o.placeholder = '/etc/openclash/config';

		// --- Node Health Monitor ---
		s = m.section(form.NamedSection, 'health', 'health', '节点故障转移通知');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用节点故障转移通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'健康检查的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('3', '3 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.value('60', '1 小时');
		o.default = '3';
		o.rmempty = false;

		o = s.option(form.Value, 'test_url', '测试 URL',
			'用于延迟测试的 URL');
		o.default = 'https://www.google.com/generate_204';
		o.rmempty = false;

		o = s.option(form.Value, 'timeout', '超时(秒)',
			'单次探测超时时间');
		o.default = '5';
		o.datatype = 'uinteger';
		o.rmempty = false;

		// --- Device Monitor ---
		s = m.section(form.NamedSection, 'device_monitor', 'device_monitor', '设备上下线监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用设备上下线监控');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '扫描间隔',
			'设备扫描的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.default = '2';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'mac', '关注的 MAC 地址',
			'只监控这些设备，留空则监控所有');
		o.rmempty = true;

		// --- System Health Monitor ---
		s = m.section(form.NamedSection, 'system_health', 'system_health', '系统健康监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用系统资源监控');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'系统健康检查的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.default = '5';
		o.rmempty = false;

		// --- Subscription Monitor ---
		s = m.section(form.NamedSection, 'sub', 'monitor', '订阅到期监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 Clash 订阅到期提醒');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'check_interval', '检查间隔',
			'多久检查一次订阅状态');
		o.value('1', '每小时');
		o.value('6', '每 6 小时');
		o.value('12', '每 12 小时');
		o.value('24', '每天');
		o.default = '6';
		o.rmempty = false;

		o = s.option(form.ListValue, 'remind_days', '提前提醒天数',
			'到期前几天开始提醒');
		o.value('1', '1 天');
		o.value('3', '3 天');
		o.value('7', '7 天');
		o.value('14', '14 天');
		o.value('30', '30 天');
		o.default = '7';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'sub_names', '关注的订阅',
			'只监控这些订阅，留空则监控所有');

		/* post-render: 追加共享"保存并重启"按钮 */
		return m.render().then(function(node) {
			var restartBtn = ec.createSaveRestartBtn(fs, uci);

			var pageActions = node.parentElement ? node.parentElement.querySelector('.cbi-page-actions') : null;
			if (pageActions) {
				pageActions.appendChild(restartBtn);
			} else {
				setTimeout(function() {
					var pa = document.querySelector('.cbi-page-actions');
					if (pa) pa.appendChild(restartBtn);
				}, 200);
			}
			return node;
		});
	}
});
