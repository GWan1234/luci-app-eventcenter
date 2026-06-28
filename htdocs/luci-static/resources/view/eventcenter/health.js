'use strict';
'require view';
'require form';
'require fs';
'require uci';
var ecHdr = require('view/eventcenter/ec-header');

/* ── 美化 LuCI 顶部 Tab 菜单 ── */
;(function(){
	if(document.getElementById('ec-tab-css-v2'))return;
	var s=document.createElement('style');s.id='ec-tab-css-v2';
	s.textContent=[
		'.cbi-section{border-radius:10px!important;box-shadow:0 1px 4px rgba(0,0,0,.06)!important;border:1px solid #e5e7eb!important;margin-bottom:14px!important}',
		'.cbi-section>h3{border-radius:10px 10px 0 0!important;padding:12px 16px!important;font-size:.95em!important;font-weight:700!important;border-bottom:1px solid #f3f4f6!important}',
		'ul.tabs{display:flex!important;gap:0!important;padding:0!important;margin:0 0 14px!important;background:#fff!important;border-radius:0 0 10px 10px!important;box-shadow:0 1px 4px rgba(0,0,0,.06)!important;border:1px solid #e5e7eb!important;border-top:none!important;position:relative!important}',
		'ul.tabs::before{content:""!important;display:block!important;position:absolute!important;top:-4px!important;left:0!important;right:0!important;height:4px!important;background:linear-gradient(90deg,#c4b5fd,#7c3aed,#4c1d95)!important;border-radius:10px 10px 0 0!important;z-index:1!important}',
		'ul.tabs>li{margin:0!important;border-bottom:none!important;background:transparent!important;border-radius:0!important}',
		'ul.tabs>li>a{display:block!important;padding:10px 18px!important;font-size:.88em!important;font-weight:500!important;color:#6b7280!important;text-decoration:none!important;transition:all .15s!important;border-bottom:2px solid transparent!important;border-radius:0!important;background:transparent!important}',
		'ul.tabs>li>a:hover{color:#7c3aed!important;background:#faf5ff!important;border-bottom-color:#e9d5ff!important}',
		'ul.tabs>li.active,ul.tabs>li[class~="active"]{border-bottom:none!important;background:transparent!important}',
		'ul.tabs>li.active>a,ul.tabs>li[class~="active"]>a{color:#7c3aed!important;border-bottom:2px solid #7c3aed!important;font-weight:600!important;background:#faf5ff!important}',
		'.cbi-page-actions{display:flex!important;justify-content:flex-end!important;gap:8px!important;padding:14px 0!important;margin-top:14px!important;border-top:1px solid #e5e7eb!important}',
		'.cbi-button-apply{background:#7c3aed!important;color:#fff!important;border:none!important;border-radius:6px!important;padding:8px 20px!important;font-weight:600!important;cursor:pointer!important}',
		'.cbi-button-apply:hover{background:#6d28d9!important}'
	].join('\n');
	document.head.appendChild(s);
})();

/* ── 页面专属 CSS ── */
;(function(){
	if(document.getElementById('ec-health-css'))return;
	var s=document.createElement('style');s.id='ec-health-css';
	s.textContent=[
		'.ec-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px}',
		'.ec-metric-card{background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px}',
		'.ec-metric-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1em;margin-bottom:8px}',
		'.ec-metric-label{font-size:.72em;color:#9ca3af;margin-bottom:3px}',
		'.ec-metric-value{font-size:1.3em;font-weight:700;color:#1f2937}',
		'.ec-metric-sub{font-size:.68em;color:#d1d5db;margin-top:2px}',

		'.ec-panel{background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:14px}',
		'.ec-panel-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f3f4f6}',
		'.ec-panel-head h3{margin:0;font-size:.92em;font-weight:700;color:#1f2937;display:flex;align-items:center;gap:8px}',
		'.ec-panel-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
		'.ec-panel-link{font-size:.75em;color:#7c3aed;cursor:pointer;text-decoration:none;font-weight:500}',
		'.ec-panel-link:hover{text-decoration:underline}',
		'.ec-panel-body{padding:0}',

		'.ec-tbl{width:100%;border-collapse:collapse}',
		'.ec-tbl th{text-align:left;padding:10px 14px;font-size:.78em;color:#9ca3af;font-weight:600;border-bottom:1px solid #f3f4f6;background:#fafafa}',
		'.ec-tbl td{padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:.85em;color:#374151}',
		'.ec-tbl tr:last-child td{border-bottom:none}',
		'.ec-tbl tr:hover{background:#faf5ff}',

		'.ec-badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:.75em;font-weight:600}',
		'.ec-badge-ok{background:#d1fae5;color:#047857}',
		'.ec-badge-fail{background:#fee2e2;color:#dc2626}',
		'.ec-badge-warn{background:#fef3c7;color:#d97706}',
		'.ec-badge-info{background:#dbeafe;color:#2563eb}',

		'.ec-swich-old{color:#dc2626;font-weight:500}',
		'.ec-swich-new{color:#059669;font-weight:500}',
		'.ec-swich-arrow{color:#9ca3af;margin:0 4px}',

		'.ec-delay-good{color:#059669;font-weight:600}',
		'.ec-delay-mid{color:#d97706;font-weight:600}',
		'.ec-delay-bad{color:#dc2626;font-weight:600}',

		'.ec-muted{color:#9ca3af}'
	].join('\n');
	document.head.appendChild(s);
})();

return view.extend({
load: function() {
	return Promise.all([
		uci.load('eventcenter'),
		L.resolveDefault(fs.exec('/bin/cat', ['/tmp/eventcenter_node_state']), { stdout: '' }),
		L.resolveDefault(fs.exec('/bin/cat', ['/etc/eventcenter/failed_nodes']), { stdout: '' }),
		L.resolveDefault(fs.exec('/usr/bin/tail', ['-30', '/etc/eventcenter/latency_history']), { stdout: '' }),
		L.resolveDefault(fs.exec('/bin/cat', ['/etc/eventcenter/eventcenter.log']), { stdout: '' })
	]);
},

render: function(data) {
	var healthEnabled = uci.get('eventcenter', 'health', 'enable') === '1';
	var stateOutput = (data[1] && data[1].stdout) ? data[1].stdout.trim() : '';
	var failedOutput = (data[2] && data[2].stdout) ? data[2].stdout.trim() : '';
	var latencyOutput = (data[3] && data[3].stdout) ? data[3].stdout.trim() : '';
	var logOutput = (data[4] && data[4].stdout) ? data[4].stdout.trim() : '';

	/* Parse state */
	var stateEntries = stateOutput.split('\n').filter(function(l){return l.length>0;}).map(function(line){
		var p=line.split('\t');
		return {group:p[0]||'', node:p[1]||''};
	});

	/* Parse failed */
	var failedEntries = failedOutput.split('\n').filter(function(l){return l.length>0;}).map(function(line){
		var p=line.split('\t');
		return {group:p[0]||'', node:p[1]||''};
	});

	/* Parse latency — 最新20条 */
	var latencyLines = latencyOutput.split('\n').filter(function(l){return l.length>0;});
	var latencyEntries = [];
	for(var i=latencyLines.length-1;i>=0&&latencyEntries.length<20;i--){
		var parts=latencyLines[i].split('\t');
		if(parts.length>=4) latencyEntries.push({time:parts[0],group:parts[1],node:parts[2],delay:parts[3]});
	}

	/* Parse health events */
	var logLines=logOutput.split('\n').filter(function(l){return l.length>0&&l.indexOf('|')>-1;});
	var healthEvents=[];
	for(var j=logLines.length-1;j>=0&&healthEvents.length<10;j--){
		var p=logLines[j].split('|');
		if(p.length>=6&&(p[2]==='node_failover'||p[2]==='node_recovery')){
			healthEvents.push({time:p[0],event:p[2],level:p[3],title:p[4],message:p[5]});
		}
	}

	/* 统计 */
	var totalNodes=stateEntries.length;
	var failedCount=failedEntries.length;
	var healthyCount=totalNodes-failedCount;
	var todaySwitches=healthEvents.length;

	/* ── Header ── */
	var header = ecHdr.makeHeader('节点健康', '节点状态监控与切换记录', healthEnabled);

	/* ── 摘要卡片 ── */
	var metrics=[
		{icon:'💓',bg:'#eff6ff',color:'#3b82f6',label:'当前状态',value:healthEnabled?'运行中':'已禁用',sub:'监控服务正常'},
		{icon:'📊',bg:'#f5f3ff',color:'#7c3aed',label:'监控节点总数',value:totalNodes+'个',sub:'分布在 '+totalNodes+' 个组'},
		{icon:'✅',bg:'#f0fdf4',color:'#22c55e',label:'健康节点',value:healthyCount+'个',sub:'可用节点'},
		{icon:'⚠️',bg:'#fff7ed',color:'#f59e0b',label:'故障节点',value:failedCount+'个',sub:failedCount>0?'需要关注':'全部正常'},
		{icon:'🔄',bg:'#faf5ff',color:'#8b5cf6',label:'今日切换',value:todaySwitches+'次',sub:'自动切换次数'}
	];
	var metricsEls=metrics.map(function(c){
		return E('div',{'class':'ec-metric-card'},[
			E('div',{'class':'ec-metric-icon',style:'background:'+c.bg+';color:'+c.color},c.icon),
			E('div',{'class':'ec-metric-label'},c.label),
			E('div',{'class':'ec-metric-value'},c.value),
			E('div',{'class':'ec-metric-sub'},c.sub)
		]);
	});

	/* ── 当前节点选择 ── */
	var stateRows=[];
	if(stateEntries.length===0){
		stateRows.push(E('tr',{},E('td',{'colspan':'5','class':'ec-muted','style':'text-align:center;padding:24px'},'暂无数据')));
	} else {
		stateEntries.forEach(function(entry){
			var isFailed=failedEntries.some(function(f){return f.group===entry.group;});
			/* 查找该组最近的延迟 */
			var lastDelay='--';
			for(var li=0;li<latencyEntries.length;li++){
				if(latencyEntries[li].group===entry.group){
					lastDelay=latencyEntries[li].delay;
					break;
				}
			}
			/* 统计该组切换次数 */
			var switchCount=0;
			healthEvents.forEach(function(ev){
				if(ev.message&&ev.message.indexOf(entry.group)>-1) switchCount++;
			});

			stateRows.push(E('tr',{},[
				E('td',{'style':'font-weight:600'},entry.group),
				E('td',{'style':isFailed?'color:#dc2626;font-weight:600':'font-weight:500'},entry.node),
				E('td',{},E('span',{'class':'ec-badge '+(isFailed?'ec-badge-fail':'ec-badge-ok')},isFailed?'故障':'健康')),
				E('td',{'style':'font-family:monospace'},lastDelay==='--'?'--':lastDelay+' ms'),
				E('td',{},''+switchCount)
			]));
		});
	}

	/* ── 延迟记录 ── */
	var latencyRows=[];
	if(latencyEntries.length===0){
		latencyRows.push(E('tr',{},E('td',{'colspan':'4','class':'ec-muted','style':'text-align:center;padding:24px'},'暂无延迟记录')));
	} else {
		latencyEntries.forEach(function(entry){
			var d=parseInt(entry.delay,10);
			var cls=d<500?'ec-delay-good':d<1000?'ec-delay-mid':'ec-delay-bad';
			latencyRows.push(E('tr',{},[
				E('td',{'style':'font-size:.82em;white-space:nowrap'},entry.time),
				E('td',{},entry.group),
				E('td',{'style':'max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'},entry.node),
				E('td',{'class':cls},entry.delay+' ms')
			]));
		});
	}

	/* ── 切换事件 ── */
	var eventRows=[];
	if(healthEvents.length===0){
		eventRows.push(E('tr',{},E('td',{'colspan':'4','class':'ec-muted','style':'text-align:center;padding:24px'},'暂无切换事件')));
	} else {
		healthEvents.forEach(function(entry){
			var isRecovery=entry.event==='node_recovery';
			/* 解析消息中的节点切换信息 */
			var detail=entry.message||'';
			/* 简化消息，提取关键信息 */
			var shortDetail=detail.replace(/[\u{1F000}-\u{1FFFF}]/gu,'').replace(/\s+/g,' ').trim();
			if(shortDetail.length>60) shortDetail=shortDetail.substring(0,60)+'...';

			eventRows.push(E('tr',{},[
				E('td',{'style':'font-size:.82em;white-space:nowrap'},entry.time),
				E('td',{},E('span',{'class':'ec-badge '+(isRecovery?'ec-badge-ok':'ec-badge-fail')},isRecovery?'恢复':'故障')),
				E('td',{},entry.title),
				E('td',{'style':'font-size:.82em;color:#6b7280;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'},shortDetail)
			]));
		});
	}

	/* ── 布局 ── */
	var content=E('div',{},[
		header,

		/* 摘要卡片 */
		E('div',{'class':'ec-metrics'},metricsEls),

		/* 当前节点选择 */
		E('div',{'class':'ec-panel','style':'border-left:3px solid #3b82f6'},[
			E('div',{'class':'ec-panel-head'},[
				E('h3',{},[E('span',{'class':'ec-panel-dot','style':'background:#3b82f6'}),'当前节点选择']),
				E('span',{'style':'font-size:.78em;color:#9ca3af'},totalNodes+' 个监控组')
			]),
			E('div',{'class':'ec-panel-body'},[
				E('table',{'class':'ec-tbl'},[
					E('thead',{},E('tr',{},[
						E('th',{'style':'width:160px'},'代理组'),
						E('th',{},'当前节点'),
						E('th',{'style':'width:80px'},'状态'),
						E('th',{'style':'width:100px'},'延迟'),
						E('th',{'style':'width:80px'},'切换次数')
					])),
					E('tbody',{},stateRows)
				])
			])
		]),

		/* 延迟记录 */
		E('div',{'class':'ec-panel','style':'border-left:3px solid #f59e0b'},[
			E('div',{'class':'ec-panel-head'},[
				E('h3',{},[E('span',{'class':'ec-panel-dot','style':'background:#f59e0b'}),'延迟记录 (最近20条)'])
			]),
			E('div',{'class':'ec-panel-body'},[
				E('table',{'class':'ec-tbl'},[
					E('thead',{},E('tr',{},[
						E('th',{},'时间'),E('th',{},'代理组'),E('th',{},'节点'),E('th',{'style':'width:100px'},'延迟')
					])),
					E('tbody',{},latencyRows)
				])
			])
		]),

		/* 切换事件 */
		E('div',{'class':'ec-panel','style':'border-left:3px solid #dc2626'},[
			E('div',{'class':'ec-panel-head'},[
				E('h3',{},[E('span',{'class':'ec-panel-dot','style':'background:#dc2626'}),'最近切换事件']),
				E('a',{'class':'ec-panel-link',href:'/cgi-bin/luci/admin/services/eventcenter/logs'},'查看全部')
			]),
			E('div',{'class':'ec-panel-body'},[
				E('table',{'class':'ec-tbl'},[
					E('thead',{},E('tr',{},[
						E('th',{},'时间'),E('th',{'style':'width:80px'},'类型'),E('th',{'style':'width:140px'},'标题'),E('th',{},'详情')
					])),
					E('tbody',{},eventRows)
				])
			])
		])
	]);

	/* 用 form.Map 包装 */
	var m=new form.Map('eventcenter','','');
	var sec=m.section(form.NamedSection,'health','health','');
	sec.addremove=false;
	sec.anonymous=false;
	sec.render=function(){return content;};

	return m.render().then(function(node){
		setTimeout(function(){
			var pa=document.querySelector('.cbi-page-actions');
			if(pa&&!pa.querySelector('.ec-restart-btn')){
				var btn=E('button',{'class':'cbi-button-apply ec-restart-btn','style':'margin-left:8px'},'保存并重启');
				btn.addEventListener('click',function(){
					var b=this;b.textContent='保存中...';b.disabled=true;
					uci.save().then(function(){return uci.apply();}).then(function(){
						b.textContent='重启中...';
						return fs.exec('/etc/init.d/eventcenter',['restart']);
					}).then(function(r){
						b.textContent=(r&&r.code===0)?'✓ 已完成':'✓ 已保存';
						b.style.background='#22c55e';
						setTimeout(function(){b.textContent='保存并重启';b.style.background='#f59e0b';b.disabled=false;},3000);
					}).catch(function(){
						b.textContent='✗ 失败';b.style.background='#dc2626';
						setTimeout(function(){b.textContent='保存并重启';b.style.background='#f59e0b';b.disabled=false;},3000);
					});
				});
				pa.appendChild(btn);
			}
		},300);
		return node;
	});
},
});
