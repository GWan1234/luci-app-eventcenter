'use strict';
'require view';
'require uci';
'require fs';



/* ── 页面头部组件 ── */
if(!document.getElementById('ec-hdr-css')){var hs=document.createElement('style');hs.id='ec-hdr-css';hs.textContent='.ec-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:14px}.ec-hdr-left h2{margin:0 0 4px;font-size:1.2em;font-weight:700;color:#1f2937}.ec-hdr-left p{margin:0;font-size:.82em;color:#9ca3af}.ec-hdr-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.ec-hdr-top{display:flex;align-items:center;gap:8px}.ec-hdr-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0}.ec-hdr-status{font-size:.82em;font-weight:500;color:#1f2937}.ec-hdr-bottom{display:flex;align-items:center;gap:6px}.ec-hdr-time{font-size:.78em;color:#9ca3af}.ec-hdr-refresh{background:none;border:none;cursor:pointer;font-size:1em;color:#9ca3af;padding:2px;border-radius:4px;transition:all .15s}.ec-hdr-refresh:hover{background:#f3f4f6;color:#374151}';document.head.appendChild(hs)}
function ecMakeHdr(title,subtitle,isRunning){var h=document.createElement('div');h.className='ec-hdr';h.innerHTML='<div class="ec-hdr-left"><h2>'+title+'</h2><p>'+subtitle+'</p></div><div class="ec-hdr-right"><div class="ec-hdr-top"><span class="ec-hdr-dot" style="background:'+(isRunning?'#22c55e':'#ef4444')+'"></span><span class="ec-hdr-status">'+(isRunning?'运行中':'已停止')+'</span></div><div class="ec-hdr-bottom"><span class="ec-hdr-time">最后更新: '+new Date().toLocaleString('zh-CN')+'</span><button class="ec-hdr-refresh" title="刷新">⟳</button></div></div>';h.querySelector('.ec-hdr-refresh').addEventListener('click',function(){window.location.reload()});return h}

/* ── 设置页专属 CSS ── */
;(function(){
	if(document.getElementById('ec-settings-css'))return;
	var s=document.createElement('style');s.id='ec-settings-css';
	s.textContent=[
		'.ec-settings-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:14px}',
		'.ec-settings-card{background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;transition:box-shadow .2s}',
		'.ec-settings-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}',
		'.ec-settings-card.full-width{grid-column:1/-1}',
		'.ec-settings-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f3f4f6;cursor:pointer;user-select:none}',
		'.ec-settings-head-left{display:flex;align-items:center;gap:10px}',
		'.ec-settings-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1em;flex-shrink:0}',
		'.ec-settings-title{font-size:.92em;font-weight:700;color:#1f2937}',
		'.ec-settings-desc{font-size:.75em;color:#9ca3af;margin-top:2px}',
		'.ec-settings-toggle{display:flex;align-items:center;gap:8px}',
		'.ec-settings-status{font-size:.78em;font-weight:500;display:flex;align-items:center;gap:5px}',
		'.ec-settings-status-dot{width:7px;height:7px;border-radius:50%;display:inline-block}',
		'.ec-settings-arrow{font-size:.8em;color:#9ca3af;transition:transform .2s}',
		'.ec-settings-arrow.collapsed{transform:rotate(-90deg)}',
		'.ec-settings-body{padding:16px 18px;display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}',
		'.ec-settings-body.collapsed{display:none}',
		'.ec-field{display:flex;flex-direction:column;gap:5px}',
		'.ec-field.full{grid-column:1/-1}',
		'.ec-field-label{font-size:.8em;font-weight:600;color:#374151}',
		'.ec-field-desc{font-size:.72em;color:#9ca3af}',
		'.ec-field input[type=text],.ec-field input[type=password],.ec-field select{width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:.84em;color:#1f2937;background:#f9fafb;transition:all .15s;box-sizing:border-box}',
		'.ec-field input:focus,.ec-field select:focus{outline:none;border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.1);background:#fff}',
		'.ec-field input[type=checkbox]{width:18px;height:18px;accent-color:#7c3aed;cursor:pointer}',
		'.ec-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0}',
		'.ec-toggle-label{font-size:.84em;color:#374151}',
		'.ec-toggle{width:42px;height:24px;border-radius:12px;background:#d1d5db;position:relative;cursor:pointer;transition:background .2s}',
		'.ec-toggle.on{background:#7c3aed}',
		'.ec-toggle::after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.15)}',
		'.ec-toggle.on::after{transform:translateX(18px)}',
		'.ec-actions-bar{display:flex;justify-content:flex-end;gap:10px;padding:16px 0;margin-top:8px;border-top:1px solid #e5e7eb}'
	].join('\n');
	document.head.appendChild(s);
})();

return view.extend({
	load: function() {
		return uci.load('eventcenter');
	},

	render: function() {
		var isRunning = uci.get('eventcenter', 'global', 'enable') === '1';

		// 读取各模块状态
		function getVal(sec, key) {
			var v = uci.get('eventcenter', sec, key);
			return v !== undefined ? v : '';
		}
		function isEnabled(sec) { return getVal(sec, 'enable') === '1'; }

		var modules = [
			{
				id: 'global', icon: '⚙️', bg: '#eff6ff', color: '#3b82f6',
				title: '全局设置', desc: '服务核心参数',
				fields: [
					{ key: 'enable', label: '启用服务', type: 'toggle', desc: '启用或禁用事件中心服务' },
					{ key: 'log_path', label: '日志路径', type: 'text', def: '/etc/eventcenter/eventcenter.log', desc: '事件日志文件路径' },
					{ key: 'log_max_lines', label: '最大日志行数', type: 'text', def: '1000', desc: '超过此行数将自动截断旧日志' },
					{ key: 'dedup_ttl', label: '去重窗口(秒)', type: 'text', def: '300', desc: '相同事件在此时间内只通知一次' },
					{ key: 'dedup_path', label: '去重缓存路径', type: 'text', def: '/tmp/eventcenter_dedup', desc: '去重缓存文件路径' },
					{ key: 'dedup_max', label: '去重最大条目', type: 'text', def: '500', desc: '去重缓存最大条目数' }
				]
			},
			{
				id: 'openclash', icon: '🔄', bg: '#fff7ed', color: '#f59e0b',
				title: 'OpenClash 监控', desc: '订阅配置变更监控',
				fields: [
					{ key: 'enable', label: '启用监控', type: 'toggle', desc: '启用 OpenClash 订阅配置变更监控' },
					{ key: 'interval', label: '检查间隔', type: 'select', options: [
						['1','1 分钟'],['2','2 分钟'],['3','3 分钟'],['5','5 分钟'],['10','10 分钟'],['15','15 分钟'],['30','30 分钟'],['60','1 小时']
					], def: '5', desc: '定期检查订阅变化的时间间隔' },
					{ key: 'realtime', label: '实时监听', type: 'toggle', desc: 'inotifywait 监听配置目录，变更后立即推送' },
					{ key: 'debounce', label: '防抖延迟', type: 'select', options: [
						['3','3 秒'],['5','5 秒'],['10','10 秒'],['15','15 秒'],['30','30 秒'],['60','60 秒']
					], def: '5', desc: '配置变更后等待多久再触发检查' },
					{ key: 'paths', label: '配置目录', type: 'text', def: '/etc/openclash/config', desc: 'OpenClash 配置文件路径，逗号分隔', full: true }
				]
			},
			{
				id: 'health', icon: '💓', bg: '#f0fdf4', color: '#22c55e',
				title: '节点故障转移', desc: '节点健康检查与故障转移通知',
				fields: [
					{ key: 'enable', label: '启用监控', type: 'toggle', desc: '启用节点故障转移通知' },
					{ key: 'interval', label: '检查间隔', type: 'select', options: [
						['1','1 分钟'],['2','2 分钟'],['3','3 分钟'],['5','5 分钟'],['10','10 分钟'],['15','15 分钟'],['30','30 分钟'],['60','1 小时']
					], def: '3', desc: '健康检查的时间间隔' },
					{ key: 'test_url', label: '测试 URL', type: 'text', def: 'https://www.google.com/generate_204', desc: '用于延迟测试的 URL', full: true },
					{ key: 'timeout', label: '超时(秒)', type: 'text', def: '5', desc: '单次探测超时时间' }
				]
			},
			{
				id: 'device_monitor', icon: '📱', bg: '#faf5ff', color: '#8b5cf6',
				title: '设备监控', desc: '设备上下线监控',
				fields: [
					{ key: 'enable', label: '启用监控', type: 'toggle', desc: '启用设备上下线监控' },
					{ key: 'interval', label: '扫描间隔', type: 'select', options: [
						['1','1 分钟'],['2','2 分钟'],['5','5 分钟'],['10','10 分钟']
					], def: '2', desc: '设备扫描的时间间隔' },
					{ key: 'mac', label: '关注的 MAC', type: 'text', def: '', desc: '只监控这些设备，留空则监控所有', full: true }
				]
			},
			{
				id: 'system_health', icon: '📊', bg: '#fef2f2', color: '#ef4444',
				title: '系统健康监控', desc: 'CPU/内存/温度监控',
				fields: [
					{ key: 'enable', label: '启用监控', type: 'toggle', desc: '启用系统资源监控' },
					{ key: 'interval', label: '检查间隔', type: 'select', options: [
						['1','1 分钟'],['2','2 分钟'],['5','5 分钟'],['10','10 分钟'],['15','15 分钟'],['30','30 分钟']
					], def: '5', desc: '系统健康检查的时间间隔' }
				]
			},
			{
				id: 'sub', icon: '📦', bg: '#ecfdf5', color: '#06b6d4',
				title: '订阅到期监控', desc: 'Clash 订阅到期提醒',
				fields: [
					{ key: 'enable', label: '启用监控', type: 'toggle', desc: '启用 Clash 订阅到期提醒' },
					{ key: 'check_interval', label: '检查间隔', type: 'select', options: [
						['1','每小时'],['6','每 6 小时'],['12','每 12 小时'],['24','每天']
					], def: '6', desc: '多久检查一次订阅状态' },
					{ key: 'remind_days', label: '提前提醒', type: 'select', options: [
						['1','1 天'],['3','3 天'],['7','7 天'],['14','14 天'],['30','30 天']
					], def: '7', desc: '到期前几天开始提醒' },
					{ key: 'sub_names', label: '关注的订阅', type: 'text', def: '', desc: '只监控这些订阅，留空则监控所有', full: true }
				]
			}
		];

		// 本地值存储（用于保存）
		var localValues = {};

		function buildField(field, moduleId) {
			var storageKey = moduleId + '.' + field.key;
			var val = getVal(moduleId, field.key);
			if (localValues[storageKey] !== undefined) val = localValues[storageKey];

			var wrapper = E('div', { 'class': 'ec-field' + (field.full ? ' full' : '') });

			if (field.type === 'toggle') {
				var isOn = val === '1';
				var row = E('div', { 'class': 'ec-toggle-row' }, [
					E('span', { 'class': 'ec-toggle-label' }, [field.label])
				]);
				var toggle = E('div', { 'class': 'ec-toggle' + (isOn ? ' on' : '') });
				toggle.addEventListener('click', function() {
					var currentlyOn = this.classList.contains('on');
					this.classList.toggle('on');
					localValues[storageKey] = currentlyOn ? '0' : '1';
				});
				row.appendChild(toggle);
				wrapper.appendChild(row);
				if (field.desc) wrapper.appendChild(E('div', { 'class': 'ec-field-desc' }, field.desc));
			} else if (field.type === 'select') {
				wrapper.appendChild(E('label', { 'class': 'ec-field-label' }, field.label));
				var sel = E('select');
				(field.options || []).forEach(function(opt) {
					var o = E('option', { 'value': opt[0] }, opt[1]);
					if (opt[0] === (val || field.def)) o.selected = true;
					sel.appendChild(o);
				});
				sel.addEventListener('change', function() { localValues[storageKey] = this.value; });
				wrapper.appendChild(sel);
				if (field.desc) wrapper.appendChild(E('div', { 'class': 'ec-field-desc' }, field.desc));
			} else {
				wrapper.appendChild(E('label', { 'class': 'ec-field-label' }, field.label));
				var inp = E('input', {
					'type': 'text',
					'value': val || field.def || '',
					'placeholder': field.def || ''
				});
				inp.addEventListener('input', function() { localValues[storageKey] = this.value; });
				wrapper.appendChild(inp);
				if (field.desc) wrapper.appendChild(E('div', { 'class': 'ec-field-desc' }, field.desc));
			}
			return wrapper;
		}

		function buildModuleCard(mod, idx) {
			var modEnabled = isEnabled(mod.id);

			var headLeft = E('div', { 'class': 'ec-settings-head-left' }, [
				E('div', { 'class': 'ec-settings-icon', style: 'background:' + mod.bg + ';color:' + mod.color }, mod.icon),
				E('div', {}, [
					E('div', { 'class': 'ec-settings-title' }, mod.title),
					E('div', { 'class': 'ec-settings-desc' }, mod.desc)
				])
			]);

			var statusDot = E('span', { 'class': 'ec-settings-status-dot', style: 'background:' + (modEnabled ? '#22c55e' : '#d1d5db') });
			var statusText = E('span', { 'class': 'ec-settings-status' }, [statusDot, modEnabled ? '已启用' : '未启用']);
			var arrow = E('span', { 'class': 'ec-settings-arrow' + (idx > 0 ? ' collapsed' : '') }, '▾');

			var head = E('div', { 'class': 'ec-settings-head' }, [headLeft, E('div', { 'class': 'ec-settings-toggle' }, [statusText, arrow])]);

			var body = E('div', { 'class': 'ec-settings-body' + (idx > 0 ? ' collapsed' : '') });
			mod.fields.forEach(function(f) {
				body.appendChild(buildField(f, mod.id));
			});

			// 折叠/展开
			var card = E('div', { 'class': 'ec-settings-card' + (mod.id === 'global' ? ' full-width' : '') }, [head, body]);
			head.addEventListener('click', function() {
				var isCollapsed = body.classList.contains('collapsed');
				body.classList.toggle('collapsed');
				arrow.classList.toggle('collapsed');
			});

			return card;
		}

		// 构建卡片网格
		var grid = E('div', { 'class': 'ec-settings-grid' });
		modules.forEach(function(mod, idx) {
			grid.appendChild(buildModuleCard(mod, idx));
		});

		// 操作栏（标准 LuCI 按钮）
		var saveBtn = E('button', { 'class': 'cbi-button cbi-button-save' }, '保存');
		var applyBtn = E('button', { 'class': 'cbi-button cbi-button-apply' }, '保存并应用');
		var resetBtn = E('button', { 'class': 'cbi-button cbi-button-reset' }, '复位');

		saveBtn.addEventListener('click', function() {
			// 应用本地值到 UCI
			Object.keys(localValues).forEach(function(key) {
				var parts = key.split('.');
				uci.set('eventcenter', parts[0], parts[1], localValues[key]);
			});
			saveBtn.textContent = '保存中...';
			saveBtn.disabled = true;
			uci.save().then(function() { return uci.apply(); }).then(function() {
				saveBtn.textContent = '✓ 已保存';
				saveBtn.style.background = '#22c55e';
				setTimeout(function() { saveBtn.textContent = '保存'; saveBtn.style.background = ''; saveBtn.disabled = false; }, 2000);
			}).catch(function() {
				saveBtn.textContent = '✗ 失败';
				saveBtn.style.background = '#dc2626';
				setTimeout(function() { saveBtn.textContent = '保存'; saveBtn.style.background = ''; saveBtn.disabled = false; }, 2000);
			});
		});

		applyBtn.addEventListener('click', function() {
			// 先保存再重启
			Object.keys(localValues).forEach(function(key) {
				var parts = key.split('.');
				uci.set('eventcenter', parts[0], parts[1], localValues[key]);
			});
			applyBtn.textContent = '保存中...';
			applyBtn.disabled = true;
			uci.save().then(function() { return uci.apply(); }).then(function() {
				applyBtn.textContent = '重启中...';
				return fs.exec('/etc/init.d/eventcenter', ['restart']);
			}).then(function(res) {
				applyBtn.textContent = (res && res.code === 0) ? '✓ 已完成' : '✓ 已保存';
				applyBtn.style.background = '#22c55e';
				setTimeout(function() { applyBtn.textContent = '保存并应用'; applyBtn.style.background = ''; applyBtn.disabled = false; }, 3000);
			}).catch(function() {
				applyBtn.textContent = '✗ 失败';
				applyBtn.style.background = '#dc2626';
				setTimeout(function() { applyBtn.textContent = '保存并应用'; applyBtn.style.background = ''; applyBtn.disabled = false; }, 3000);
			});
		});

		resetBtn.addEventListener('click', function() {
			window.location.reload();
		});

		var actionsBar = E('div', { 'class': 'ec-actions-bar' }, [resetBtn, saveBtn, applyBtn]);

		// 组装页面
		var container = E('div', {}, [
			ecMakeHdr('设置', '配置事件中心监控和通知系统', isRunning),
			grid,
			actionsBar,
			E('div',{'class':'ec-footer'},'EventCenter v1.0.0 | 让每一次事件，都被及时发现和处理')
		]);

		return container;
	}
});
