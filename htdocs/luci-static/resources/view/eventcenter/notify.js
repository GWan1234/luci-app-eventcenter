'use strict';
'require view';
'require uci';
'require dom';
if(!document.getElementById('ec-tabs-css-link')){var lk=document.createElement('link');lk.id='ec-tabs-css-link';lk.rel='stylesheet';lk.href=L.resource+'/eventcenter/ec-tabs.css';document.head.appendChild(lk)}



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
            { id: 'telegram', label: 'Telegram', icon: '✈️', color: '#0088cc',
              fields: [
                  { label: 'Bot Token', value: getVal('telegram', 'bot_token') || '未配置', type: 'password' },
                  { label: 'Chat ID', value: getVal('telegram', 'chat_id') || '未配置', type: 'password' },
                  { label: '消息格式', value: getVal('telegram', 'parse_mode') || 'Markdown', type: 'text' }
              ],
              previewBg: '#e3f2fd', previewColor: '#1976d2' },
            { id: 'ntfy', label: 'Ntfy', icon: '🔔', color: '#4caf50',
              fields: [
                  { label: '服务器地址', value: getVal('ntfy', 'url') || '未配置', type: 'text' },
                  { label: '主题', value: getVal('ntfy', 'topic') || '未配置', type: 'text' },
                  { label: '用户名', value: getVal('ntfy', 'user') || '未配置', type: 'text' },
                  { label: '密码', value: getVal('ntfy', 'pass') ? '••••••••' : '未配置', type: 'password' }
              ],
              previewBg: '#e8f5e9', previewColor: '#2e7d32' },
            { id: 'wecom', label: '企业微信', icon: '💬', color: '#07c160',
              fields: [
                  { label: 'Webhook URL', value: getVal('wechat', 'webhook') || '未配置', type: 'text' }
              ],
              previewBg: '#f0fdf4', previewColor: '#07c160' },
            { id: 'bark', label: 'Bark', icon: '🔔', color: '#ff3b30',
              fields: [
                  { label: '服务器地址', value: getVal('bark', 'server') || '未配置', type: 'text' },
                  { label: '设备 Key', value: getVal('bark', 'key') || '未配置', type: 'text' }
              ],
              previewBg: '#fff3f0', previewColor: '#ff3b30' },
            { id: 'pushplus', label: 'PushPlus', icon: '➕', color: '#00bcd4',
              fields: [
                  { label: 'Token', value: getVal('pushplus', 'token') || '未配置', type: 'text' }
              ],
              previewBg: '#e0f7fa', previewColor: '#00acc1' },
            { id: 'serverchan', label: 'Server酱', icon: '📮', color: '#ff6b6b',
              fields: [
                  { label: 'SendKey', value: getVal('serverchan', 'key') || '未配置', type: 'text' },
                  { label: '消息标题 (可选)', value: getVal('serverchan', 'title') || '可选, 自定义消息标题', type: 'text' }
              ],
              previewBg: '#fff5f5', previewColor: '#e53935' },
        ];

        function buildField(f) {
            return E('div', { 'style': 'margin-bottom:10px' }, [
                E('label', { 'style': 'font-size:.78em;color:#6b7280;margin-bottom:3px;display:block' }, [f.label]),
                E('input', {
                    'type': f.type,
                    'value': f.value,
                    'readonly': '',
                    'style': 'width:100%;padding:8px 10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;font-size:.82em;color:#374151;box-sizing:border-box'
                })
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
            var on = getVal(ch.id, 'enable') === '1';
            var statusText = on ? '已启用' : '未启用';
            var statusColor = on ? '#22c55e' : '#9ca3af';
            var toggleBg = on ? '#7c3aed' : '#d1d5db';

            var fieldsEl = E('div', { 'style': 'flex:1;min-width:0' });
            ch.fields.forEach(function(f) {
                fieldsEl.appendChild(buildField(f));
            });

            var testBtn;
            if (ch.id === 'ntfy') {
                testBtn = E('button', {
                    'class': 'btn cbi-button-action',
                    'style': 'padding:6px 16px;border:1.5px solid #7c3aed;border-radius:6px;background:transparent;color:#7c3aed;font-size:.8em;font-weight:600;cursor:pointer',
                    'click': function() {
                        this.textContent = '发送中...';
                        var btn = this;
                        XHR.get('/cgi-bin/luci/admin/system/eventcenter/test_ntfy', null, function(x, data) {
                            btn.textContent = data && data.success ? '✅ 成功' : '❌ 失败';
                            setTimeout(function() { btn.textContent = '发送测试'; }, 2000);
                        });
                    }
                }, ['发送测试']);
            } else {
                testBtn = E('button', {
                    'style': 'padding:6px 16px;border:1.5px solid #d1d5db;border-radius:6px;background:transparent;color:#9ca3af;font-size:.8em;cursor:not-allowed',
                    'disabled': ''
                }, ['发送测试']);
            }

            return E('div', { 'style': 'background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:12px' }, [
                E('div', { 'style': 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px' }, [
                    E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
                        E('div', { 'style': 'width:36px;height:36px;border-radius:10px;background:' + ch.color + '15;display:flex;align-items:center;justify-content:center;font-size:1.2em' }, [ch.icon]),
                        E('strong', { 'style': 'font-size:1em;color:#1f2937' }, [ch.label]),
                    ]),
                    E('div', { 'style': 'display:flex;align-items:center;gap:10px' }, [
                        E('span', { 'style': 'font-size:.8em;color:' + statusColor + ';display:flex;align-items:center;gap:4px' }, [
                            E('span', { 'style': 'width:7px;height:7px;border-radius:50%;background:' + statusColor + ';display:inline-block' }),
                            statusText
                        ]),
                        E('div', { 'style': 'width:40px;height:22px;border-radius:11px;background:' + toggleBg + ';position:relative;cursor:pointer' }, [
                            E('div', { 'style': 'width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;' + (on ? 'right:2px' : 'left:2px') + ';box-shadow:0 1px 3px rgba(0,0,0,.2)' })
                        ]),
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
        var anyEnabled = channels.some(function(ch) { return getVal(ch.id, 'enable') === '1'; });
        container.appendChild(ecMakeHdr('通知渠道', '配置消息推送渠道，确保事件通知送达', anyEnabled));

        // Info box
        container.appendChild(E('div', { 'style': 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82em;color:#1e40af' }, [
            '💡 启用渠道后，系统将通过该渠道发送通知。配置请到"设置"页面编辑。'
        ]));

        // Cards
        channels.forEach(function(ch) {
            container.appendChild(buildCard(ch));
        });

        container.appendChild(E('div',{'class':'ec-footer'},'EventCenter v1.0.0 | 让每一次事件，都被及时发现和处理'));

        // 标准 LuCI 操作栏
        var actionsBar = E('div', { 'class': 'ec-actions-bar' }, [
            E('button', { 'class': 'cbi-button cbi-button-reset', 'onclick': function() { window.location.reload(); } }, '复位'),
            E('button', { 'class': 'cbi-button cbi-button-apply', 'onclick': function() { window.location.href = '/cgi-bin/luci/admin/services/eventcenter/settings'; } }, '保存并应用')
        ]);
        container.appendChild(actionsBar);

        return container;
    },

    handleSaveApply: null,
    handleSave: null,
    handleReset: null
});
