'use strict';
'require view';
'require form';
'require fs';
'require uci';

var EC_CSS = [
	'.cbi-map { padding:0 !important; max-width:100%; overflow-x:hidden }',
	'.cbi-map > h2 { margin-bottom:4px }',
	'.cbi-map > .cbi-map-descr { color:var(--text-color-secondary, #666);font-size:0.9em;margin-bottom:20px }',
	'.ec-card { background:var(--background-color-white, #fff);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;overflow:hidden }',
	'.ec-card h3 { margin:0 0 14px;font-size:1em }',
	'.ec-table { width:100%;border-collapse:collapse;min-width:0 }',
	'.ec-table th { text-align:left;padding:8px 12px;font-size:0.8em;color:var(--text-color-secondary, #666);border-bottom:2px solid var(--border-color-light, #eee) }',
	'.ec-table td { padding:10px 12px;border-bottom:1px solid var(--border-color-light, #f3f4f6);word-break:break-all }',
	'.ec-stats { display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px }',
	'.ec-stat { flex:1;min-width:120px;text-align:center;padding:16px;border-radius:10px }',
	'.ec-dot { display:inline-block;width:10px;height:10px;border-radius:50% }',
	'.cbi-section { background:var(--background-color-white, #fff);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;border-top:3px solid var(--border-color-medium, #6b7280);overflow:hidden }',
	'.cbi-section > h3 { border-bottom:1px solid var(--border-color-light, #eee);padding:16px 20px 12px;margin:-20px -20px 16px;font-size:1.05em;font-weight:700 }',
	'.cbi-value { margin-bottom:10px }',
	'.cbi-value > .cbi-value-title { font-weight:600;font-size:0.85em;color:var(--text-color, #555);margin-bottom:4px }',
	'.cbi-value input[type=text], .cbi-value select { border:1px solid var(--border-color, #ddd);border-radius:6px;padding:8px 10px;background:var(--background-color, #fff);color:var(--text-color, #333);max-width:100% }',
	'.cbi-value input:focus, .cbi-value select:focus { border-color:#3b82f6;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,0.15) }',
	'.cbi-value .cbi-input-description { font-size:0.75em;color:var(--text-color-secondary, #888);margin-top:4px }',
	'.cbi-page-actions { display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee);flex-wrap:wrap }',
	'.cbi-button-apply { background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'@media (prefers-color-scheme: dark) {',
	'  .ec-card, .cbi-section { background:var(--background-color-white, #1e1e2e);box-shadow:0 2px 8px rgba(0,0,0,.3) }',
	'  .ec-table th { border-bottom-color:var(--border-color-light, #333) }',
	'  .ec-table td { border-bottom-color:var(--border-color-light, #2a2a3e) }',
	'}'
].join(' ');
var st = document.createElement('style'); st.textContent = EC_CSS; document.head.appendChild(st);

function statusDot(color) {
	return E('span', { 'class': 'ec-dot', 'style': 'background:' + color });
}

function statCard(value, label, bg, color) {
	return E('div', { 'class': 'ec-stat', 'style': 'background:' + bg }, [
		E('div', { 'style': 'font-size:1.6em;font-weight:bold;color:' + color }, value),
		E('div', { 'style': 'font-size:0.8em;color:var(--text-color-secondary,#666);margin-top:4px' }, label)
	]);
}

return view.extend({
load: function() {
	return Promise.all([
		uci.load('eventcenter'),
		L.resolveDefault(fs.exec('/bin/cat', ['/tmp/eventcenter_node_state']), { stdout: '' }),
		L.resolveDefault(fs.exec('/bin/cat', ['/etc/eventcenter/failed_nodes']), { stdout: '' }),
		L.resolveDefault(fs.exec('/usr/bin/tail', ['-30', '/etc/eventcenter/latency_history']), { stdout: '' }),
		L.resolveDefault(fs.exec('/bin/cat', ['/tmp/eventcenter.log']), { stdout: '' })
	]);
},

render: function(data) {
	var healthEnabled = uci.get('eventcenter', 'health', 'enable') === '1';
	var stateOutput = (data[1] && data[1].stdout) ? data[1].stdout.trim() : '';
	var failedOutput = (data[2] && data[2].stdout) ? data[2].stdout.trim() : '';
	var latencyOutput = (data[3] && data[3].stdout) ? data[3].stdout.trim() : '';
	var logOutput = (data[4] && data[4].stdout) ? data[4].stdout.trim() : '';

		/* Parse state */
		var stateEntries = stateOutput.split('\n').filter(function(l) { return l.length > 0; }).map(function(line) {
			var p = line.split('\t');
			return { group: p[0] || '', node: p[1] || '' };
		});

		/* Parse failed */
		var failedEntries = failedOutput.split('\n').filter(function(l) { return l.length > 0; }).map(function(line) {
			var p = line.split('\t');
			return { group: p[0] || '', node: p[1] || '' };
		});

		/* Parse latency */
		var latencyLines = latencyOutput.split('\n').filter(function(l) { return l.length > 0; });
		var latencyEntries = [];
		for (var i = latencyLines.length - 1; i >= 0 && latencyEntries.length < 20; i--) {
			var parts = latencyLines[i].split('\t');
			if (parts.length >= 4) latencyEntries.push({ time: parts[0], group: parts[1], node: parts[2], delay: parts[3] });
		}

		/* Parse health events */
		var logLines = logOutput.split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
		var healthEvents = [];
		for (var j = logLines.length - 1; j >= 0 && healthEvents.length < 10; j--) {
			var p = logLines[j].split('|');
			if (p.length >= 6 && (p[2] === 'node_failover' || p[2] === 'node_recovery')) {
				healthEvents.push({ time: p[0], event: p[2], level: p[3], title: p[4] });
			}
		}

		/* ── 统计卡 ── */
		var stats = E('div', { 'class': 'ec-stats' }, [
			statCard(healthEnabled ? '运行中' : '已禁用', '监测服务', healthEnabled ? '#d4edda' : '#f8d7da', healthEnabled ? '#155724' : '#721224'),
			statCard(stateEntries.length + ' 个', '监控组', '#e7f3ff', '#004085'),
			statCard(failedEntries.length > 0 ? failedEntries.length + ' 个' : '无', '故障节点', failedEntries.length > 0 ? '#fef2f2' : '#d4edda', failedEntries.length > 0 ? '#dc2626' : '#155724')
		]);

		/* ── 当前节点选择 ── */
		var stateRows = [];
		if (stateEntries.length === 0) {
			stateRows.push(E('tr', {}, E('td', { 'colspan': '2', 'style': 'text-align:center;padding:20px;color:var(--text-color-secondary,#888)' }, '暂无数据')));
		} else {
			stateEntries.forEach(function(entry) {
				var isFailed = failedEntries.some(function(f) { return f.group === entry.group; });
				stateRows.push(E('tr', {}, [
					E('td', { 'style': 'font-weight:600' }, entry.group),
					E('td', {}, [
						E('span', { 'style': isFailed ? 'color:#dc2626;font-weight:600' : '' }, entry.node),
						isFailed ? E('span', { 'style': 'margin-left:8px;padding:2px 6px;border-radius:4px;background:#fef2f2;color:#dc2626;font-size:0.8em' }, '⚠ 故障中') : ''
					])
				]));
			});
		}

		/* ── 延迟记录 ── */
		var latencyRows = [];
		if (latencyEntries.length === 0) {
			latencyRows.push(E('tr', {}, E('td', { 'colspan': '4', 'style': 'text-align:center;padding:20px;color:var(--text-color-secondary,#888)' }, '暂无延迟记录')));
		} else {
			latencyEntries.forEach(function(entry) {
				var delayNum = parseInt(entry.delay, 10);
				var delayColor = delayNum < 500 ? '#22c55e' : delayNum < 1000 ? '#f59e0b' : '#dc2626';
				latencyRows.push(E('tr', {}, [
					E('td', { 'style': 'font-size:0.85em;white-space:nowrap' }, entry.time),
					E('td', {}, entry.group),
					E('td', { 'style': 'max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.9em' }, entry.node),
					E('td', { 'style': 'color:' + delayColor + ';font-weight:bold' }, entry.delay + ' ms')
				]));
			});
		}

		/* ── 切换事件 ── */
		var eventRows = [];
		if (healthEvents.length === 0) {
			eventRows.push(E('tr', {}, E('td', { 'colspan': '3', 'style': 'text-align:center;padding:20px;color:var(--text-color-secondary,#888)' }, '暂无切换事件')));
		} else {
			healthEvents.forEach(function(entry) {
				var isRecovery = entry.event === 'node_recovery';
				eventRows.push(E('tr', {}, [
					E('td', { 'style': 'font-size:0.85em;white-space:nowrap' }, entry.time),
					E('td', {}, E('span', {
						'style': 'padding:3px 10px;border-radius:6px;font-size:0.8em;font-weight:bold;color:#fff;background:' + (isRecovery ? '#22c55e' : '#dc2626')
					}, isRecovery ? '💚 恢复' : '🚨 故障')),
					E('td', {}, entry.title)
				]));
			});
		}

		/* ── 布局 ── */
		var content = E('div', { 'style': 'padding:0' }, [
			stats,

			E('div', { 'class': 'ec-card', 'style': 'border-top:3px solid #2563eb' }, [
				E('h3', {}, '🔗 当前节点选择'),
				E('table', { 'class': 'ec-table' }, [
					E('thead', {}, E('tr', {}, [
						E('th', { 'style': 'width:200px' }, '代理组'),
						E('th', {}, '当前节点')
					])),
					E('tbody', {}, stateRows)
				])
			]),

			E('div', { 'class': 'ec-card', 'style': 'border-top:3px solid #f59e0b' }, [
				E('h3', {}, '📊 延迟记录 (最近20条)'),
				E('table', { 'class': 'ec-table' }, [
					E('thead', {}, E('tr', {}, [
						E('th', {}, '时间'),
						E('th', {}, '代理组'),
						E('th', {}, '节点'),
						E('th', {}, '延迟')
					])),
					E('tbody', {}, latencyRows)
				])
			]),

			E('div', { 'class': 'ec-card', 'style': 'border-top:3px solid #dc2626' }, [
				E('h3', {}, '🚨 最近切换事件'),
				E('table', { 'class': 'ec-table' }, [
					E('thead', {}, E('tr', {}, [
						E('th', {}, '时间'),
						E('th', {}, '类型'),
						E('th', {}, '标题')
					])),
					E('tbody', {}, eventRows)
				])
			])
		]);

		/* 用 form.Map 包装，让 LuCI 生成标准按钮 */
		var m = new form.Map('eventcenter', '节点健康', '代理组节点状态、延迟和故障切换记录');
		var s = m.section(form.NamedSection, 'health', 'health', '');
		s.addremove = false;
		s.anonymous = false;
		s.render = function() { return content; };

		return m.render().then(function(node) {
			/* 追加保存并重启按钮 */
			setTimeout(function() {
				var pa = document.querySelector('.cbi-page-actions');
				if (pa && !pa.querySelector('.ec-restart-btn')) {
					var restartBtn = E('button', { 'class': 'cbi-button-apply ec-restart-btn', 'style': 'margin-left:8px' }, '保存并重启');
					restartBtn.addEventListener('click', function() {
						var btn = this;
						btn.textContent = '保存中...'; btn.disabled = true;
						uci.save().then(function() { return uci.apply(); }).then(function() {
							btn.textContent = '重启中...';
							return fs.exec('/etc/init.d/eventcenter', ['restart']);
						}).then(function(res) {
							btn.textContent = (res && res.code === 0) ? '✓ 已完成' : '✓ 已保存';
							btn.style.background = '#22c55e';
							setTimeout(function() { btn.textContent = '保存并重启'; btn.style.background = '#f59e0b'; btn.disabled = false; }, 3000);
						}).catch(function() {
							btn.textContent = '✗ 失败'; btn.style.background = '#dc2626';
							setTimeout(function() { btn.textContent = '保存并重启'; btn.style.background = '#f59e0b'; btn.disabled = false; }, 3000);
						});
					});
					pa.appendChild(restartBtn);
				}
			}, 300);
			return node;
		});
	},
});
