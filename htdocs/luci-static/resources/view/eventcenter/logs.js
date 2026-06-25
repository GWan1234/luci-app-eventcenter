'use strict';
'require view';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			fs.exec('/usr/share/eventcenter/sources/system-health.sh', ['get']),
			fs.exec('/bin/cat', ['/tmp/eventcenter.log'])
		]);
	},

	render: function(data) {
		var healthRes = data[0], logRes = data[1];
		var hData = { cpu: 0, mem: 0, disk: 0, temp: 0, uptime: '0天' };
		try {
			if (healthRes.code === 0) {
				var p = healthRes.stdout.split('|');
				hData.cpu = parseInt(p[0]) || 0;
				hData.mem = parseInt(p[1]) || 0;
				hData.temp = parseInt(p[2]) || 0;
				hData.disk = parseInt(p[3]) || 0;
				hData.uptime = p[4] || '0天';
			}
		} catch(e) {}

		var logLines = [];
		if (logRes && logRes.stdout) {
			var lines = logRes.stdout.split('\n');
			var start = Math.max(0, lines.length - 100);
			for (var i = start; i < lines.length; i++) {
				if (lines[i].trim()) logLines.push(lines[i]);
			}
		}

		var css = [
			'.ec-page{padding:0;max-width:100%;overflow-x:hidden}',
			'.ec-card{background:var(--background-color-white, #fff);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;overflow:hidden}',
			'.ec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}',
			'.ec-bar{background:var(--background-color-secondary, #e5e7eb);border-radius:8px;height:12px;overflow:hidden}',
			'.ec-fill{height:100%;transition:width .3s}',
			'.ec-log{max-height:500px;overflow-y:auto;font-family:monospace;font-size:.8em;word-break:break-all}',
			'.ec-entry{display:flex;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border-color-light, #f0f0f0)}',
			'.ec-entry:last-child{border-bottom:none}',
			'.ec-time{color:var(--text-color-secondary, #999);min-width:120px;flex-shrink:0}',
			'.ec-lvl{display:inline-block;padding:1px 8px;border-radius:10px;font-size:.8em;margin-right:8px;font-weight:500;flex-shrink:0}',
			'.ec-msg{flex:1;min-width:0;word-break:break-all;color:var(--text-color, #333)}',
			'.ec-actions{display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee)}',
			'@media (prefers-color-scheme: dark) {',
			'  .ec-card{background:var(--background-color-white, #1e1e2e);box-shadow:0 2px 8px rgba(0,0,0,.3)}',
			'  .ec-entry{border-bottom-color:var(--border-color-light, #333)}',
			'}'
		].join(' ');
		var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

		var entries = logLines.map(function(line) {
			var m = line.match(/^\[(.+?)\]\s*(\[.+?\])?\s*(.*)/);
			var time = m ? m[1] : '';
			var level = m ? (m[2]||'').replace(/[\[\]]/g, '') : '';
			var msg = m ? m[3] : line;
			var lc = 'var(--text-color-secondary, #666)', lb = 'var(--background-color-secondary, #f3f4f6)';
			if (level==='error'||level==='ERROR') { lc='#dc2626'; lb='#fee2e2'; }
			else if (level==='warn'||level==='WARN') { lc='#d97706'; lb='#fef3c7'; }
			else if (level==='info'||level==='INFO') { lc='#2563eb'; lb='#dbeafe'; }
			else if (level==='success'||level==='OK') { lc='#059669'; lb='#d1fae5'; }
			return E('div', { 'class': 'ec-entry' }, [
				E('span', { 'class': 'ec-time' }, time),
				level ? E('span', { 'class': 'ec-lvl', 'style': 'background:'+lb+';color:'+lc }, level) : E('span', { 'style': 'min-width:60px' }),
				E('span', { 'class': 'ec-msg' }, msg)
			]);
		});

		var cpuC = hData.cpu > 80 ? '#ef4444' : '#3b82f6';
		var memC = hData.mem > 80 ? '#ef4444' : '#8b5cf6';

		var content = E('div', { 'class': 'ec-page' }, [
			E('h2', {}, '日志'),
			E('p', { 'style': 'color:var(--text-color-secondary, #666);font-size:.9em;margin-bottom:20px' }, '系统运行日志，最近 100 条记录'),

			E('div', { 'class': 'ec-card' }, [
				E('h3', { 'style': 'margin:0 0 16px;font-size:1.05em' }, '📊 系统状态'),
				E('div', { 'class': 'ec-grid' }, [
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🔥 CPU'),
						E('div', { 'class': 'ec-bar' }, E('div', { 'class': 'ec-fill', 'style': 'background:'+cpuC+';width:'+hData.cpu+'%' })),
						E('div', { 'style': 'text-align:right;font-size:.8em;color:var(--text-color-secondary,#666);margin-top:4px' }, hData.cpu+'%')
					]),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🧠 内存'),
						E('div', { 'class': 'ec-bar' }, E('div', { 'class': 'ec-fill', 'style': 'background:'+memC+';width:'+hData.mem+'%' })),
						E('div', { 'style': 'text-align:right;font-size:.8em;color:var(--text-color-secondary,#666);margin-top:4px' }, hData.mem+'%')
					]),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🌡️ 温度'),
						E('div', { 'style': 'font-size:2em;font-weight:700;color:'+(hData.temp>75?'#ef4444':'#f59e0b') }, hData.temp>0?hData.temp+'°C':'N/A')
					]),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '📡 运行时间'),
						E('div', { 'style': 'font-size:1.2em;font-weight:700;color:#3b82f6' }, hData.uptime)
					])
				])
			]),

			E('div', { 'class': 'ec-card' }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px' }, [
					E('h3', { 'style': 'margin:0;font-size:1.05em' }, '📋 运行日志'),
					E('button', {
						'class': 'cbi-button',
						'style': 'border-color:#ef4444;color:#ef4444',
						'click': function() {
							if (confirm('确定要清除所有日志吗？')) {
								fs.exec('/bin/rm', ['-f', '/tmp/eventcenter.log']).then(function() { window.location.reload(); });
							}
						}
					}, '🗑️ 清除日志')
				]),
				logLines.length > 0
					? E('div', { 'class': 'ec-log' }, entries)
					: E('div', { 'style': 'text-align:center;padding:40px;color:var(--text-color-secondary,#999)' }, [
						E('div', { 'style': 'font-size:3em;margin-bottom:12px' }, '📋'),
						E('div', {}, '暂无日志'),
						E('div', { 'style': 'font-size:.9em;margin-top:4px' }, '运行监控任务后将在此显示日志')
					])
			])
		]);

		var restartBtn = E('button', { 'class': 'cbi-button cbi-button-apply', 'style': 'background:#f59e0b;border-color:#f59e0b;color:#fff' }, '重启服务');
		restartBtn.addEventListener('click', function() {
			var btn = this;
			btn.textContent = '重启中...'; btn.disabled = true;
			fs.exec('/etc/init.d/eventcenter', ['restart']).then(function(res) {
				btn.textContent = (res && res.code === 0) ? '✓ 已重启' : '✗ 失败';
				btn.style.background = (res && res.code === 0) ? '#22c55e' : '#dc2626';
				setTimeout(function() { btn.textContent = '重启服务'; btn.style.background = '#f59e0b'; btn.disabled = false; }, 2000);
			});
		});
		var pageActions = E('div', { 'class': 'ec-actions' }, [restartBtn]);

		return E('div', {}, [content, pageActions]);
	},
});
