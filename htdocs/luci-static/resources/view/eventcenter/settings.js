'use strict';
'require view';
'require form';
'require fs';
'require uci';

/* ── 美化 LuCI 顶部 Tab 菜单 ── */
;(function(){
	if(document.getElementById('ec-tab-css-v2'))return;
	var s=document.createElement('style');s.id='ec-tab-css-v2';
	s.textContent=[
		/* 卡片 */
		'.cbi-section{border-radius:10px!important;box-shadow:0 1px 4px rgba(0,0,0,.06)!important;border:1px solid #e5e7eb!important;margin-bottom:14px!important}',
		'.cbi-section>h3{border-radius:10px 10px 0 0!important;padding:12px 16px!important;font-size:.95em!important;font-weight:700!important;border-bottom:1px solid #f3f4f6!important}',
		/* Tab 容器 */
		'ul.tabs{display:flex!important;gap:0!important;padding:0!important;margin:0 0 14px!important;background:#fff!important;border-radius:0 0 10px 10px!important;box-shadow:0 1px 4px rgba(0,0,0,.06)!important;border:1px solid #e5e7eb!important;border-top:none!important;position:relative!important}',
		/* 顶部渐变条 — 作为 ul.tabs 的 ::before 伪元素 */
		'ul.tabs::before{content:""!important;display:block!important;position:absolute!important;top:-4px!important;left:0!important;right:0!important;height:4px!important;background:linear-gradient(90deg,#c4b5fd,#7c3aed,#4c1d95)!important;border-radius:10px 10px 0 0!important;z-index:1!important}',
		'ul.tabs>li{margin:0!important;border-bottom:none!important;background:transparent!important;border-radius:0!important}',
		'ul.tabs>li>a{display:block!important;padding:10px 18px!important;font-size:.88em!important;font-weight:500!important;color:#6b7280!important;text-decoration:none!important;transition:all .15s!important;border-bottom:2px solid transparent!important;border-radius:0!important;background:transparent!important}',
		'ul.tabs>li>a:hover{color:#7c3aed!important;background:#faf5ff!important;border-bottom-color:#e9d5ff!important}',
		'ul.tabs>li.active,ul.tabs>li[class~="active"]{border-bottom:none!important;background:transparent!important}',
		'ul.tabs>li.active>a,ul.tabs>li[class~="active"]>a{color:#7c3aed!important;border-bottom:2px solid #7c3aed!important;font-weight:600!important;background:#faf5ff!important}',
		/* 按钮 */
		'.cbi-page-actions{display:flex!important;justify-content:flex-end!important;gap:8px!important;padding:14px 0!important;margin-top:14px!important;border-top:1px solid #e5e7eb!important}',
		'.cbi-button-apply{background:#7c3aed!important;color:#fff!important;border:none!important;border-radius:6px!important;padding:8px 20px!important;font-weight:600!important;cursor:pointer!important}',
		'.cbi-button-apply:hover{background:#6d28d9!important}'
	].join('\n');
	document.head.appendChild(s);
})();

/* ── 页面头部组件 ── */
if(!document.getElementById('ec-hdr-css')){var hs=document.createElement('style');hs.id='ec-hdr-css';hs.textContent='.ec-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:14px}.ec-hdr-left h2{margin:0 0 4px;font-size:1.2em;font-weight:700;color:#1f2937}.ec-hdr-left p{margin:0;font-size:.82em;color:#9ca3af}.ec-hdr-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.ec-hdr-top{display:flex;align-items:center;gap:8px}.ec-hdr-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0}.ec-hdr-status{font-size:.82em;font-weight:500;color:#1f2937}.ec-hdr-bottom{display:flex;align-items:center;gap:6px}.ec-hdr-time{font-size:.78em;color:#9ca3af}.ec-hdr-refresh{background:none;border:none;cursor:pointer;font-size:1em;color:#9ca3af;padding:2px;border-radius:4px;transition:all .15s}.ec-hdr-refresh:hover{background:#f3f4f6;color:#374151}';document.head.appendChild(hs)}
function ecMakeHdr(title,subtitle,isRunning){var h=document.createElement('div');h.className='ec-hdr';h.innerHTML='<div class="ec-hdr-left"><h2>'+title+'</h2><p>'+subtitle+'</p></div><div class="ec-hdr-right"><div class="ec-hdr-top"><span class="ec-hdr-dot" style="background:'+(isRunning?'#22c55e':'#ef4444')+'"></span><span class="ec-hdr-status">'+(isRunning?'运行中':'已停止')+'</span></div><div class="ec-hdr-bottom"><span class="ec-hdr-time">最后更新: '+new Date().toLocaleString('zh-CN')+'</span><button class="ec-hdr-refresh" title="刷新">⟳</button></div></div>';h.querySelector('.ec-hdr-refresh').addEventListener('click',function(){window.location.reload()});return h}

/* ── 卡片样式注入 ── */
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
	'.cbi-section .cbi-section-table-row { background:var(--background-color-white, #fff);border:1px solid var(--border-color-light, #eee);border-radius:8px;padding:12px;margin-bottom:8px }',
	'.cbi-button-action { background:var(--background-color-secondary, #f0f0f0);color:var(--text-color, #333);border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-weight:600 }',
	'.cbi-button-action:hover { background:var(--background-color-secondary, #e0e0e0) }',
	'.cbi-button-save { background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-button-save:hover { background:#2563eb }',
	'.cbi-button-reset { background:var(--background-color-secondary, #f0f0f0);color:var(--text-color-secondary, #666);border:none;border-radius:6px;padding:10px 24px;cursor:pointer }',
	'.cbi-button-apply { background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-page-actions { display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:16px;border-top:1px solid var(--border-color-light, #eee);flex-wrap:wrap }',

].join(' ');

var CARD_COLORS = {
	'global': '#3b82f6',
	'openclash': '#f59e0b',
	'health': '#10b981',
	'device': '#8b5cf6',
	'system': '#ef4444',
	'sub': '#06b6d4',
};

var style = document.createElement('style');
style.textContent = CARD_CSS;
document.head.appendChild(style);
		/* 暗夜模式检测（兼容 Argon 主题手动切换） */
		(function(){if(document.cookie.indexOf('argonDarkMode=1')>-1||window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('ec-dark');var s=document.createElement('style');s.textContent='.ec-dark .cbi-section{background:#1e1e2e!important;box-shadow:0 2px 8px rgba(0,0,0,.3)!important;border-top-color:#374151!important}.ec-dark .cbi-section>h3{border-bottom-color:#333!important}.ec-dark .cbi-page-actions{border-top-color:#374151!important}.ec-dark .cbi-map>.cbi-map-descr{color:#9ca3af!important}.ec-dark .cbi-value>.cbi-value-title{color:#d1d5db!important}.ec-dark .cbi-value input[type=text],.ec-dark .cbi-value input[type=password],.ec-dark .cbi-value textarea,.ec-dark .cbi-value select{border-color:#374151!important;background:#1e1e2e!important;color:#e5e7eb!important}.ec-dark .cbi-value .cbi-input-description{color:#9ca3af!important}.ec-dark .cbi-section .cbi-section-table-row{background:#1e1e2e!important;border-color:#374151!important}.ec-dark .cbi-button-action{background:#374151!important;color:#e5e7eb!important}.ec-dark .cbi-button-reset{background:#374151!important;color:#9ca3af!important}';document.head.appendChild(s)})()

function applyCardColors() {
	var sections = document.querySelectorAll('.cbi-section');
	sections.forEach(function(sec) {
		var title = sec.querySelector('h3');
		if (!title) return;
		var text = title.textContent;
		Object.keys(CARD_COLORS).forEach(function(key) {
			if (text.toLowerCase().indexOf(key) !== -1) {
				sec.style.borderTopColor = CARD_COLORS[key];
			}
		});
	});
}

window.addEventListener('load', function() { setTimeout(applyCardColors, 100); });

return view.extend({

	load: function() {
		return Promise.all([
			uci.load('eventcenter')
		]);
	},

	render: function() {
		var m, s, o;

		// 读取服务状态
		var isRunning = uci.get('eventcenter', 'global', 'enable') === '1';

		// --- Main Map ---
		m = new form.Map('eventcenter', '', '');

		// --- Global Settings ---
		s = m.section(form.NamedSection, 'global', 'eventcenter', '全局设置');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用或禁用事件中心服务');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'log_path', '日志路径',
			'事件日志文件路径');
		o.default = '/etc/eventcenter/eventcenter.log';
		o.rmempty = false;

		o = s.option(form.Value, 'log_max_lines', '最大日志行数',
			'超过此行数将自动截断旧日志');
		o.default = '1000';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_ttl', '去重时间窗口(秒)',
			'在此时间窗口内相同事件只通知一次');
		o.default = '300';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_path', '去重缓存路径',
			'去重缓存文件路径');
		o.default = '/tmp/eventcenter_dedup';
		o.rmempty = false;

		o = s.option(form.Value, 'dedup_max', '去重最大条目数',
			'去重缓存最大条目数');
		o.default = '500';
		o.datatype = 'uinteger';
		o.rmempty = false;

		// --- OpenClash Monitor ---
		s = m.section(form.NamedSection, 'openclash', 'monitor', 'OpenClash 订阅监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 OpenClash 订阅配置变更监控');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'定期检查订阅变化的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('3', '3 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.value('60', '1 小时');
		o.value('120', '2 小时');
		o.value('360', '6 小时');
		o.value('720', '12 小时');
		o.value('1440', '24 小时');
		o.default = '5';
		o.rmempty = false;

		o = s.option(form.Flag, 'realtime', '实时监听',
			'inotifywait 监听配置目录，变更后立即推送');
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'debounce', '防抖延迟',
			'配置变更后等待多久再触发检查');
		o.value('3', '3 秒');
		o.value('5', '5 秒');
		o.value('10', '10 秒');
		o.value('15', '15 秒');
		o.value('30', '30 秒');
		o.value('60', '60 秒');
		o.default = '5';
		o.rmempty = false;
		o.depends('realtime', '1');

		o = s.option(form.Value, 'paths', '配置目录',
			'OpenClash 配置文件路径，逗号分隔');
		o.rmempty = true;
		o.placeholder = '/etc/openclash/config';

		// --- Node Health Monitor ---
		s = m.section(form.NamedSection, 'health', 'health', '节点故障转移通知');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用节点故障转移通知');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'健康检查的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('3', '3 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.value('60', '1 小时');
		o.default = '3';
		o.rmempty = false;

		o = s.option(form.Value, 'test_url', '测试 URL',
			'用于延迟测试的 URL');
		o.default = 'https://www.google.com/generate_204';
		o.rmempty = false;

		o = s.option(form.Value, 'timeout', '超时(秒)',
			'单次探测超时时间');
		o.default = '5';
		o.datatype = 'uinteger';
		o.rmempty = false;

		// --- Device Monitor ---
		s = m.section(form.NamedSection, 'device_monitor', 'device_monitor', '设备上下线监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用设备上下线监控');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '扫描间隔',
			'设备扫描的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.default = '2';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'mac', '关注的 MAC 地址',
			'只监控这些设备，留空则监控所有');
		o.rmempty = true;

		// --- System Health Monitor ---
		s = m.section(form.NamedSection, 'system_health', 'system_health', '系统健康监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用系统资源监控');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'interval', '检查间隔',
			'系统健康检查的时间间隔');
		o.value('1', '1 分钟');
		o.value('2', '2 分钟');
		o.value('5', '5 分钟');
		o.value('10', '10 分钟');
		o.value('15', '15 分钟');
		o.value('30', '30 分钟');
		o.default = '5';
		o.rmempty = false;

		// --- Subscription Monitor ---
		s = m.section(form.NamedSection, 'sub', 'monitor', '订阅到期监控');
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enable', '启用',
			'启用 Clash 订阅到期提醒');
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.ListValue, 'check_interval', '检查间隔',
			'多久检查一次订阅状态');
		o.value('1', '每小时');
		o.value('6', '每 6 小时');
		o.value('12', '每 12 小时');
		o.value('24', '每天');
		o.default = '6';
		o.rmempty = false;

		o = s.option(form.ListValue, 'remind_days', '提前提醒天数',
			'到期前几天开始提醒');
		o.value('1', '1 天');
		o.value('3', '3 天');
		o.value('7', '7 天');
		o.value('14', '14 天');
		o.value('30', '30 天');
		o.default = '7';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'sub_names', '关注的订阅',
			'只监控这些订阅，留空则监控所有');

		/* post-render: 插入统一头部 + 折叠 + 保存并重启按钮 */
		return m.render().then(function(node) {
			// 插入统一头部
			node.insertBefore(ecMakeHdr('设置', '配置事件中心监控和通知系统', isRunning), node.firstChild);
			function addRestartBtn(container) {
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
						setTimeout(function() { btn.textContent = '保存并重启'; btn.style.background = '#f59e0b'; btn.style.borderColor = '#f59e0b'; btn.disabled = false; }, 3000);
					}).catch(function() {
						btn.textContent = '✗ 失败';
						btn.style.background = '#dc2626';
						btn.style.borderColor = '#dc2626';
						setTimeout(function() { btn.textContent = '保存并重启'; btn.style.background = '#f59e0b'; btn.style.borderColor = '#f59e0b'; btn.disabled = false; }, 3000);
					});
				});
				container.appendChild(btn);
			}

			/* section 折叠/展开 */
			var sections = node.querySelectorAll('.cbi-section');
			sections.forEach(function(sec, idx) {
				var h3 = sec.querySelector('h3');
				if (!h3) return;
				h3.style.cursor = 'pointer';
				h3.style.userSelect = 'none';
				h3.style.position = 'relative';
				h3.style.paddingRight = '40px';
				var arrow = E('span', { 'style': 'position:absolute;right:16px;top:50%;transform:translateY(-50%);transition:transform .2s;font-size:.8em' }, '▾');
				h3.appendChild(arrow);
				var body = [];
				for (var i = 0; i < sec.children.length; i++) {
					if (sec.children[i] !== h3) body.push(sec.children[i]);
				}
				/* 第一个 section（全局设置）展开，其他折叠 */
				if (idx > 0) {
					body.forEach(function(el) { el.style.display = 'none'; });
					arrow.style.transform = 'translateY(-50%) rotate(-90deg)';
					sec.dataset.collapsed = '1';
				}
				h3.addEventListener('click', function() {
					var isCollapsed = sec.dataset.collapsed === '1';
					body.forEach(function(el) { el.style.display = isCollapsed ? '' : 'none'; });
					arrow.style.transform = isCollapsed ? 'translateY(-50%)' : 'translateY(-50%) rotate(-90deg)';
					sec.dataset.collapsed = isCollapsed ? '0' : '1';
				});
			});

			/* cbi-page-actions 是 cbi-map 的兄弟节点 */
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
	}
});