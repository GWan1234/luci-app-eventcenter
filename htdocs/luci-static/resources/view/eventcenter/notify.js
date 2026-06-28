'use strict';
'require view';
'require uci';
'require dom';
'require fs';




/* ── 页面头部组件 ── */
if(!document.getElementById('ec-hdr-css')){var hs=document.createElement('style');hs.id='ec-hdr-css';hs.textContent='.ec-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:14px}.ec-hdr-left h2{margin:0 0 4px;font-size:1.2em;font-weight:700;color:#1f2937}.ec-hdr-left p{margin:0;font-size:.82em;color:#9ca3af}.ec-hdr-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.ec-hdr-top{display:flex;align-items:center;gap:8px}.ec-hdr-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0}.ec-hdr-status{font-size:.82em;font-weight:500;color:#1f2937}.ec-hdr-bottom{display:flex;align-items:center;gap:6px}.ec-hdr-time{font-size:.78em;color:#9ca3af}.ec-hdr-refresh{background:none;border:none;cursor:pointer;font-size:1em;color:#9ca3af;padding:2px;border-radius:4px;transition:all .15s}.ec-hdr-refresh:hover{background:#f3f4f6;color:#374151}';document.head.appendChild(hs)}
function ecMakeHdr(title,subtitle,isRunning){var h=document.createElement('div');h.className='ec-hdr';h.innerHTML='<div class="ec-hdr-left"><h2>'+title+'</h2><p>'+subtitle+'</p></div><div class="ec-hdr-right"><div class="ec-hdr-top"><span class="ec-hdr-dot" style="background:'+(isRunning?'#22c55e':'#ef4444')+'"></span><span class="ec-hdr-status">'+(isRunning?'运行中':'已停止')+'</span></div><div class="ec-hdr-bottom"><span class="ec-hdr-time">最后更新: '+new Date().toLocaleString('zh-CN')+'</span><button class="ec-hdr-refresh" title="刷新">⟳</button></div></div>';h.querySelector('.ec-hdr-refresh').addEventListener('click',function(){window.location.reload()});return h}

return view.extend({
    load: function() {
        return uci.load('eventcenter');
    },

    render: function() {
        var sections = {};
        uci.sections('eventcenter', null, function(s) {
            sections[s['.name']] = s;
        });

        function getVal(section, key) {
            return (sections[section] && sections[section][key]) || '';
        }

        var channels = [
            { id: 'telegram', section: 'telegram', label: 'Telegram', icon: '✈️', color: '#0088cc',
              fields: [
                  { label: 'Bot Token', key: 'bot_token', value: getVal('telegram', 'bot_token') || '未配置', type: 'password' },
                  { label: 'Chat ID', key: 'chat_id', value: getVal('telegram', 'chat_id') || '未配置', type: 'password' },
                  { label: '消息格式', key: 'parse_mode', value: getVal('telegram', 'parse_mode') || 'Markdown', type: 'text' }
              ],
              previewBg: '#e3f2fd', previewColor: '#1976d2' },
            { id: 'ntfy', section: 'ntfy', label: 'Ntfy', icon: '🔔', color: '#4caf50',
              fields: [
                  { label: '服务器地址', key: 'url', value: getVal('ntfy', 'url') || '未配置', type: 'text' },
                  { label: '主题', key: 'topic', value: getVal('ntfy', 'topic') || '未配置', type: 'text' },
                  { label: '用户名', key: 'user', value: getVal('ntfy', 'user') || '未配置', type: 'text' },
                  { label: '密码', key: 'pass', value: getVal('ntfy', 'pass') ? '••••••••' : '未配置', type: 'password' }
              ],
              previewBg: '#e8f5e9', previewColor: '#2e7d32' },
            { id: 'wecom', section: 'wechat', label: '企业微信', icon: '💬', color: '#07c160',
              fields: [
                  { label: 'Webhook URL', key: 'webhook', value: getVal('wechat', 'webhook') || '未配置', type: 'text' }
              ],
              previewBg: '#f0fdf4', previewColor: '#07c160' },
            { id: 'bark', section: 'bark', label: 'Bark', icon: '🔔', color: '#ff3b30',
              fields: [
                  { label: '服务器地址', key: 'server', value: getVal('bark', 'server') || '未配置', type: 'text' },
                  { label: '推送 Key', key: 'key', value: getVal('bark', 'key') || '未配置', type: 'password' }
              ],
              previewBg: '#fff3f0', previewColor: '#ff3b30' },
            { id: 'pushplus', section: 'pushplus', label: 'PushPlus', icon: '➕', color: '#00bcd4',
              fields: [
                  { label: 'Token', key: 'token', value: getVal('pushplus', 'token') || '未配置', type: 'text' }
              ],
              previewBg: '#e0f7fa', previewColor: '#00acc1' },
            { id: 'serverchan', section: 'serverchan', label: 'Server酱', icon: '📮', color: '#ff6b6b',
              fields: [
                  { label: 'SendKey', key: 'key', value: getVal('serverchan', 'key') || '未配置', type: 'text' },
                  { label: '消息标题 (可选)', key: 'title', value: getVal('serverchan', 'title') || '可选, 自定义消息标题', type: 'text' }
              ],
              previewBg: '#fff5f5', previewColor: '#e53935' },
        ];

        function buildField(f, section, key) {
            var input = E('input', {
                'type': f.type,
                'value': f.value,
                'style': 'width:100%;padding:8px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;font-size:.82em;color:#374151;box-sizing:border-box'
            });
            input.addEventListener('change', function() {
                uci.set('eventcenter', section, key, this.value);
            });
            return E('div', { 'style': 'margin-bottom:10px' }, [
                E('label', { 'style': 'font-size:.78em;color:#6b7280;margin-bottom:3px;display:block' }, [f.label]),
                input
            ]);
        }

        function buildPreview(ch) {
            return E('div', { 'style': 'background:' + ch.previewBg + ';border-radius:12px;padding:12px;flex:1' }, [
                E('div', { 'style': 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, [
                    E('span', { 'style': 'font-size:1.1em' }, [ch.icon]),
                    E('strong', { 'style': 'font-size:.85em;color:' + ch.previewColor }, ['EventCenter']),
                ]),
                E('div', { 'style': 'font-size:.82em;color:#374151;line-height:1.5' }, [
                    '📌 节点自动切换',
                    E('br'),
                    '美国原生02 (不可达) → 美国01-AnyTLS'
                ])
            ]);
        }

        function buildCard(ch) {
            var on = getVal(ch.section, 'enable') === '1';
            var statusText = on ? '已启用' : '未启用';
            var statusColor = on ? '#22c55e' : '#9ca3af';
            var toggleBg = on ? '#7c3aed' : '#d1d5db';

            var fieldsEl = E('div', { 'style': 'flex:1;min-width:0' });
            ch.fields.forEach(function(f) {
                fieldsEl.appendChild(buildField(f, ch.section, f.key));
            });

            // 所有渠道统一用 eventcenter test 测试
            var testBtn = E('button', {
                'style': 'padding:6px 16px;border:1.5px solid #7c3aed;border-radius:6px;background:transparent;color:#7c3aed;font-size:.8em;font-weight:600;cursor:pointer',
                'click': function() {
                    var btn = this;
                    btn.textContent = '发送中...'; btn.disabled = true;
                    fs.exec('/usr/bin/eventcenter', ['test']).then(function(res) {
                        btn.textContent = (res && res.code === 0) ? '✅ 已发送' : '❌ 失败';
                        setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
                    }).catch(function() {
                        btn.textContent = '❌ 失败';
                        setTimeout(function() { btn.textContent = '发送测试'; btn.disabled = false; }, 2000);
                    });
                }
            }, ['发送测试']);

            // 开关元素（用本地变量追踪状态，不依赖 getVal 快照）
            var currentOn = on;
            var statusEl = E('span', { 'style': 'font-size:.8em;color:' + statusColor + ';display:flex;align-items:center;gap:4px' }, [
                E('span', { 'style': 'width:7px;height:7px;border-radius:50%;background:' + statusColor + ';display:inline-block' }),
                statusText
            ]);
            var toggleDot = E('div', { 'style': 'width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;' + (currentOn ? 'right:2px' : 'left:2px') + ';box-shadow:0 1px 3px rgba(0,0,0,.2);transition:all .2s' });
            var toggleEl = E('div', { 'style': 'width:40px;height:22px;border-radius:11px;background:' + toggleBg + ';position:relative;cursor:pointer;transition:background .2s' }, [toggleDot]);
            toggleEl.addEventListener('click', function() {
                currentOn = !currentOn;
                uci.set('eventcenter', ch.section, 'enable', currentOn ? '1' : '0');
                toggleEl.style.background = currentOn ? '#7c3aed' : '#d1d5db';
                toggleDot.style[currentOn ? 'right' : 'left'] = '2px';
                toggleDot.style[currentOn ? 'left' : 'right'] = 'auto';
                statusEl.querySelector('span').style.background = currentOn ? '#22c55e' : '#9ca3af';
                statusEl.childNodes[1].textContent = currentOn ? '已启用' : '未启用';
                statusEl.style.color = currentOn ? '#22c55e' : '#9ca3af';
            });

            return E('div', { 'style': 'background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:12px' }, [
                E('div', { 'style': 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px' }, [
                    E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
                        E('div', { 'style': 'width:36px;height:36px;border-radius:10px;background:' + ch.color + '15;display:flex;align-items:center;justify-content:center;font-size:1.2em' }, [ch.icon]),
                        E('strong', { 'style': 'font-size:1em;color:#1f2937' }, [ch.label]),
                    ]),
                    E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
                        statusEl,
                        toggleEl,
                    ])
                ]),
                E('div', { 'style': 'display:flex;gap:20px;align-items:stretch' }, [
                    fieldsEl,
                    E('div', { 'style': 'width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:10px' }, [
                        buildPreview(ch),
                        E('div', { 'style': 'text-align:right' }, [testBtn])
                    ])
                ])
            ]);
        }

        var container = E('div', { 'style': 'padding:0 20px' });

        // Header
        var anyEnabled = channels.some(function(ch) { return getVal(ch.section, 'enable') === '1'; });
        container.appendChild(ecMakeHdr('通知渠道', '配置消息推送渠道，确保事件通知送达', anyEnabled));

        // Info box
        container.appendChild(E('div', { 'style': 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82em;color:#1e40af' }, [
            '💡 直接在此页面编辑配置并保存，或点击开关启用/禁用渠道。'
        ]));

        // Cards
        channels.forEach(function(ch) {
            container.appendChild(buildCard(ch));
        });

        container.appendChild(E('div',{'class':'ec-footer'},'EventCenter v1.0.0 | 让每一次事件，都被及时发现和处理'));

        // 底部操作栏
        var saveApplyBtn = E('button', { 'class': 'cbi-button cbi-button-apply' }, '保存并应用');
        var saveBtn = E('button', { 'class': 'cbi-button cbi-button-save' }, '保存');
        var resetBtn = E('button', { 'class': 'cbi-button cbi-button-reset' }, '复位');

        saveApplyBtn.addEventListener('click', function() {
            var b = this; b.textContent = '保存中...'; b.disabled = true;
            uci.save().then(function() { return uci.apply(); }).then(function() {
                b.textContent = '重启中...';
                return fs.exec('/etc/init.d/eventcenter', ['restart']);
            }).then(function(r) {
                b.textContent = (r && r.code === 0) ? '✓ 已完成' : '✓ 已保存';
                b.style.background = '#22c55e';
                setTimeout(function() { b.textContent = '保存并应用'; b.style.background = ''; b.disabled = false; }, 3000);
            }).catch(function() {
                b.textContent = '✗ 失败'; b.style.background = '#dc2626';
                setTimeout(function() { b.textContent = '保存并应用'; b.style.background = ''; b.disabled = false; }, 3000);
            });
        });

        saveBtn.addEventListener('click', function() {
            var b = this; b.textContent = '保存中...'; b.disabled = true;
            uci.save().then(function() { return uci.apply(); }).then(function() {
                b.textContent = '✓ 已保存'; b.style.background = '#22c55e';
                setTimeout(function() { b.textContent = '保存'; b.style.background = ''; b.disabled = false; }, 2000);
            }).catch(function() {
                b.textContent = '✗ 失败'; b.style.background = '#dc2626';
                setTimeout(function() { b.textContent = '保存'; b.style.background = ''; b.disabled = false; }, 2000);
            });
        });

        resetBtn.addEventListener('click', function() { window.location.reload(); });

        var actionsBar = E('div', { 'class': 'cbi-page-actions' }, [saveApplyBtn, saveBtn, resetBtn]);
        container.appendChild(actionsBar);

        return container;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
