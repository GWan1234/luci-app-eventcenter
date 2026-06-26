'use strict';
'require view';
'require fs';

/* ── EventCenter 共享模块 ── */

var ec = {};

/* ── 共享表单CSS ── */
ec.FORM_CSS = [
	'.cbi-map { padding:0 !important; max-width:100%; overflow-x:hidden }',
	'.cbi-map > h2 { margin-bottom:4px }',
	'.cbi-map > .cbi-map-descr { color:var(--text-color-secondary, #666);font-size:0.9em;margin-bottom:20px }',
	'.cbi-section { background:var(--background-color-white, #fff);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;border-top:3px solid var(--border-color-medium, #6b7280);overflow:hidden }',
	'.cbi-section > h3 { border-bottom:1px solid var(--border-color-light, #eee);padding-bottom:12px;margin:-20px -20px 16px -20px;padding:16px 20px 12px;font-size:1.05em;font-weight:700 }',
	'.cbi-value { margin-bottom:10px }',
	'.cbi-value > .cbi-value-title { font-weight:600;font-size:0.85em;color:var(--text-color, #555);margin-bottom:4px }',
	'.cbi-value input[type=text], .cbi-value input[type=password], .cbi-value textarea, .cbi-value select { border:1px solid var(--border-color, #ddd);border-radius:6px;padding:8px 10px;background:var(--background-color, #fff);color:var(--text-color, #333);max-width:100% }',
	'.cbi-value input:focus, .cbi-value select:focus { border-color:#3b82f6;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,0.15) }',
	'.cbi-value .cbi-input-description { font-size:0.75em;color:var(--text-color-secondary, #888);margin-top:4px }',
	'.cbi-button-save { background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-button-save:hover { background:#2563eb }',
	'.cbi-button-apply { background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-page-actions { display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee);flex-wrap:wrap }',
	'@media (prefers-color-scheme: dark) {',
	'  .cbi-section { background:var(--background-color-white, #1e1e2e);box-shadow:0 2px 8px rgba(0,0,0,.3) }',
	'  .cbi-section > h3 { border-bottom-color:var(--border-color-light, #333) }',
	'}'
].join(' ');

/* ── 共享卡片CSS ── */
ec.CARD_CSS = [
	'.ec-card { background:var(--background-color-white, #fff);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;overflow:hidden }',
	'.ec-card h3 { margin:0 0 14px;font-size:1em }',
	'.ec-table { width:100%;border-collapse:collapse;min-width:0 }',
	'.ec-table th { text-align:left;padding:8px 12px;font-size:0.8em;color:var(--text-color-secondary, #666);border-bottom:2px solid var(--border-color-light, #eee) }',
	'.ec-table td { padding:10px 12px;border-bottom:1px solid var(--border-color-light, #f3f4f6);word-break:break-all }',
	'.ec-stats { display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px }',
	'.ec-stat { flex:1;min-width:120px;text-align:center;padding:16px;border-radius:10px }',
	'.ec-dot { display:inline-block;width:10px;height:10px;border-radius:50% }',
	'@media (prefers-color-scheme: dark) {',
	'  .ec-card { background:var(--background-color-white, #1e1e2e);box-shadow:0 2px 8px rgba(0,0,0,.3) }',
	'  .ec-table th { border-bottom-color:var(--border-color-light, #333) }',
	'  .ec-table td { border-bottom-color:var(--border-color-light, #2a2a3e) }',
	'}'
].join(' ');

/* ── 注入CSS ── */
ec.injectCSS = function(css) {
	var style = document.createElement('style');
	style.textContent = css;
	document.head.appendChild(style);
};

/* ── 创建保存并重启按钮 ── */
ec.createSaveRestartBtn = function(fs, uci) {
	var btn = E('button', {
		'class': 'cbi-button cbi-button-apply',
		'style': 'margin-left:8px;background:#f59e0b;border-color:#f59e0b;color:#fff'
	}, '保存并重启');
	btn.addEventListener('click', function(ev) {
		ev.preventDefault();
		btn.textContent = '保存并重启中...';
		btn.disabled = true;
		uci.save().then(function() {
			return uci.apply();
		}).then(function() {
			return fs.exec('/etc/init.d/eventcenter', ['restart']);
		}).then(function(res) {
			btn.textContent = (res && res.code === 0) ? '✓ 已完成' : '✓ 已保存';
			btn.style.background = '#22c55e';
			btn.style.borderColor = '#22c55e';
			setTimeout(function() {
				btn.textContent = '保存并重启';
				btn.style.background = '#f59e0b';
				btn.style.borderColor = '#f59e0b';
				btn.disabled = false;
			}, 3000);
		}).catch(function() {
			btn.textContent = '✗ 失败';
			btn.style.background = '#dc2626';
			btn.style.borderColor = '#dc2626';
			setTimeout(function() {
				btn.textContent = '保存并重启';
				btn.style.background = '#f59e0b';
				btn.style.borderColor = '#f59e0b';
				btn.disabled = false;
			}, 3000);
		});
	});
	return btn;
};

return ec;
