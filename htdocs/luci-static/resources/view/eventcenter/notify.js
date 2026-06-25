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
	'.ec-test-btn { padding:6px 16px;border:1px solid #3b82f6;color:#3b82f6;background:transparent;border-radius:8px;font-size:.85em;cursor:pointer;font-weight:500;margin-top:8px }',
	'.ec-test-btn:hover { background:rgba(59,130,246,0.1) }',
	'.ec-test-btn:disabled { opacity:0.6;cursor:not-allowed }',
	'@media (prefers-color-scheme: dark) {',
	'  .cbi-section { background:var(--background-color-white, #1e1e2e);box-shadow:0 2px 8px rgba(0,0,0,.3) }',
	'  .cbi-section > h3 { border-bottom-color:var(--border-color-light, #333) }',
	'}'
].join(' ');
var st = document.createElement('style'); st.textContent = CARD_CSS; document.head.appendChild(st);

var BORDER_COLORS = {
	'telegram': '#0088cc', 'ntfy': '#4caf50', 'wechat': '#07c160',
	'bark': '#ff6b6b', 'pushplus': '#ff9800', 'discord': '#5865f2', 'email': '#ea4335'
};

/* 通知脚本路径映射 */
var SCRIPT_MAP = {
	'telegram': '/usr/share/eventcenter/notifiers/telegram.sh',
	'ntfy': '/usr/share/eventcenter/notifiers/ntfy.sh',
	'wechat': '/usr/share/eventcenter/notifiers/wechat.sh',
	'bark': '/usr/share/eventcenter/notifiers/bark.sh',
	'pushplus': '/usr/share/eventcenter/notifiers/pushplus.sh',
	'discord': '/usr/share/eventcenter/notifiers/discord.sh',
	'email': '/usr/share/eventcenter/notifiers/email.sh'
};

return view.extend({
	load: function() {
		return Promise.all([uci.load('eventcenter')]);
	},

	render: function() {
		var m, s, o;
		m = new form.Map('eventcenter', '通知渠道', '配置消息推送渠道，可同时启用多个。');

		/* Telegram */
		s = m.section(form.NamedSection, 'telegram', 'notify', '✈️ Telegram');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用', '启用 Telegram Bot 推送');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'token', 'Bot Token', '从 @BotFather 获取');
		o.placeholder = '123456:ABC-DEF...'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'chatid', 'Chat ID', '接收消息的 Chat ID');
		o.placeholder = '123456789'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.ListValue, 'parse_mode', '消息格式');
		o.value('HTML'); o.value('Markdown'); o.default = 'HTML'; o.depends('enable', '1'); o.rmempty = false;

		/* Ntfy */
		s = m.section(form.NamedSection, 'ntfy', 'notify', '🔔 Ntfy');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用', '启用 Ntfy 自托管推送');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'url', '服务器地址');
		o.placeholder = 'https://ntfy.sh'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'topic', 'Topic');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'user', '用户名');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'pass', '密码');
		o.password = true; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'token', 'Access Token', 'Bearer Token 认证（优先于用户名密码）');
		o.password = true; o.depends('enable', '1'); o.rmempty = true;

		/* 企业微信 */
		s = m.section(form.NamedSection, 'wechat', 'notify', '💬 企业微信');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'webhook', 'Webhook URL');
		o.depends('enable', '1'); o.rmempty = true;

		/* Bark */
		s = m.section(form.NamedSection, 'bark', 'notify', '🔔 Bark');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'server', '服务器地址');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'device_key', 'Device Key');
		o.depends('enable', '1'); o.rmempty = true;

		/* PushPlus */
		s = m.section(form.NamedSection, 'pushplus', 'notify', '📨 PushPlus');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'token', 'Token');
		o.depends('enable', '1'); o.rmempty = true;

		/* Discord */
		s = m.section(form.NamedSection, 'discord', 'notify', '🎮 Discord');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'webhook', 'Webhook URL');
		o.depends('enable', '1'); o.rmempty = true;

		/* Email */
		s = m.section(form.NamedSection, 'email', 'notify', '📧 Email');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'smtp_server', 'SMTP 服务器');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'smtp_port', '端口');
		o.datatype = 'port'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'smtp_user', '发件人');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'to', '收件人');
		o.depends('enable', '1'); o.rmempty = true;

		return m.render().then(function(node) {
			/* 为每个 section 添加边框色和测试按钮 */
			var sections = node.querySelectorAll('.cbi-section');
			var channelMap = {
				'Telegram': 'telegram', 'Ntfy': 'ntfy', '企业微信': 'wechat',
				'Bark': 'bark', 'PushPlus': 'pushplus', 'Discord': 'discord', 'Email': 'email'
			};

			sections.forEach(function(sec) {
				var title = sec.querySelector('h3');
				if (!title) return;
				var text = title.textContent;
				Object.keys(channelMap).forEach(function(key) {
					if (text.indexOf(key) !== -1) {
						sec.style.borderTopColor = BORDER_COLORS[channelMap[key]] || '#6b7280';

						var btn = E('button', { 'class': 'ec-test-btn' }, '发送测试');
						btn.addEventListener('click', function() {
							var el = this;
							var origText = el.textContent;
							el.textContent = '测试中...'; el.disabled = true;
							var scriptPath = SCRIPT_MAP[channelMap[key]];
							if (!scriptPath) {
								el.textContent = '✗ 无脚本';
								setTimeout(function() { el.textContent = origText; el.disabled = false; }, 2000);
								return;
							}
							fs.exec(scriptPath, ['测试消息：EventCenter 测试通知']).then(function(res) {
								if (res.code === 0) {
									el.textContent = '✓ 已发送';
									el.style.borderColor = '#22c55e'; el.style.color = '#22c55e';
								} else {
									el.textContent = '✗ 失败';
									el.style.borderColor = '#dc2626'; el.style.color = '#dc2626';
								}
								setTimeout(function() {
									el.textContent = origText;
									el.style.borderColor = '#3b82f6'; el.style.color = '#3b82f6';
									el.disabled = false;
								}, 2000);
							});
						});
						sec.appendChild(btn);
					}
				});
			});

			/* 追加保存并重启按钮 */
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
