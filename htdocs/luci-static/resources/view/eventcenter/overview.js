'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require dom';
'require uci';

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

		// Parse status output
		var statusLines = statusOutput.split('\n').filter(function(l) { return l.trim().length > 0; });
		var lastEvent = '';
		var logCount = 0;
		var dedupCount = 0;
		statusLines.forEach(function(line) {
			if (line.indexOf('Last event:') > -1) lastEvent = line.split(':')[1] ? line.split(':').slice(1).join(':').trim() : '';
			if (line.indexOf('Log:') > -1) {
				var m = line.match(/\((\d+) entries\)/);
				if (m) logCount = parseInt(m[1], 10);
			}
			if (line.indexOf('Dedup cache:') > -1) {
				var m2 = line.match(/\((\d+) entries/);
				if (m2) dedupCount = parseInt(m2[1], 10);
			}
		});

		// Parse notifier configs
		var notifiers = [
			{ name: 'Telegram', key: 'telegram', icon: '✈️' },
			{ name: '企业微信', key: 'wechat', icon: '💬' },
			{ name: 'Bark', key: 'bark', icon: '🔔' },
			{ name: 'Server酱', key: 'serverchan', icon: '📨' },
			{ name: 'Server酱³', key: 'serverchan3', icon: '📱' }
		];

		var notifierRows = [];
		notifiers.forEach(function(n) {
			var enabled = false;
			var configured = false;
			try {
				enabled = uci.get('eventcenter', n.key, 'enable') === '1';
				// Check if key fields are filled
				if (n.key === 'telegram') configured = !!uci.get('eventcenter', n.key, 'token');
				else if (n.key === 'wechat') configured = !!uci.get('eventcenter', n.key, 'webhook');
				else if (n.key === 'bark') configured = !!uci.get('eventcenter', n.key, 'device_key');
				else if (n.key === 'serverchan') configured = !!uci.get('eventcenter', n.key, 'sendkey');
				else if (n.key === 'serverchan3') configured = !!uci.get('eventcenter', n.key, 'sendkey');
			} catch(e) {}

			var statusText, statusColor;
			if (enabled && configured) {
				statusText = '✅ 运行中';
				statusColor = '#28a745';
			} else if (configured) {
				statusText = '⏸ 已配置';
				statusColor = '#ffc107';
			} else {
				statusText = '⭕ 未配置';
				statusColor = '#6c757d';
			}

			notifierRows.push(E('tr', {}, [
				E('td', {}, n.icon + ' ' + n.name),
				E('td', { 'style': 'color:' + statusColor + ';font-weight:bold' }, statusText)
			]));
		});

		var notifierTable = E('div', { 'class': 'panel cbi-section', 'style': 'margin-bottom:15px' }, [
			E('h3', {}, '通知渠道'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', { 'style': 'width:150px' }, '渠道'),
					E('th', {}, '状态')
				])),
				E('tbody', {}, notifierRows)
			])
		]);

		// Parse subscription state
		var subStateDir = '/tmp/eventcenter_openclash/';
		var subsFiles = subsOutput.trim().split('\n').filter(function(f) { return f.length > 0; });
		var subRows = [];
		subsFiles.forEach(function(f) {
			var subName = f.replace('.state', '');
			subRows.push(E('tr', {}, [
				E('td', { 'style': 'font-weight:bold' }, subName),
				E('td', {}, '✅ 已建立基线')
			]));
		});
		if (subRows.length === 0) {
			subRows.push(E('tr', {}, E('td', { 'colspan': '2', 'style': 'text-align:center;padding:15px;color:#888' }, '暂无订阅数据（等待首次同步）')));
		}

		// Parse node state for group count
		var nodeLines = stateOutput.trim().split('\n').filter(function(l) { return l.length > 0; });

		var subTable = E('div', { 'class': 'panel cbi-section', 'style': 'margin-bottom:15px' }, [
			E('h3', {}, '订阅监控'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', { 'style': 'width:200px' }, '订阅名称'),
					E('th', {}, '状态')
				])),
				E('tbody', {}, subRows)
			]),
			E('div', { 'style': 'padding:8px 15px;font-size:0.9em;color:#666' }, [
				E('span', {}, '节点健康监测: '),
				E('strong', {}, nodeLines.length > 0 ? nodeLines.length + ' 个代理组' : '未启用')
			])
		]);

		// Parse recent events (last 10)
		var logLines = logOutput.split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
		var recentEntries = [];
		for (var i = logLines.length - 1; i >= 0 && recentEntries.length < 10; i--) {
			var parts = logLines[i].split('|');
			if (parts.length >= 5) {
				recentEntries.push({
					time: parts[0],
					source: parts[1],
					event: parts[2],
					level: parts[3],
					title: parts[4]
				});
			}
		}

		var eventRows = [];
		if (recentEntries.length === 0) {
			eventRows.push(E('tr', {}, E('td', { 'colspan': '4', 'style': 'text-align:center;padding:20px;color:#888' }, '暂无事件记录')));
		} else {
			recentEntries.forEach(function(entry) {
				var levelColor = { info: '#17a2b8', warn: '#ffc107', error: '#dc3545', critical: '#6f1207' };
				eventRows.push(E('tr', {}, [
					E('td', { 'style': 'white-space:nowrap;font-size:0.9em' }, entry.time),
					E('td', {}, E('span', {
						'style': 'padding:2px 8px;border-radius:3px;font-size:0.85em;font-weight:bold;color:' + (levelColor[entry.level] || '#333')
					}, entry.level)),
					E('td', {}, entry.title),
					E('td', { 'style': 'font-size:0.9em;color:#666' }, entry.source)
				]));
			});
		}

		var eventTable = E('div', { 'class': 'panel cbi-section', 'style': 'margin-bottom:15px' }, [
			E('h3', {}, '最近事件'),
			E('table', { 'class': 'table' }, [
				E('thead', {}, E('tr', {}, [
					E('th', { 'style': 'width:160px' }, '时间'),
					E('th', { 'style': 'width:80px' }, '级别'),
					E('th', { 'style': 'width:200px' }, '标题'),
					E('th', {}, '来源')
				])),
				E('tbody', {}, eventRows)
			])
		]);

		// Status summary card
		var enabledNotifiers = notifiers.filter(function(n) {
			try {
				var e = uci.get('eventcenter', n.key, 'enable') === '1';
				var c = false;
				if (n.key === 'telegram') c = !!uci.get('eventcenter', n.key, 'token');
				else if (n.key === 'wechat') c = !!uci.get('eventcenter', n.key, 'webhook');
				else if (n.key === 'bark') c = !!uci.get('eventcenter', n.key, 'device_key');
				else if (n.key === 'pushplus') c = !!uci.get('eventcenter', n.key, 'token');
				return e && c;
			} catch(e) { return false; }
		}).length;

		var summaryCard = E('div', { 'class': 'panel cbi-section', 'style': 'margin-bottom:15px;padding:20px' }, [
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:20px' }, [
				E('div', { 'style': 'flex:1;min-width:120px;text-align:center;padding:15px;background:' + (globalEnabled ? '#d4edda' : '#f8d7da') + ';border-radius:8px' }, [
					E('div', { 'style': 'font-size:1.8em;font-weight:bold;color:' + (globalEnabled ? '#155724' : '#721c24') }, globalEnabled ? '运行中' : '已停止'),
					E('div', { 'style': 'font-size:0.85em;color:#666;margin-top:5px' }, '服务状态')
				]),
				E('div', { 'style': 'flex:1;min-width:120px;text-align:center;padding:15px;background:#e7f3ff;border-radius:8px' }, [
					E('div', { 'style': 'font-size:1.8em;font-weight:bold;color:#004085' }, '' + enabledNotifiers),
					E('div', { 'style': 'font-size:0.85em;color:#666;margin-top:5px' }, '活跃通知渠道')
				]),
				E('div', { 'style': 'flex:1;min-width:120px;text-align:center;padding:15px;background:#fff3cd;border-radius:8px' }, [
					E('div', { 'style': 'font-size:1.8em;font-weight:bold;color:#856404' }, '' + logCount),
					E('div', { 'style': 'font-size:0.85em;color:#666;margin-top:5px' }, '总事件数')
				]),
				E('div', { 'style': 'flex:1;min-width:120px;text-align:center;padding:15px;background:#e8f5e9;border-radius:8px' }, [
					E('div', { 'style': 'font-size:1.8em;font-weight:bold;color:#2e7d32' }, '' + subsFiles.length),
					E('div', { 'style': 'font-size:0.85em;color:#666;margin-top:5px' }, '监控订阅数')
				])
			]),
			lastEvent ? E('div', { 'style': 'margin-top:10px;font-size:0.9em;color:#666' }, '最近事件: ' + lastEvent) : ''
		]);

		var container = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, '事件中心 - 概览'),
			summaryCard,
			notifierTable,
			subTable,
			eventTable
		]);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
