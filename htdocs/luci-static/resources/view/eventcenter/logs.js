'use strict';
'require view';
'require fs';

return view.extend({
	load: function() {
		return fs.exec('/bin/cat', ['/tmp/eventcenter.log']);
	},

	render: function(logRes) {
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
			'.ec-log{max-height:500px;overflow-y:auto;font-family:monospace;font-size:.8em;word-break:break-all}',
			'.ec-entry{display:flex;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border-color-light, #f0f0f0)}',
			'.ec-entry:last-child{border-bottom:none}',
			'.ec-time{color:var(--text-color-secondary, #999);min-width:120px;flex-shrink:0}',
			'.ec-lvl{display:inline-block;padding:1px 8px;border-radius:10px;font-size:.8em;margin-right:8px;font-weight:500;flex-shrink:0}',
			'.ec-msg{flex:1;min-width:0;word-break:break-all;color:var(--text-color, #333)}',
			'.ec-actions{display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee)}',

					'.ec-muted{color:var(--text-color-secondary,#666)}',
			'.ec-lvl{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.75em;font-weight:600}',
		].join(' ');
		var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
				/* 暗夜模式检测（兼容 Argon 主题手动切换） */
				(function(){if(document.cookie.indexOf('argonDarkMode=1')>-1||window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('ec-dark');var s=document.createElement('style');s.textContent='.ec-dark .ec-card{background:#1e1e2e!important;box-shadow:0 2px 8px rgba(0,0,0,.3)!important}.ec-dark .ec-actions{border-top-color:#374151!important}.ec-dark .ec-muted{color:#9ca3af!important}.ec-dark h3{background:#333!important;color:#ccc!important}.ec-dark .ec-lvl{background:#1f2937!important}';document.head.appendChild(s)})()

		var entries = logLines.map(function(line) {
			var p = line.split('|');
			var time = p[0] || '';
			var level = p[3] || '';
			var msg = (p[4] ? p[4] + ': ' : '') + (p[5] || line);
			var lc = '', lb = '', useDefault = true;
			if (level==='error'||level==='ERROR') { lc='#dc2626'; lb='#fee2e2'; useDefault=false; }
			else if (level==='warn'||level==='WARN') { lc='#d97706'; lb='#fef3c7'; useDefault=false; }
			else if (level==='info'||level==='INFO') { lc='#2563eb'; lb='#dbeafe'; useDefault=false; }
			else if (level==='success'||level==='OK') { lc='#059669'; lb='#d1fae5'; useDefault=false; }
			return E('div', { 'class': 'ec-entry' }, [
				E('span', { 'class': 'ec-time' }, time),
				level ? E('span', { 'class': 'ec-lvl'+(useDefault?' ec-muted':''), 'style': useDefault?'':'background:'+lb+';color:'+lc }, level) : E('span', { 'style': 'min-width:60px' }),
				E('span', { 'class': 'ec-msg' }, msg)
			]);
		});

		var content = E('div', { 'class': 'ec-page' }, [
			E('h2', {}, '日志'),
			E('p', { 'class': 'ec-muted', 'style': 'font-size:.9em;margin-bottom:20px' }, '系统运行日志，最近 100 条记录'),

			E('div', { 'class': 'ec-card' }, [
				E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px' }, [
					E('h3', { 'style': 'margin:0;font-size:1.05em' }, '📋 运行日志'),
					(function() {
						var clearBtn = E('button', {
							'class': 'cbi-button',
							'style': 'border-color:#ef4444;color:#ef4444'
						}, '🗑️ 清除日志');
						clearBtn.addEventListener('click', function() {
							if (confirm('确定要清除所有日志吗？')) {
								fs.exec('/bin/rm', ['-f', '/tmp/eventcenter.log']).then(function() { window.location.reload(); });
							}
						});
						return clearBtn;
					})()
				]),
				logLines.length > 0
					? E('div', { 'class': 'ec-log' }, entries)
					: E('div', { 'class': 'ec-muted', 'style': 'text-align:center;padding:40px' }, [
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