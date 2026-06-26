'use strict';
'require view';
'require fs';
'require view.eventcenter.common as ec';

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

		ec.injectCSS(ec.CARD_CSS + ' ' + [
			'.ec-log{max-height:500px;overflow-y:auto;font-family:monospace;font-size:.8em;word-break:break-all}',
			'.ec-entry{display:flex;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border-color-light, #f0f0f0)}',
			'.ec-entry:last-child{border-bottom:none}',
			'.ec-time{color:var(--text-color-secondary, #999);min-width:120px;flex-shrink:0}',
			'.ec-lvl{display:inline-block;padding:1px 8px;border-radius:10px;font-size:.8em;margin-right:8px;font-weight:500;flex-shrink:0}',
			'.ec-msg{flex:1;min-width:0;word-break:break-all;color:var(--text-color, #333)}',
			'@media (prefers-color-scheme: dark) {',
			'  .ec-entry{border-bottom-color:var(--border-color-light, #333)}',
			'}'
		].join(' '));

		var entries = logLines.map(function(line) {
			var p = line.split('|');
			var time = p[0] || '';
			var level = p[3] || '';
			var msg = (p[4] ? p[4] + ': ' : '') + (p[5] || line);
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

		var content = E('div', { 'class': 'ec-page' }, [
			E('h2', {}, '日志'),
			E('p', { 'style': 'color:var(--text-color-secondary, #666);font-size:.9em;margin-bottom:20px' }, '系统运行日志，最近 100 条记录'),

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
					: E('div', { 'style': 'text-align:center;padding:40px;color:var(--text-color-secondary,#999)' }, [
						E('div', { 'style': 'font-size:3em;margin-bottom:12px' }, '📋'),
						E('div', {}, '暂无日志'),
						E('div', { 'style': 'font-size:.9em;margin-top:4px' }, '运行监控任务后将在此显示日志')
					])
			])
		]);

		var pageActions = E('div', { 'class': 'ec-actions' }, [ec.createRestartBtn(fs)]);

		return E('div', {}, [content, pageActions]);
	},
});
