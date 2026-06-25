'use strict';
'require view';
'require form';
'require fs';
'require poll';
'require dom';
'require uci';

var cardBase = 'background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px';
var tableStyle = 'width:100%;border-collapse:collapse';
var btnStyle = 'padding:8px 16px;border:none;border-radius:6px;font-size:0.85em;cursor:pointer;font-weight:600';

return view.extend({
	load: function() {
		return uci.load('eventcenter');
	},

	render: function() {
		var logPath = uci.get('eventcenter', 'global', 'log_path') || '/tmp/eventcenter.log';
		var PAGE_SIZE = 50;
		var currentPage = 1;
		var allEntries = [];

		/* ── 工具栏 ── */
		var toolbar = E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px' }, [
			E('div', { 'style': 'display:flex;align-items:center;gap:8px' }, [
				E('span', { 'style': 'font-weight:600' }, '📁'),
				E('code', { 'style': 'background:#f3f4f6;padding:4px 8px;border-radius:4px;font-size:0.85em' }, logPath)
			]),
			E('div', { 'style': 'display:flex;gap:8px' }, [
				E('button', {
					'style': btnStyle + 'background:#f0f0f0;color:#333',
					'click': function() { refreshLogs(); }
				}, '🔄 刷新'),
				E('button', {
					'style': btnStyle + 'background:#fef2f2;color:#dc2626',
					'click': function() {
						if (confirm('确认清空所有日志? 此操作不可撤销。')) {
							fs.write(logPath, '').then(function() { refreshLogs(); });
						}
					}
				}, '🗑 清空日志')
			])
		]);

		/* ── 日志表格 ── */
		var logContent = E('div', { 'id': 'log-content' }, [
			E('div', { 'style': 'text-align:center;padding:30px;color:#888' }, '加载中...')
		]);

		var container = E('div', { 'style': 'padding:0' }, [
			E('h2', { 'style': 'margin-bottom:4px' }, '事件日志'),
			E('div', { 'style': 'color:#666;font-size:0.9em;margin-bottom:20px' }, '系统事件记录，自动刷新'),
			toolbar,
			E('div', { 'style': cardBase + ';padding:0;overflow:hidden' }, [logContent])
		]);

		function parseLog(raw) {
			var lines = raw.trim().split('\n').filter(function(l) { return l.length > 0 && l.indexOf('|') > -1; });
			var entries = [];
			for (var i = 0; i < lines.length; i++) {
				var parts = lines[i].split('|');
				if (parts.length >= 6) {
					entries.push({ time: parts[0], source: parts[1], event: parts[2], level: parts[3], title: parts[4], message: parts[5] });
				}
			}
			return entries;
		}

		function renderPage(entries, page) {
			var totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
			if (page > totalPages) page = totalPages;
			if (page < 1) page = 1;

			var start = (page - 1) * PAGE_SIZE;
			var pageEntries = entries.slice(start, start + PAGE_SIZE);

			var rows = [];
			if (pageEntries.length === 0) {
				rows.push(E('tr', {}, E('td', { 'colspan': '6', 'style': 'text-align:center;padding:30px;color:#888' }, '暂无日志记录')));
			} else {
				pageEntries.forEach(function(entry) {
					var levelColor = { info: '#17a2b8', warn: '#f59e0b', error: '#dc2626', critical: '#7f1d1d' };
					rows.push(E('tr', { 'style': 'border-bottom:1px solid #f3f4f6' }, [
						E('td', { 'style': 'white-space:nowrap;font-size:0.85em;padding:10px 12px;color:#555' }, entry.time),
						E('td', { 'style': 'padding:10px 12px' }, E('span', { 'style': 'padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600;background:#eff6ff;color:#2563eb' }, entry.source)),
						E('td', { 'style': 'font-size:0.85em;padding:10px 12px;color:#555' }, entry.event),
						E('td', { 'style': 'padding:10px 12px' }, E('span', {
							'style': 'padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:bold;color:' + (levelColor[entry.level] || '#333') + ';background:' + (levelColor[entry.level] || '#333') + '18'
						}, entry.level)),
						E('td', { 'style': 'font-weight:600;padding:10px 12px' }, entry.title),
						E('td', { 'style': 'max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85em;color:#666;padding:10px 12px', 'title': entry.message }, entry.message)
					]));
				});
			}

			/* 分页 */
			var pagination = E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid #f3f4f6;background:#fafafa' }, [
				E('span', { 'style': 'font-size:0.85em;color:#666' }, '显示 %d - %d / 共 %d 条'.format(start + 1, Math.min(start + PAGE_SIZE, entries.length), entries.length)),
				E('div', { 'style': 'display:flex;gap:6px;align-items:center' }, [
					E('button', {
						'style': btnStyle + 'background:#f0f0f0;color:#333;font-size:0.8em',
						'disabled': page <= 1 ? 'disabled' : null,
						'click': function() { currentPage--; updateContent(); }
					}, '« 上一页'),
					E('span', { 'style': 'padding:4px 12px;background:#f3f4f6;border-radius:6px;font-size:0.8em;font-weight:600' }, '%d / %d'.format(page, totalPages)),
					E('button', {
						'style': btnStyle + 'background:#f0f0f0;color:#333;font-size:0.8em',
						'disabled': page >= totalPages ? 'disabled' : null,
						'click': function() { currentPage++; updateContent(); }
					}, '下一页 »')
				])
			]);

			return E('div', {}, [
				E('table', { 'style': tableStyle }, [
					E('thead', {}, E('tr', { 'style': 'border-bottom:2px solid #eee;background:#f9fafb' }, [
						E('th', { 'style': 'text-align:left;padding:10px 12px;font-size:0.8em;color:#666;width:160px' }, '时间'),
						E('th', { 'style': 'text-align:left;padding:10px 12px;font-size:0.8em;color:#666;width:90px' }, '来源'),
						E('th', { 'style': 'text-align:left;padding:10px 12px;font-size:0.8em;color:#666;width:120px' }, '事件'),
						E('th', { 'style': 'text-align:left;padding:10px 12px;font-size:0.8em;color:#666;width:70px' }, '级别'),
						E('th', { 'style': 'text-align:left;padding:10px 12px;font-size:0.8em;color:#666;width:160px' }, '标题'),
						E('th', { 'style': 'text-align:left;padding:10px 12px;font-size:0.8em;color:#666' }, '消息')
					])),
					E('tbody', {}, rows)
				]),
				pagination
			]);
		}

		function updateContent() {
			var content = container.querySelector('#log-content');
			if (content) dom.content(content, renderPage(allEntries, currentPage));
		}

		function refreshLogs() {
			var content = container.querySelector('#log-content');
			if (content) dom.content(content, E('div', { 'style': 'text-align:center;padding:30px;color:#888' }, '加载中...'));
			L.resolveDefault(fs.read(logPath), '').then(function(raw) {
				allEntries = parseLog(typeof raw === 'string' ? raw : '');
				allEntries.reverse();
				currentPage = 1;
				updateContent();
			}).catch(function() {
				allEntries = [];
				updateContent();
			});
		}

		refreshLogs();

		/* 30秒自动刷新 */
		poll.add(function() {
			L.resolveDefault(fs.read(logPath), '').then(function(raw) {
				var newEntries = parseLog(typeof raw === 'string' ? raw : '');
				newEntries.reverse();
				if (newEntries.length !== allEntries.length ||
					(newEntries.length > 0 && allEntries.length > 0 && newEntries[0].time !== allEntries[0].time)) {
					allEntries = newEntries;
					updateContent();
				}
			});
		}, 30);

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

		return E('div', {}, [container, pageActions]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
