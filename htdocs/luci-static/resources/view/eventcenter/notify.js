'use strict';
'require view';
'require form';
'require fs';
'require uci';

var CARD_CSS = [
	'.cbi-map { padding:0 !important }',
	'.cbi-map > h2 { margin-bottom:4px }',
	'.cbi-map > .cbi-map-descr { color:#666;font-size:0.9em;margin-bottom:20px }',
	'.cbi-section { background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;margin-bottom:16px;border-top:3px solid #6b7280 }',
	'.cbi-section > h3 { border-bottom:1px solid #eee;padding-bottom:12px;margin:-20px -20px 16px -20px;padding:16px 20px 12px;font-size:1.05em;font-weight:700 }',
	'.cbi-value { margin-bottom:10px }',
	'.cbi-value > .cbi-value-title { font-weight:600;font-size:0.85em;color:#555;margin-bottom:4px }',
	'.cbi-value input[type=text], .cbi-value input[type=password], .cbi-value textarea, .cbi-value select { border:1px solid #ddd;border-radius:6px;padding:8px 10px }',
	'.cbi-value input:focus, .cbi-value select:focus { border-color:#3b82f6;outline:none;box-shadow:0 0 0 2px rgba(59,130,246,0.15) }',
	'.cbi-value .cbi-input-description { font-size:0.75em;color:#888;margin-top:4px }',
	'.cbi-button-save { background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-button-apply { background:#f59e0b;color:#fff;border:none;border-radius:6px;padding:10px 24px;cursor:pointer;font-weight:600 }',
	'.cbi-page-actions { display:flex;justify-content:flex-end;gap:8px;padding:16px 0;margin-top:20px;border-top:1px solid #eee }',
	'.ec-test-btn { padding:6px 16px;border:1px solid #3b82f6;color:#3b82f6;background:#eff6ff;border-radius:8px;font-size:.85em;cursor:pointer;font-weight:500;margin-top:8px }',
	'.ec-test-btn:hover { background:#dbeafe }',
	'.ec-test-btn:disabled { opacity:0.6;cursor:not-allowed }',
].join(' ');
var st = document.createElement('style'); st.textContent = CARD_CSS; document.head.appendChild(st);

var BORDER_COLORS = {
	'telegram': '#0088cc',
	'ntfy': '#4caf50',
	'wechat': '#07c160',
	'bark': '#ff6b6b',
	'pushplus': '#ff9800',
	'discord': '#5865f2',
	'email': '#ea4335'
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
		o = s.option(form.Value, 'url', '服务器地址', 'Ntfy 服务器 URL');
		o.placeholder = 'https://ntfy.sh'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'topic', 'Topic', '消息主题');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'user', '用户名', '留空则无需认证');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'pass', '密码', '认证密码');
		o.password = true; o.depends('enable', '1'); o.rmempty = true;

		/* 企业微信 */
		s = m.section(form.NamedSection, 'wechat', 'notify', '💬 企业微信');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'webhook', 'Webhook URL');
		o.placeholder = 'https://qyapi.weixin.qq.com/...'; o.depends('enable', '1'); o.rmempty = true;

		/* Bark */
		s = m.section(form.NamedSection, 'bark', 'notify', '🔔 Bark');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'server', '服务器地址');
		o.placeholder = 'https://api.day.app'; o.depends('enable', '1'); o.rmempty = true;
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
		o.placeholder = 'https://discord.com/api/webhooks/...'; o.depends('enable', '1'); o.rmempty = true;

		/* Email */
		s = m.section(form.NamedSection, 'email', 'notify', '📧 Email');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'smtp_server', 'SMTP 服务器');
		o.placeholder = 'smtp.gmail.com'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'smtp_port', '端口');
		o.placeholder = '587'; o.datatype = 'port'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'smtp_user', '发件人');
		o.placeholder = 'your@email.com'; o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'to', '收件人');
		o.placeholder = 'recipient@email.com'; o.depends('enable', '1'); o.rmempty = true;

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

						/* 添加测试按钮 */
						var btn = E('button', { 'class': 'ec-test-btn' }, '发送测试');
						btn.addEventListener('click', function() {
							var el = this;
							el.textContent = '测试中...'; el.disabled = true;
							fs.exec('/usr/share/eventcenter/notifier_' + channelMap[key] + '.sh', ['test']).then(function(res) {
								if (res.code === 0) {
									el.textContent = '✓ 已发送';
									el.style.borderColor = '#22c55e'; el.style.color = '#22c55e'; el.style.background = '#d1fae5';
								} else {
									el.textContent = '✗ 失败';
									el.style.borderColor = '#dc2626'; el.style.color = '#dc2626'; el.style.background = '#fee2e2';
								}
								setTimeout(function() {
									el.textContent = '发送测试';
									el.style.borderColor = '#3b82f6'; el.style.color = '#3b82f6'; el.style.background = '#eff6ff';
									el.disabled = false;
								}, 2000);
							});
						});
						sec.appendChild(btn);
					}
				});
			});

			/* 追加保存并重启按钮 */
			var pageActions = node.parentElement ? node.parentElement.querySelector('.cbi-page-actions') : null;
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
