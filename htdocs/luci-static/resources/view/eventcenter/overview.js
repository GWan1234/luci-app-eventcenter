'use strict';
'require view';
'require uci';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('eventcenter'),
			fs.exec('/usr/share/eventcenter/sources/system-health.sh', ['get']),
			L.resolveDefault(fs.exec('/bin/sh', ['/usr/share/eventcenter/sources/device-monitor.sh', 'list']), { code: 1, stdout: '' }),
			L.resolveDefault(fs.exec('/bin/sh', ['-c', 'pgrep -f eventcenter >/dev/null 2>&1 && echo 0 || echo 1']), { code: 1, stdout: '1' })
		]);
	},

	render: function(data) {
		var healthRes = data[1], deviceRes = data[2], pgrepRes = data[3];
		var deviceLines = [];

		/* 检测服务是否运行 */
		var isRunning = false;
		try {
			var _lastLine = (pgrepRes.stdout || '').trim().split('\n').pop();
			isRunning = (parseInt(_lastLine) === 0);
		} catch(e) {}

		try {
			if (deviceRes.code === 0 && deviceRes.stdout) {
				var parts = deviceRes.stdout.split('\n');
				for (var p = 0; p < parts.length; p++) {
					if (parts[p].indexOf('	') > 0) deviceLines.push(parts[p]);
				}
			}
		} catch(e) {}

		var hData = { cpu: 0, mem: 0, disk: 0, temp: 0, uptime: '0天' };
		try {
			if (healthRes.code === 0) {
				var hp = healthRes.stdout.split('|');
				hData.cpu = parseInt(hp[0]) || 0;
				hData.mem = parseInt(hp[1]) || 0;
				hData.temp = parseInt(hp[2]) || 0;
				hData.disk = parseInt(hp[3]) || 0;
				hData.uptime = hp[4] || '0天';
			}
		} catch(e) {}

		var onDevices = 0, offDevices = 0;
		for (var di = 0; di < deviceLines.length; di++) {
			if (deviceLines[di].split('	')[2] === 'up') onDevices++;
			else offDevices++;
		}

		var openclashCfg = uci.get('eventcenter', 'openclash') || {};
		var healthCfg = uci.get('eventcenter', 'health') || {};
		var deviceCfg = uci.get('eventcenter', 'device_monitor') || {};
		var ntfyCfg = uci.get('eventcenter', 'ntfy') || {};

		var svcs = [
			{ name: '事件中心', running: isRunning },
			{ name: 'OpenClash 监控', running: (openclashCfg.enable === '1') },
			{ name: '节点健康', running: (healthCfg.enable === '1') },
			{ name: '设备监控', running: (deviceCfg.enable === '1') },
			{ name: 'Ntfy 通知', running: (ntfyCfg.enable === '1') }
		];

		var css = [
			'.ec-page{padding:0;max-width:100%;overflow-x:hidden}',
			'.ec-card{background:var(--background-color-white, #fff);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;overflow:hidden}',
			'.ec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}',
			'.ec-tag{display:inline-block;padding:4px 12px;border-radius:20px;font-size:.85em;font-weight:600;white-space:nowrap}',
			'.ec-on{background:#d1fae5;color:#047857}',
			'.ec-off{background:#fee2e2;color:#b91c1c}',
			'.ec-bar{background:var(--background-color-secondary, #e5e7eb);border-radius:8px;height:12px;overflow:hidden}',
			'.ec-fill{height:100%;transition:width .3s}',
			'.ec-stat{text-align:center}',
			'.ec-num{font-size:1.8em;font-weight:700}',
			'.ec-lbl{font-size:.85em;color:var(--text-color-secondary, #666);margin-top:4px}',
			'.ec-dev{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color-light, #f0f0f0)}',
			'.ec-dev:last-child{border-bottom:none}',
			'.ec-actions{display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee)}',
			'.ec-svc-row{display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--background-color-secondary,#f9fafb);border-radius:8px;min-width:0}',
			'.ec-muted{color:var(--text-color-secondary,#666)}',

		].join(' ');
		var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
		/* 暗夜模式检测（兼容 Argon 主题手动切换） */
		(function(){if(document.cookie.indexOf('argonDarkMode=1')>-1||window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('ec-dark');var s=document.createElement('style');s.textContent='.ec-dark .ec-card{background:#1e1e2e!important;box-shadow:0 2px 8px rgba(0,0,0,.3)!important}.ec-dark .ec-dev{border-bottom-color:#333!important}.ec-dark .ec-on{background:#064e3b;color:#6ee7b7}.ec-dark .ec-off{background:#7f1d1d;color:#fca5a5}.ec-dark .ec-bar{background:#374151!important}.ec-dark .ec-fill{box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}.ec-dark .ec-lbl,.ec-dark .ec-muted{color:#9ca3af!important}.ec-dark .ec-svc-row{background:#1f2937!important}.ec-dark .ec-actions{border-top-color:#374151!important}.ec-dark h3{background:#333!important;color:#ccc!important}.ec-dark .ec-page{background:#1e1e1e!important}.ec-dark h2{background:#333!important;color:#ccc!important}';document.head.appendChild(s)})()

		var cpuC = hData.cpu > 80 ? '#ef4444' : '#3b82f6';
		var memC = hData.mem > 80 ? '#ef4444' : '#3b82f6';

		/* 统计数字 + 服务状态 合并到一个卡片 */
		var statsAndSvcItems = [
			E('div', { 'class': 'ec-stat' }, [
				E('div', { 'class': 'ec-num', 'style': 'color:#3b82f6;font-size:2.2em' }, '' + onDevices),
				E('div', { 'class': 'ec-lbl' }, '在线设备')
			]),
			E('div', { 'class': 'ec-stat' }, [
				E('div', { 'class': 'ec-num', 'style': 'color:#ef4444;font-size:2.2em' }, '' + offDevices),
				E('div', { 'class': 'ec-lbl' }, '离线设备')
			]),
			E('div', { 'class': 'ec-stat' }, [
				E('div', { 'class': 'ec-num', 'style': 'color:'+(isRunning?'#22c55e':'#ef4444')+';font-size:2.2em' }, isRunning?'运行中':'已停止'),
				E('div', { 'class': 'ec-lbl' }, '服务状态')
			]),
			E('div', { 'class': 'ec-stat' }, [
				E('div', { 'class': 'ec-num', 'style': 'color:#3b82f6;font-size:2.2em' }, hData.cpu+'%'),
				E('div', { 'class': 'ec-lbl' }, 'CPU 负载')
			])
		];
		/* 服务状态条目追加到统计后面 */
		svcs.forEach(function(svc) {
			statsAndSvcItems.push(
				E('div', { 'class': 'ec-svc-row' }, [
					E('span', { 'style': 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, svc.name),
					E('span', { 'class': 'ec-tag '+(svc.running?'ec-on':'ec-off') }, svc.running?'运行中':'未启用')
				])
			);
		});

		var content = E('div', { 'class': 'ec-page' }, [
			E('h2', {}, '概览'),
			E('p', { 'class': 'ec-muted', 'style': 'font-size:.9em;margin-bottom:20px' }, '系统状态与监控概览'),

			E('div', { 'class': 'ec-card' }, [
				E('h3', { 'style': 'margin:0 0 16px;font-size:1.05em' }, '📊 系统状态'),
				E('div', { 'class': 'ec-grid' }, [
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🔥 CPU'),
						E('div', { 'class': 'ec-bar' }, E('div', { 'class': 'ec-fill', 'style': 'background:'+cpuC+';width:'+hData.cpu+'%' })),
						E('div', { 'class': 'ec-muted', 'style': 'text-align:right;font-size:.8em;margin-top:4px' }, hData.cpu+'%')
					]),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🧠 内存'),
						E('div', { 'class': 'ec-bar' }, E('div', { 'class': 'ec-fill', 'style': 'background:'+memC+';width:'+hData.mem+'%' })),
						E('div', { 'class': 'ec-muted', 'style': 'text-align:right;font-size:.8em;margin-top:4px' }, hData.mem+'%')
					]),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🌡️ 温度'),
						E('div', { 'style': 'font-size:2em;font-weight:700;color:'+(hData.temp>75?'#ef4444':'#999') }, hData.temp>0?hData.temp+'°C':'N/A')
					]),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '📡 运行时间'),
						E('div', { 'style': 'font-size:1.2em;font-weight:700;color:#3b82f6' }, hData.uptime)
					])
				])
			]),

			E('div', { 'class': 'ec-card' }, [
				E('h3', { 'style': 'margin:0 0 16px;font-size:1.05em' }, '📈 状态概览'),
				E('div', { 'class': 'ec-grid' }, statsAndSvcItems)
			]),

			deviceLines.length > 0 ? E('div', { 'class': 'ec-card' }, [
				E('h3', { 'style': 'margin:0 0 16px;font-size:1.05em' }, '🖥️ 设备监控'),
				E('div', {},
					deviceLines.map(function(line) {
						var p = line.split('	');
						return E('div', { 'class': 'ec-dev' }, [
							E('span', {}, (p[2]||'up')==='up'?'🟢':'🔴'),
							E('div', { 'style': 'min-width:0' }, [
								E('div', { 'style': 'font-weight:600' }, p[0]||'未知'),
								E('div', { 'class': 'ec-muted', 'style': 'font-size:.8em' }, (p[1]||'?'))
							])
						]);
					})
				)
			]) : null
		].filter(Boolean));

		var restartBtn = E('button', { 'class': 'cbi-button cbi-button-apply', 'style': 'background:#f59e0b;border-color:#f59e0b;color:#fff' }, '重启服务');
		restartBtn.addEventListener('click', function() {
			var btn = this;
			btn.textContent = '重启中...'; btn.disabled = true;
			fs.exec('/etc/init.d/eventcenter', ['restart']).then(function(res) {
				btn.textContent = (res && res.code === 0) ? '✓ 已重启' : '✗ 失败';
				btn.style.background = (res && res.code === 0) ? '#22c55e' : '#dc2626';
				setTimeout(function() { btn.textContent = '重启服务'; btn.style.background = '#f59e0b'; btn.disabled = false; window.location.reload(); }, 2000);
			});
		});
		var pageActions = E('div', { 'class': 'ec-actions' }, [restartBtn]);

		return E('div', {}, [content, pageActions]);
	},
});