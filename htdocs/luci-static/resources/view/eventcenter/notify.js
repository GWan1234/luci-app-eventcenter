'use strict';
'require view';
'require form';
'require fs';
'require uci';
'require view.eventcenter.common as ec';

var PAGE_CSS = [
	'.ec-test-btn { padding:6px 16px;border:1px solid #3b82f6;color:#3b82f6;background:transparent;border-radius:8px;font-size:.85em;cursor:pointer;font-weight:500;margin-top:8px }',
	'.ec-test-btn:hover { background:rgba(59,130,246,0.1) }',
	'.ec-test-btn:disabled { opacity:0.6;cursor:not-allowed }'
].join(' ');

ec.injectCSS(ec.FORM_CSS);
ec.injectCSS(PAGE_CSS);

var BORDER_COLORS = {
	'telegram': '#0088cc', 'ntfy': '#4caf50', 'wechat': '#07c160',
	'bark': '#ff6b6b', 'pushplus': '#ff9800',
	'serverchan': '#e74c3c', 'serverchan3': '#9b59b6'
};

var SCRIPT_MAP = {
	'telegram': '/usr/bin/notifier_telegram.sh',
	'ntfy': '/usr/bin/notifier_ntfy.sh',
	'wechat': '/usr/bin/notifier_wechat.sh',
	'bark': '/usr/bin/notifier_bark.sh',
	'pushplus': '/usr/bin/notifier_pushplus.sh',
	'serverchan': '/usr/bin/notifier_serverchan.sh',
	'serverchan3': '/usr/bin/notifier_serverchan3.sh'
};

return view.extend({
	load: function() {
		return Promise.all([uci.load('eventcenter')]);
	},

	render: function() {
		var m, s, o;
		m = new form.Map('eventcenter', '通知渠道', '配置消息推送渠道，可同时启用多个。');

		/* Telegram */
		s = m.section(form.NamedSection, 'telegram', 'notifier', '✈️ Telegram');
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
		s = m.section(form.NamedSection, 'ntfy', 'notifier', '🔔 Ntfy');
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
		s = m.section(form.NamedSection, 'wechat', 'notifier', '💬 企业微信');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'webhook', 'Webhook URL');
		o.depends('enable', '1'); o.rmempty = true;

		/* Bark */
		s = m.section(form.NamedSection, 'bark', 'notifier', '🔔 Bark');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'server', '服务器地址');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'device_key', 'Device Key');
		o.depends('enable', '1'); o.rmempty = true;

		/* PushPlus */
		s = m.section(form.NamedSection, 'pushplus', 'notifier', '📨 PushPlus');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'token', 'Token');
		o.depends('enable', '1'); o.rmempty = true;

		/* Server酱 */
		s = m.section(form.NamedSection, 'serverchan', 'notifier', '📮 Server酱');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'sendkey', 'SendKey');
		o.depends('enable', '1'); o.rmempty = true;

		/* Server酱³ */
		s = m.section(form.NamedSection, 'serverchan3', 'notifier', '📮 Server酱³');
		s.addremove = false; s.anonymous = false;
		o = s.option(form.Flag, 'enable', '启用');
		o.default = '0'; o.rmempty = false;
		o = s.option(form.Value, 'sendkey', 'SendKey');
		o.depends('enable', '1'); o.rmempty = true;
		o = s.option(form.Value, 'title', '消息标题');
		o.depends('enable', '1'); o.rmempty = true;

		return m.render().then(function(node) {
			/* 为每个 section 添加边框色和测试按钮 */
			var sections = node.querySelectorAll('.cbi-section');
			var channelMap = {
				'Telegram': 'telegram', 'Ntfy': 'ntfy', '企业微信': 'wechat',
				'Bark': 'bark', 'PushPlus': 'pushplus',
				'Server酱³': 'serverchan3', 'Server酱': 'serverchan'
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
			var restartBtn = ec.createSaveRestartBtn(fs, uci);
			var pageActions = node.parentElement ? node.parentElement.querySelector('.cbi-page-actions') : null;
			if (pageActions) {
				pageActions.appendChild(restartBtn);
			} else {
				setTimeout(function() {
					var pa = document.querySelector('.cbi-page-actions');
					if (pa) pa.appendChild(restartBtn);
				}, 200);
			}
			return node;
		});
	},
});
