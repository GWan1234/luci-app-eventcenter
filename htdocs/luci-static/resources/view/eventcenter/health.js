'use strict';
'require view';
'require form';
'require fs';
'require uci';

var CARD_CSS = [
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
	'.cbi-button-apply { background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-page-actions { display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee);flex-wrap:wrap }',
	'.ec-sys-card { background:var(--background-color-secondary, #f9fafb);border-radius:10px;padding:16px;overflow:hidden }',
	'.ec-bar { background:var(--background-color-secondary, #e5e7eb);border-radius:8px;height:12px;overflow:hidden }',
	'.ec-fill { height:100%;transition:width .3s }',
	'.ec-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px }',
	'@media (prefers-color-scheme: dark) {',
	'  .cbi-section { background:var(--background-color-white, #1e1e2e);box-shadow:0 2px 8px rgba(0,0,0,.3) }',
	'  .cbi-section > h3 { border-bottom-color:var(--border-color-light, #333) }',
	'  .ec-sys-card { background:var(--background-color-secondary, #2a2a3e) }',
	'}'
].join(' ');
var st = document.createElement('style'); st.textContent = CARD_CSS; document.head.appendChild(st);

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('eventcenter'),
			fs.exec('/usr/share/eventcenter/sources/system-health.sh', ['get'])
		]);
	},

	render: function(data) {
		var healthRes = data[1];
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

		var m, s, o;
		m = new form.Map('eventcenter', '节点健康', '监控节点延迟与可用性，支持自动切换。');

		/* 系统状态展示 */
		s = m.section(form.NamedSection, 'node_health', 'health', '📊 系统状态');
		s.addremove = false; s.anonymous = false;
		s.render = function() {
			var cpuC = hData.cpu > 80 ? '#ef4444' : '#3b82f6';
			var memC = hData.mem > 80 ? '#ef4444' : '#8b5cf6';
			var tempC = hData.temp > 75 ? '#ef4444' : '#f59e0b';
			return E('div', { 'class': 'cbi-section', 'style': 'border-top-color:#10b981' }, [
				E('h3', {}, '📊 系统状态'),
				E('div', { 'class': 'ec-grid' }, [
					E('div', { 'class': 'ec-sys-card' }, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🔥 CPU'),
						E('div', { 'class': 'ec-bar' }, E('div', { 'class': 'ec-fill', 'style': 'background:'+cpuC+';width:'+hData.cpu+'%' })),
						E('div', { 'style': 'text-align:right;font-size:.8em;color:var(--text-color-secondary,#666);margin-top:4px' }, hData.cpu+'%')
					]),
					E('div', { 'class': 'ec-sys-card' }, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🧠 内存'),
						E('div', { 'class': 'ec-bar' }, E('div', { 'class': 'ec-fill', 'style': 'background:'+memC+';width:'+hData.mem+'%' })),
						E('div', { 'style': 'text-align:right;font-size:.8em;color:var(--text-color-secondary,#666);margin-top:4px' }, hData.mem+'%')
					]),
					E('div', { 'class': 'ec-sys-card' }, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '🌡️ 温度'),
						E('div', { 'style': 'font-size:2em;font-weight:700;color:'+tempC }, hData.temp > 0 ? hData.temp+'°C' : 'N/A')
					]),
					E('div', { 'class': 'ec-sys-card' }, [
						E('div', { 'style': 'font-weight:600;margin-bottom:8px' }, '📡 运行时间'),
						E('div', { 'style': 'font-size:1.2em;font-weight:700;color:#3b82f6' }, hData.uptime)
					])
				])
			]);
		};

		/* 节点配置 */
		s = m.section(form.NamedSection, 'node_health', 'health', '🔗 节点配置');
		s.addremove = false; s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用', '启用节点健康监控');
		o.default = '0'; o.rmempty = false;

		o = s.option(form.DynamicList, 'url', '节点地址', 'Clash 代理节点地址');
		o.depends('enable', '1');

		o = s.option(form.DynamicList, 'name', '节点名称', '节点显示名称（与地址一一对应）');
		o.depends('enable', '1');

		o = s.option(form.ListValue, 'interval', '检测间隔');
		o.value('1', '1 分钟'); o.value('5', '5 分钟'); o.value('10', '10 分钟');
		o.value('30', '30 分钟'); o.value('60', '1 小时');
		o.default = '5'; o.depends('enable', '1'); o.rmempty = false;

		o = s.option(form.ListValue, 'target', '目标网站');
		o.value('google', 'Google'); o.value('github', 'GitHub'); o.value('cloudflare', 'Cloudflare');
		o.value('baidu', '百度'); o.value('bilibili', 'B站');
		o.default = 'google'; o.depends('enable', '1'); o.rmempty = false;

		o = s.option(form.Flag, 'enable_auto_switch', '自动切换', '节点故障时自动切换到备用节点');
		o.default = '0'; o.depends('enable', '1'); o.rmempty = false;

		return m.render().then(function(node) {
			function addRestartBtn(container) {
				var restartBtn = E('button', { 'class': 'cbi-button-apply', 'style': 'margin-left:8px' }, '保存并重启');
				restartBtn.addEventListener('click', function() {
					var btn = this;
					btn.textContent = '保存中...'; btn.disabled = true;
					uci.save().then(function() { return uci.apply(); }).then(function() {
						btn.textContent = '重启中...';
						return fs.exec('/etc/init.d/eventcenter', ['restart']);
					}).then(function(res) {
						btn.textContent = (res && res.code === 0) ? '✓ 已完成' : '✓ 已保存';
						btn.style.background = '#22c55e'; btn.style.borderColor = '#22c55e';
						setTimeout(function() { btn.textContent = '保存并重启'; btn.style.background = '#f59e0b'; btn.style.borderColor = '#f59e0b'; btn.disabled = false; }, 3000);
					}).catch(function() {
						btn.textContent = '✗ 失败'; btn.style.background = '#dc2626'; btn.style.borderColor = '#dc2626';
						setTimeout(function() { btn.textContent = '保存并重启'; btn.style.background = '#f59e0b'; btn.style.borderColor = '#f59e0b'; btn.disabled = false; }, 3000);
					});
				});
				container.appendChild(restartBtn);
			}
			var pageActions = node.parentElement ? node.parentElement.querySelector('.cbi-page-actions') : null;
			if (pageActions) {
				addRestartBtn(pageActions);
			} else {
				setTimeout(function() {
					var pa = document.querySelector('.cbi-page-actions');
					if (pa) addRestartBtn(pa);
				}, 200);
			}
			return node;
		});
	},
});
