'use strict';
'require view';
'require form';
'require fs';
'require uci';

/* ── 样式常量 ── */
var cardBase = 'background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);padding:20px;min-width:300px;flex:1 1 340px;max-width:480px;display:flex;flex-direction:column;gap:12px;transition:opacity 0.2s';
var headerStyle = 'display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid #eee;cursor:pointer;user-select:none';
var labelStyle = 'font-size:0.85em;color:#555;font-weight:600;margin-bottom:2px';
var inputStyle = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:0.9em;box-sizing:border-box';
var selectStyle = inputStyle;
var btnStyle = 'padding:8px 16px;border:none;border-radius:6px;font-size:0.85em;cursor:pointer;font-weight:600';
var descStyle = 'font-size:0.75em;color:#888;margin-top:2px';

function makeField(label, input, desc) {
	var el = E('div', { 'style': 'display:flex;flex-direction:column' }, [
		E('div', { 'style': labelStyle }, label),
		input
	]);
	if (desc) el.appendChild(E('div', { 'style': descStyle }, desc));
	return el;
}

function makeSelect(id, options, current, onchange) {
	var sel = E('select', { 'id': id, 'style': selectStyle, 'change': onchange });
	options.forEach(function(o) {
		var opt = E('option', { 'value': o[0] }, o[1]);
		if (o[0] === current) opt.selected = true;
		sel.appendChild(opt);
	});
	return sel;
}

function makeInput(id, value, placeholder, type) {
	return E('input', {
		'id': id,
		'type': type || 'text',
		'value': value || '',
		'placeholder': placeholder || '',
		'style': inputStyle
	});
}

function statusDot(enabled) {
	return E('span', {
		'style': 'display:inline-block;width:10px;height:10px;border-radius:50%;background:' + (enabled ? '#22c55e' : '#d1d5db')
	});
}

function loadCfg(section, key, def) {
	return uci.get('eventcenter', section, key) || def || '';
}

function saveCfg(section, key, val) {
	uci.set('eventcenter', section, key, val);
}

function testBtn(label, cmd, args) {
	var btn = E('button', {
		'class': 'btn',
		'style': btnStyle + 'background:#f0f0f0;color:#333;margin-top:4px',
		'click': function(ev) {
			ev.stopPropagation();
			btn.textContent = '发送中…';
			btn.disabled = true;
			fs.exec(cmd, args).then(function(res) {
				if (res && res.code !== undefined && res.code !== 0) {
					btn.textContent = '✗ 失败';
					btn.style.background = '#fef2f2';
					btn.style.color = '#dc2626';
				} else {
					btn.textContent = '✓ 已发送';
					btn.style.background = '#dcfce7';
					btn.style.color = '#16a34a';
				}
				setTimeout(function() { btn.textContent = label; btn.style.background = '#f0f0f0'; btn.style.color = '#333'; btn.disabled = false; }, 2500);
			}).catch(function() {
				btn.textContent = '✗ 失败';
				btn.style.background = '#fef2f2';
				btn.style.color = '#dc2626';
				setTimeout(function() { btn.textContent = label; btn.style.background = '#f0f0f0'; btn.style.color = '#333'; btn.disabled = false; }, 2500);
			});
		}
	}, label);
	return btn;
}

/* ── 构建单个通知渠道卡片 ── */
function buildCard(cfg) {
	var enabled = loadCfg(cfg.section, 'enable', '0') === '1';
	var fieldsId = cfg.section + '-fields';
	var enableId = cfg.section + '-enable';

	/* 启用开关 */
	var enableToggle = E('label', { 'style': 'display:flex;align-items:center;gap:8px;cursor:pointer' }, [
		E('input', { 'id': enableId, 'type': 'checkbox', 'checked': enabled ? true : undefined, 'change': function() {
			var on = document.getElementById(enableId).checked;
			var fields = document.getElementById(fieldsId);
			fields.style.opacity = on ? '1' : '0.5';
			fields.style.pointerEvents = on ? '' : 'none';
			/* 更新状态指示 */
			var dot = card.querySelector('.status-dot');
			var txt = card.querySelector('.status-txt');
			if (dot) dot.style.background = on ? '#22c55e' : '#d1d5db';
			if (txt) { txt.textContent = on ? '已启用' : '未启用'; txt.style.color = on ? '#22c55e' : '#9ca3af'; }
		}}),
		E('span', { 'style': 'font-size:0.9em' }, cfg.enableLabel || '启用')
	]);

	/* 字段列表 */
	var fieldEls = [makeField('启用', enableToggle)];
	cfg.fields.forEach(function(f) {
		fieldEls.push(makeField(f.label, f.input, f.desc));
	});
	if (cfg.testCmd) {
		fieldEls.push(testBtn('发送测试', cfg.testCmd, cfg.testArgs || []));
	}

	var fieldsDiv = E('div', {
		'id': fieldsId,
		'style': 'display:flex;flex-direction:column;gap:10px;' + (enabled ? '' : 'opacity:0.5;pointer-events:none')
	}, fieldEls);

	/* 卡片头部（点击折叠/展开） */
	var bodyId = cfg.section + '-body';
	var header = E('div', { 'style': headerStyle, 'click': function() {
		var body = document.getElementById(bodyId);
		body.style.display = body.style.display === 'none' ? '' : 'none';
	}}, [
		E('span', { 'style': 'font-size:1.4em' }, cfg.icon),
		E('div', {}, [
			E('div', { 'style': 'font-weight:700;font-size:1.05em' }, cfg.title),
			E('div', { 'style': 'font-size:0.75em;color:#888' }, cfg.subtitle)
		]),
		E('div', { 'style': 'margin-left:auto;display:flex;align-items:center;gap:6px' }, [
			statusDot(enabled).addClass ? statusDot(enabled) : statusDot(enabled),
			E('span', { 'class': 'status-txt', 'style': 'font-size:0.8em;color:' + (enabled ? '#22c55e' : '#9ca3af') }, enabled ? '已启用' : '未启用')
		])
	]);

	/* 修正 statusDot 的 class */
	var dot = header.querySelector('span');
	if (dot) dot.className = 'status-dot';

	var card = E('div', { 'style': cardBase + ';border-top:3px solid ' + cfg.color }, [
		header,
		E('div', { 'id': bodyId }, [fieldsDiv])
	]);

	return card;
}

/* ── 渠道定义 ── */
var channels = [
	{
		section: 'telegram',
		icon: '✈️',
		title: 'Telegram',
		subtitle: 'Bot API 推送',
		color: '#0088cc',
		enableLabel: '开启 Telegram 推送',
		testCmd: 'eventcenter',
		testArgs: ['test'],
		fields: [
			{ label: 'Bot Token', input: makeInput('tg-token', loadCfg('telegram', 'token'), '123456:ABC-DEF...', 'password'), desc: '从 @BotFather 获取' },
			{ label: 'Chat ID', input: makeInput('tg-chatid', loadCfg('telegram', 'chatid'), '649586363'), desc: '发送目标的聊天 ID' },
			{ label: '解析模式', input: makeSelect('tg-parse', [['Markdown', 'Markdown'], ['HTML', 'HTML']], loadCfg('telegram', 'parse_mode', 'Markdown')) }
		]
	},
	{
		section: 'ntfy',
		icon: '📢',
		title: 'ntfy',
		subtitle: '自建推送服务',
		color: '#2563eb',
		enableLabel: '开启 ntfy 推送',
		testCmd: 'notifier_ntfy.sh',
		testArgs: ['ntfy 测试消息 - Event Center'],
		fields: [
			{ label: '服务器地址', input: makeInput('ntfy-url', loadCfg('ntfy', 'url', 'https://ntfy.sh'), 'http://192.168.100.100:2586'), desc: '自建或公共 ntfy 服务地址' },
			{ label: 'Topic', input: makeInput('ntfy-topic', loadCfg('ntfy', 'topic'), 'my-router-events'), desc: '推送主题，客户端需订阅此主题' },
			{ label: 'Access Token', input: makeInput('ntfy-token', loadCfg('ntfy', 'token'), '', 'password'), desc: '访问令牌（优先于用户名密码）' },
			{ label: '用户名', input: makeInput('ntfy-user', loadCfg('ntfy', 'user'), 'admin'), desc: 'HTTP Basic Auth 用户名' },
			{ label: '密码', input: makeInput('ntfy-pass', loadCfg('ntfy', 'pass'), '', 'password'), desc: 'HTTP Basic Auth 密码' },
			{ label: '优先级', input: makeSelect('ntfy-priority', [
				['min', '最低'], ['low', '低'], ['default', '默认'], ['high', '高'], ['urgent', '紧急']
			], loadCfg('ntfy', 'priority', 'default')) }
		]
	},
	{
		section: 'wechat',
		icon: '💬',
		title: '企业微信',
		subtitle: '群机器人 Webhook',
		color: '#07c160',
		enableLabel: '开启企业微信推送',
		testCmd: 'notifier_wechat.sh',
		testArgs: ['企业微信测试消息 - Event Center'],
		fields: [
			{ label: 'Webhook URL', input: makeInput('wx-webhook', loadCfg('wechat', 'webhook'), 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...'), desc: '企业微信群机器人 Webhook 地址' },
			{ label: '@成员', input: makeInput('wx-mention', loadCfg('wechat', 'mention'), 'zhangsan|lisi'), desc: '需要 @ 的成员 Userid，多个用 | 分隔' }
		]
	},
	{
		section: 'bark',
		icon: '🔔',
		title: 'Bark',
		subtitle: 'iOS 推送',
		color: '#f59e0b',
		enableLabel: '开启 Bark 推送',
		testCmd: 'notifier_bark.sh',
		testArgs: ['Bark 测试消息 - Event Center'],
		fields: [
			{ label: '服务器地址', input: makeInput('bark-server', loadCfg('bark', 'server', 'https://api.day.app'), 'https://api.day.app'), desc: '自建服务填你自己的地址' },
			{ label: 'Device Key', input: makeInput('bark-key', loadCfg('bark', 'device_key'), '', 'password'), desc: 'Bark App 中的设备 Key' },
			{ label: '推送铃声', input: makeSelect('bark-sound', [
				['minuet', 'minuet (默认)'], ['healthnote', 'healthnote'], ['alarm', 'alarm'],
				['antic', 'antic'], ['bell', 'bell'], ['birdsong', 'birdsong'],
				['bubble', 'bubble'], ['calypso', 'calypso'], ['chime', 'chime'], ['shake', 'shake']
			], loadCfg('bark', 'sound', 'minuet')) },
			{ label: '消息分组', input: makeInput('bark-group', loadCfg('bark', 'group', 'EventCenter'), 'EventCenter') }
		]
	},
	{
		section: 'serverchan',
		icon: '📨',
		title: 'Server酱',
		subtitle: 'Turbo 版推送',
		color: '#ef4444',
		enableLabel: '开启 Server酱 推送',
		testCmd: 'notifier_serverchan.sh',
		testArgs: ['Server酱测试消息 - Event Center'],
		fields: [
			{ label: 'SendKey', input: makeInput('sc-sendkey', loadCfg('serverchan', 'sendkey'), '', 'password'), desc: '在 sct.ftqq.com 获取' }
		]
	},
	{
		section: 'serverchan3',
		icon: '📱',
		title: 'Server酱³',
		subtitle: '手机 APP 推送',
		color: '#8b5cf6',
		enableLabel: '开启 Server酱³ 推送',
		testCmd: 'notifier_serverchan3.sh',
		testArgs: ['Server酱³ 测试消息 - Event Center'],
		fields: [
			{ label: 'SendKey', input: makeInput('sc3-sendkey', loadCfg('serverchan3', 'sendkey'), '', 'password'), desc: '在 Server酱³ APP 中获取' },
			{ label: 'UID', input: makeInput('sc3-uid', loadCfg('serverchan3', 'uid'), '自动提取'), desc: '可从 SendKey 自动提取，留空即可' }
		]
	},
	{
		section: 'pushplus',
		icon: '📣',
		title: 'PushPlus',
		subtitle: '微信推送',
		color: '#06b6d4',
		enableLabel: '开启 PushPlus 推送',
		testCmd: 'notifier_pushplus.sh',
		testArgs: ['PushPlus 测试消息 - Event Center'],
		fields: [
			{ label: 'Token', input: makeInput('pp-token', loadCfg('pushplus', 'token'), '', 'password'), desc: '在 pushplus.plus 获取' },
			{ label: '群组编码', input: makeInput('pp-topic', loadCfg('pushplus', 'topic'), ''), desc: '一对多推送时的群组编码，留空为一对一' },
			{ label: '消息模板', input: makeSelect('pp-tpl', [
				['markdown', 'Markdown'], ['html', 'HTML'], ['txt', '纯文本']
			], loadCfg('pushplus', 'template', 'markdown')) }
		]
	}
];

/* ── 页面入口 ── */
return view.extend({
	load: function() {
		return uci.load('eventcenter');
	},

	render: function() {
		/* 构建所有卡片 */
		var cards = channels.map(buildCard);

		/* 保存按钮 */
		var saveBtn = E('button', {
			'class': 'btn cbi-button-save',
			'style': 'padding:10px 32px;border-radius:8px;font-weight:600;font-size:0.95em',
			'click': function() {
				/* Telegram */
				saveCfg('telegram', 'enable', document.getElementById('telegram-enable').checked ? '1' : '0');
				saveCfg('telegram', 'token', document.getElementById('tg-token').value);
				saveCfg('telegram', 'chatid', document.getElementById('tg-chatid').value);
				saveCfg('telegram', 'parse_mode', document.getElementById('tg-parse').value);

				/* ntfy */
				saveCfg('ntfy', 'enable', document.getElementById('ntfy-enable').checked ? '1' : '0');
				saveCfg('ntfy', 'url', document.getElementById('ntfy-url').value);
				saveCfg('ntfy', 'topic', document.getElementById('ntfy-topic').value);
				saveCfg('ntfy', 'token', document.getElementById('ntfy-token').value);
				saveCfg('ntfy', 'user', document.getElementById('ntfy-user').value);
				saveCfg('ntfy', 'pass', document.getElementById('ntfy-pass').value);
				saveCfg('ntfy', 'priority', document.getElementById('ntfy-priority').value);

				/* 企业微信 */
				saveCfg('wechat', 'enable', document.getElementById('wechat-enable').checked ? '1' : '0');
				saveCfg('wechat', 'webhook', document.getElementById('wx-webhook').value);
				saveCfg('wechat', 'mention', document.getElementById('wx-mention').value);

				/* Bark */
				saveCfg('bark', 'enable', document.getElementById('bark-enable').checked ? '1' : '0');
				saveCfg('bark', 'server', document.getElementById('bark-server').value);
				saveCfg('bark', 'device_key', document.getElementById('bark-key').value);
				saveCfg('bark', 'sound', document.getElementById('bark-sound').value);
				saveCfg('bark', 'group', document.getElementById('bark-group').value);

				/* Server酱 */
				saveCfg('serverchan', 'enable', document.getElementById('serverchan-enable').checked ? '1' : '0');
				saveCfg('serverchan', 'sendkey', document.getElementById('sc-sendkey').value);

				/* Server酱³ */
				saveCfg('serverchan3', 'enable', document.getElementById('serverchan3-enable').checked ? '1' : '0');
				saveCfg('serverchan3', 'sendkey', document.getElementById('sc3-sendkey').value);
				saveCfg('serverchan3', 'uid', document.getElementById('sc3-uid').value);

				/* PushPlus */
				saveCfg('pushplus', 'enable', document.getElementById('pushplus-enable').checked ? '1' : '0');
				saveCfg('pushplus', 'token', document.getElementById('pp-token').value);
				saveCfg('pushplus', 'topic', document.getElementById('pp-topic').value);
				saveCfg('pushplus', 'template', document.getElementById('pp-tpl').value);

				uci.save().then(function() {
					return uci.apply();
				}).then(function() {
					saveBtn.textContent = '✓ 已保存';
					saveBtn.style.background = '#22c55e';
					saveBtn.style.color = '#fff';
					setTimeout(function() { saveBtn.textContent = '保存设置'; saveBtn.style.background = ''; saveBtn.style.color = ''; }, 2000);
				}).catch(function() {
					saveBtn.textContent = '✗ 保存失败';
					saveBtn.style.background = '#dc2626';
					saveBtn.style.color = '#fff';
					setTimeout(function() { saveBtn.textContent = '保存设置'; saveBtn.style.background = ''; saveBtn.style.color = ''; }, 2000);
				});
			}
		}, '保存设置');

		/* 布局 */
		return E('div', { 'class': 'cbi-map', 'style': 'padding:0' }, [
			E('h2', { 'style': 'margin-bottom:4px' }, '通知渠道'),
			E('div', { 'style': 'color:#666;font-size:0.9em;margin-bottom:20px' }, '配置消息推送渠道，可同时启用多个。点击卡片标题可折叠/展开。'),
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start' }, cards),
			E('div', { 'style': 'margin-top:24px;display:flex;justify-content:flex-end' }, [saveBtn])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
