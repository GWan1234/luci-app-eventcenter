'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require dom';
'require uci';

var cardBase = 'background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px';
var tableStyle = 'width:100%;border-collapse:collapse';

function statusDot(color) {
	return E('span', { 'style': 'display:inline-block;width:10px;height:10px;border-radius:50%;background:' + color });
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('eventcenter'),
			L.resolveDefault(fs.exec('eventcenter', ['status']), { stdout: '' }),
			L.resolveDefault(fs.exec('cat', ['/tmp/eventcenter.log']), { stdout: '' }),
			L.resolveDefault(fs.exec('cat', ['/tmp/eventcenter_node_state']), { stdout: '' }),
			L.resolveDefault(fs.exec('ls', ['-1', '/tmp/eventcenter_openclash/']), { stdout: '' })
		]);
	},

	render: function(data) {
		var globalEnabled = uci.get('eventcenter', 'global', 'enable') === '1';
		var statusOutput = (data[1] && data[1].stdout) ? data[1].stdout : '';
		var logOutput = (data[2] && data[2].stdout) ? data[2].stdout : '';
		var stateOutput = (data[3] && data[3].stdout) ? data[3].stdout : '';
		var subsOutput = (data[4] && data[4].stdout) ? data[4].stdout : '';

		/* Parse status */
		var statusLines = statusOutput.split('\n').filter(function(l) { return l.trim().length > 0; });
		var lastEvent = '', logCount = 0, dedupCount = 0;
		statusLines.forEach(function(line) {
			if (line.indexOf('Last event:') > -1) lastEvent = line.split(':').slice(1).join(':').trim();
			var m;
			if (line.indexOf('Log:') > -1) { m = line.match(/\((\d+) entries\)/); if (m) logCount = parseInt(m[1], 10); }
			if (line.indexOf('Dedup cache:') > -1) { m = line.match(/\((\d+) entries/); if (m) dedupCount = parseInt(m[1], 10); }
		});

		/* Parse notifiers */
		var notifiers = [
			{ name: 'Telegram', key: 'telegram', icon: '✈️', checkField: 'token', color: '#0088cc' },
			{ name: 'ntfy', key: 'ntfy', icon: '📢', checkField: 'topic', color: '#2563eb' },
			{ name: '企业微信', key: 'wechat', icon: '💬', checkField: 'webhook', color: '#07c160' },
			{ name: 'Bark', key: 'bark', icon: '🔔', checkField: 'device_key', color: '#f59e0b' },
			{ name: 'Server酱', key: 'serverchan', icon: '📨', checkField: 'sendkey', color: '#ef4444' },
			{ name: 'Server酱³', key: 'serverchan3', icon: '📱', checkField: 'sendkey', color: '#8b5cf6' },
			{ name: 'PushPlus', key: 'pushplus', icon: '📣', checkField: 'token', color: '#06b6d4' }
		];

		var enabledNotifiers = 0;
		var notifierCards = notifiers.map(function(n) {
			var enabled = false, configured = false;
			try {
				enabled = uci.get('eventcenter', n.key, 'enable') === '1';
				configured = !!uci.get('eventcenter', n.key, n.checkField);
			} catch(e) {}
			if (enabled && configured) enabledNotifiers++;

			var statusText, dotColor;
			if (enabled && configured) { statusText = '运行中'; dotColor = '#22c55e'; }
			else if (configured) { statusText = '已配置'; dotColor = '#f59e0b'; }
			else { statusText = '未配置'; dotColor = '#d1d5db'; }

			return E('div', { 'style': cardBase + ';padding:14px 18px;border-left:4px solid ' + n.color + ';display:flex;align-items:center;gap:12px;min-width:200px;flex:1 1 200px' }, [
				E('span', { 'style': 'font-size:1.3em' }, n.icon),
				E('div', { 'style': 'flex:1' }, [
					E('div', { 'style': 'font-weight:700;font-size:0.95em' }, n.name),
					E('div', { 'style': 'font-size:0.75em;color:#888' }, configured ? '已配置' : '未配置')
				]),
				E('div', { 'style': 'display:flex;align-items:center;gap:6px' }, [
					statusDot(dotColor),
					E('span', { 'style': 'font-size:0.8em;color:' + dotColor + ';font-weight:600' }, statusText)
				])
			]);
		});

		/* Parse subscriptions */
		var subsFiles = subsOutput.trim().split('\n').filter(function(f) { return f.length > 0; });
		var nodeLines = stateOutput.trim().split('\n').filter(function(l) { return l.length > 0; });

		var subCards = subsFiles.map(function(f) {
			return E('div', { 'style': cardBase + ';padding:12px 18px;display:flex;align-items:center;gap:12px' }, [
				E('span', { 'style': 'font-size:1.1em' }, '📦'),
				E('div', { 'style': 'flex:1;font-weight:600' }, f.replace('.state', '')),
				E('div', { 'style': 'display:flex;align-items:center;gap:6px' }, [
					statusDot('#22c55e'),
					E('span', { 'style': 'font-size:0.8em;color:#22c55e;font-weight:600' }, '已建立基线')
				])
			]);
		});
		if (subCards.length === 0) {
			subCards.push(E('div', { 'style': 'text-align:center;padding:20px;color:#888;font-size:0.9em' }, '暂无订阅数据（等待首次同步）'));
		}

		/* Parse events */
		var logLines = logOutput.split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
		var recentEntries = [];
		for (var i = logLines.length - 1; i >= 0 && recentEntries.length < 10; i--) {
			var parts = logLines[i].split('|');
			if (parts.length >= 5) recentEntries.push({ time: parts[0], source: parts[1], event: parts[2], level: parts[3], title: parts[4] });
		}

		var eventRows = [];
		if (recentEntries.length === 0) {
			eventRows.push(E('tr', {}, E('td', { 'colspan': '4', 'style': 'text-align:center;padding:20px;color:#888' }, '暂无事件记录')));
		} else {
			var levelColor = { info: '#17a2b8', warn: '#ffc107', error: '#dc3545', critical: '#6f1207' };
			recentEntries.forEach(function(entry) {
				eventRows.push(E('tr', { 'style': 'border-bottom:1px solid #f3f4f6' }, [
					E('td', { 'style': 'white-space:nowrap;font-size:0.85em;padding:10px 12px' }, entry.time),
					E('td', { 'style': 'padding:10px 12px' }, E('span', { 'style': 'padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:bold;background:' + (levelColor[entry.level] || '#333') + '18;color:' + (levelColor[entry.level] || '#333') }, entry.level)),
					E('td', { 'style': 'padding:10px 12px' }, entry.title),
					E('td', { 'style': 'font-size:0.85em;color:#666;padding:10px 12px' }, entry.source)
				]));
			});
		}

		/* ── 布局 ── */
		var content = E('div', { 'style': 'padding:0' }, [
			E('h2', { 'style': 'margin-bottom:4px' }, '事件中心'),
			E('div', { 'style': 'color:#666;font-size:0.9em;margin-bottom:20px' }, '系统状态总览'),

			/* 统计卡 */
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px' }, [
				statCard(globalEnabled ? '运行中' : '已停止', '服务状态', globalEnabled ? '#d4edda' : '#f8d7da', globalEnabled ? '#155724' : '#721c24'),
				statCard('' + enabledNotifiers, '活跃渠道', '#e7f3ff', '#004085'),
				statCard('' + logCount, '总事件数', '#fff3cd', '#856404'),
				statCard('' + subsFiles.length, '监控订阅', '#e8f5e9', '#2e7d32')
			]),

			/* 最近事件 */
			E('div', { 'style': cardBase }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
					E('h3', { 'style': 'margin:0;font-size:1em' }, '📋 最近事件'),
					lastEvent ? E('span', { 'style': 'font-size:0.8em;color:#888' }, lastEvent) : ''
				]),
				E('table', { 'style': tableStyle }, [
					E('thead', {}, E('tr', { 'style': 'border-bottom:2px solid #eee' }, [
						E('th', { 'style': 'text-align:left;padding:8px 12px;font-size:0.8em;color:#666;width:160px' }, '时间'),
						E('th', { 'style': 'text-align:left;padding:8px 12px;font-size:0.8em;color:#666;width:70px' }, '级别'),
						E('th', { 'style': 'text-align:left;padding:8px 12px;font-size:0.8em;color:#666' }, '标题'),
						E('th', { 'style': 'text-align:left;padding:8px 12px;font-size:0.8em;color:#666' }, '来源')
					])),
					E('tbody', {}, eventRows)
				])
			]),

			/* 通知渠道 */
			E('div', { 'style': cardBase }, [
				E('h3', { 'style': 'margin:0 0 14px;font-size:1em' }, '📡 通知渠道'),
				E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:12px' }, notifierCards)
			]),

			/* 订阅监控 */
			E('div', { 'style': cardBase }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px' }, [
					E('h3', { 'style': 'margin:0;font-size:1em' }, '📦 订阅监控'),
					E('span', { 'style': 'font-size:0.8em;color:#888' }, nodeLines.length > 0 ? nodeLines.length + ' 个代理组' : '未启用')
				]),
				E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:12px' }, subCards)
			])
		]);

		/* 底部按钮栏 */
		var pageActions = E('div', { 'class': 'cbi-page-actions', 'style': 'display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:20px;border-top:1px solid #eee' }, [
			E('button', {
				'class': 'cbi-button cbi-button-apply',
				'style': 'background:#f59e0b;border-color:#f59e0b;color:#fff',
				'click': function() {
					var btn = this;
					btn.textContent = '重启中...';
					btn.disabled = true;
					fs.exec('/etc/init.d/eventcenter', ['restart']).then(function(res) {
						btn.textContent = (res && res.code === 0) ? '✓ 已重启' : '✗ 重启失败';
						btn.style.background = (res && res.code === 0) ? '#22c55e' : '#dc2626';
						btn.style.borderColor = btn.style.background;
						setTimeout(function() { btn.textContent = '重启服务'; btn.style.background = '#f59e0b'; btn.style.borderColor = '#f59e0b'; btn.disabled = false; }, 3000);
					}).catch(function() {
						btn.textContent = '✗ 重启失败';
						btn.style.background = '#dc2626';
						btn.style.borderColor = '#dc2626';
						setTimeout(function() { btn.textContent = '重启服务'; btn.style.background = '#f59e0b'; btn.style.borderColor = '#f59e0b'; btn.disabled = false; }, 3000);
					});
				}
			}, '重启服务')
		]);

		return E('div', {}, [content, pageActions]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

function statCard(value, label, bg, color) {
	return E('div', { 'style': 'flex:1;min-width:120px;text-align:center;padding:16px;background:' + bg + ';border-radius:10px' }, [
		E('div', { 'style': 'font-size:1.8em;font-weight:bold;color:' + color }, value),
		E('div', { 'style': 'font-size:0.8em;color:#666;margin-top:4px' }, label)
	]);
}
