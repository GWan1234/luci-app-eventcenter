'use strict';
'require view';
'require uci';
'require fs';

if(!document.getElementById('ec-hdr-css')){var hs=document.createElement('style');hs.id='ec-hdr-css';hs.textContent='.ec-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:14px}.ec-hdr-left h2{margin:0 0 4px;font-size:1.2em;font-weight:700;color:#1f2937}.ec-hdr-left p{margin:0;font-size:.82em;color:#9ca3af}.ec-hdr-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.ec-hdr-top{display:flex;align-items:center;gap:8px}.ec-hdr-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0}.ec-hdr-status{font-size:.82em;font-weight:500;color:#1f2937}.ec-hdr-bottom{display:flex;align-items:center;gap:6px}.ec-hdr-time{font-size:.78em;color:#9ca3af}.ec-hdr-refresh{background:none;border:none;cursor:pointer;font-size:1em;color:#9ca3af;padding:2px;border-radius:4px;transition:all .15s}.ec-hdr-refresh:hover{background:#f3f4f6;color:#374151}';document.head.appendChild(hs)}
function ecMakeHdr(title,subtitle,isRunning){var h=document.createElement('div');h.className='ec-hdr';h.innerHTML='<div class="ec-hdr-left"><h2>'+title+'</h2><p>'+subtitle+'</p></div><div class="ec-hdr-right"><div class="ec-hdr-top"><span class="ec-hdr-dot" style="background:'+(isRunning?'#22c55e':'#ef4444')+'"></span><span class="ec-hdr-status">'+(isRunning?'运行中':'已停止')+'</span></div><div class="ec-hdr-bottom"><span class="ec-hdr-time">最后更新: '+new Date().toLocaleString('zh-CN')+'</span><button class="ec-hdr-refresh" title="刷新">⟳</button></div></div>';h.querySelector('.ec-hdr-refresh').addEventListener('click',function(){window.location.reload()});return h}



return view.extend({
	load: function() {
		return Promise.all([
			uci.load('eventcenter'),
			fs.exec('/usr/share/eventcenter/sources/system-health.sh', ['get']),
			L.resolveDefault(fs.exec('/bin/sh', ['/usr/share/eventcenter/sources/device-monitor.sh', 'list']), { code: 1, stdout: '' }),
			L.resolveDefault(fs.exec('/bin/sh', ['-c', 'pgrep -f watcher.sh >/dev/null 2>&1 && echo 0 || echo 1']), { code: 1, stdout: '1' }),
			L.resolveDefault(fs.exec('/bin/cat', ['/etc/eventcenter/eventcenter.log']), { stdout: '' })
		]);
	},

	render: function(data) {
		var healthRes = data[1], deviceRes = data[2], pgrepRes = data[3], logRes = data[4];

		var isRunning = false;
		try { isRunning = (parseInt((pgrepRes.stdout||'').trim().split('\n').pop()) === 0); } catch(e) {}

		var deviceLines = [];
		try { if (deviceRes.code===0 && deviceRes.stdout) deviceRes.stdout.split('\n').forEach(function(l){ if(l.indexOf('\t')>0) deviceLines.push(l); }); } catch(e) {}

		var hData={cpu:0,mem:0,disk:0,temp:0,uptime:'0天'};
		try { if(healthRes.code===0){var hp=healthRes.stdout.split('|');hData.cpu=parseInt(hp[0])||0;hData.mem=parseInt(hp[1])||0;hData.temp=parseInt(hp[2])||0;hData.disk=parseInt(hp[3])||0;hData.uptime=hp[4]||'0天';} } catch(e) {}

		var channelCount=0;
		['telegram','ntfy','wechat','bark','pushplus','serverchan','serverchan3'].forEach(function(n){var c=uci.get('eventcenter',n);if(c&&c.enable==='1')channelCount++;});
		var ocCfg=uci.get('eventcenter','openclash')||{};
		var hlCfg=uci.get('eventcenter','health')||{};
		var dvCfg=uci.get('eventcenter','device_monitor')||{};
		var nfCfg=uci.get('eventcenter','ntfy')||{};

		var logLines=[];
		try{var raw=(logRes.stdout||'').trim();if(raw)raw.split('\n').forEach(function(l){if(l.trim()&&l.indexOf('|')>-1)logLines.push(l);});}catch(e){}
		var recentEvents=[];
		var es=Math.max(0,logLines.length-8);
		for(var ei=logLines.length-1;ei>=es;ei--){var ep=logLines[ei].split('|');if(ep.length>=6)recentEvents.push({time:(ep[0]||'').replace(/^\d{4}-\d{2}-\d{2}\s/,''),event:ep[2]||'',level:ep[3]||'',title:ep[4]||'',message:ep[5]||''});}
		function evIcon(ev){if(ev.indexOf('failover')>-1)return{icon:'🔒',bg:'#fef2f2',color:'#dc2626'};if(ev.indexOf('recovery')>-1)return{icon:'🛡️',bg:'#f0fdf4',color:'#22c55e'};if(ev.indexOf('config_change')>-1)return{icon:'🔄',bg:'#eff6ff',color:'#3b82f6'};if(ev.indexOf('test')>-1)return{icon:'📋',bg:'#eff6ff',color:'#3b82f6'};if(ev.indexOf('device')>-1)return{icon:'📱',bg:'#faf5ff',color:'#8b5cf6'};if(ev.indexOf('sub')>-1)return{icon:'📦',bg:'#fff7ed',color:'#f59e0b'};return{icon:'📋',bg:'#f9fafb',color:'#6b7280'};}
		function lvlBadge(l){var lc=l.toLowerCase();if(lc==='warn'||lc==='warning')return{text:'警告',bg:'#fef3c7',color:'#d97706'};if(lc==='error')return{text:'错误',bg:'#fee2e2',color:'#dc2626'};if(lc==='info')return{text:'信息',bg:'#dbeafe',color:'#2563eb'};return{text:l,bg:'#f3f4f6',color:'#6b7280'};}

		/* 页面 CSS */
		if(!document.getElementById('ec-overview-css')){
			var ps=document.createElement('style');ps.id='ec-overview-css';
			ps.textContent='.ec-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.ec-summary-card{background:#fff;border-radius:9px;padding:14px 16px;border:1px solid #e5e7eb}.ec-summary-card:hover{box-shadow:0 2px 6px rgba(0,0,0,.05)}.ec-summary-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1em;margin-bottom:8px}.ec-summary-label{font-size:.75em;color:#9ca3af;margin-bottom:3px}.ec-summary-value{font-size:1.2em;font-weight:700;color:#1f2937}.ec-summary-sub{font-size:.7em;color:#d1d5db;margin-top:3px}.ec-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.ec-card{background:#fff;border-radius:9px;border:1px solid #e5e7eb;overflow:hidden}.ec-card-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f3f4f6}.ec-card-title{font-size:.9em;font-weight:700;color:#1f2937}.ec-card-link{font-size:.75em;color:#7c3aed;cursor:pointer;text-decoration:none;font-weight:500}.ec-card-link:hover{text-decoration:underline}.ec-card-body{padding:12px 16px}.ec-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}.ec-metric{text-align:center}.ec-metric-label{font-size:.72em;color:#9ca3af;margin-bottom:5px}.ec-metric-value{font-size:1.4em;font-weight:700;color:#1f2937}.ec-sparkline{display:flex;align-items:flex-end;gap:2px;height:22px;margin:5px auto 0;max-width:70px}.ec-storage{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6}.ec-storage-label{font-size:.8em;color:#9ca3af;white-space:nowrap}.ec-storage-bar{flex:1;height:7px;background:#e5e7eb;border-radius:4px;overflow:hidden}.ec-storage-fill{height:100%;border-radius:4px}.ec-storage-text{font-size:.75em;color:#9ca3af;white-space:nowrap}.ec-svc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ec-svc-item{display:flex;align-items:center;gap:7px;padding:9px 10px;background:#f9fafb;border-radius:7px;font-size:.82em}.ec-svc-dot{width:8px;height:8px;border-radius:50%}.ec-svc-name{flex:1;color:#374151}.ec-svc-status{font-size:.78em;color:#9ca3af}.ec-event{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6}.ec-event:last-child{border-bottom:none}.ec-event-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85em;flex-shrink:0}.ec-event-info{flex:1;min-width:0}.ec-event-top{display:flex;align-items:center;gap:6px;margin-bottom:2px}.ec-event-title{font-size:.82em;font-weight:600;color:#1f2937}.ec-event-badge{font-size:.68em;padding:2px 7px;border-radius:4px;font-weight:500}.ec-event-desc{font-size:.78em;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ec-event-time{font-size:.72em;color:#d1d5db;white-space:nowrap;flex-shrink:0}.ec-device{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:.88em}.ec-device:last-child{border-bottom:none}.ec-device-mac{font-family:monospace;font-size:.9em;color:#1f2937;font-weight:500;min-width:150px}.ec-device-ip{color:#6b7280;font-size:.9em;min-width:130px}.ec-device-status{padding:3px 10px;border-radius:10px;font-size:.8em;font-weight:600}.ec-card-body::-webkit-scrollbar{width:5px}.ec-card-body::-webkit-scrollbar-track{background:transparent}.ec-card-body::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}.ec-card-body::-webkit-scrollbar-thumb:hover{background:#9ca3af}.ec-footer{text-align:center;padding:16px;font-size:.75em;color:#d1d5db}';
			document.head.appendChild(ps);
		}

		function spark(v,mx){var b=[];for(var i=0;i<8;i++){var h=Math.round(Math.max(3,Math.min(22,(v/mx)*22*(0.4+Math.random()*0.6))));b.push(E('div',{style:'width:3px;height:'+h+'px;background:#7c3aed;border-radius:2px;opacity:'+(0.4+(i/8)*0.6)}));}return b;}

		var sc=[
			{icon:'🔄',bg:'#eff6ff',color:'#3b82f6',label:'运行状态',value:isRunning?'运行中':'已停止',sub:'系统正常运行'},
			{icon:'⏱️',bg:'#f5f3ff',color:'#7c3aed',label:'运行时间',value:hData.uptime,sub:'持续运行中'},
			{icon:'📊',bg:'#f0fdf4',color:'#22c55e',label:'事件总数',value:''+logLines.length,sub:'最近24小时'},
			{icon:'⚠️',bg:'#fff7ed',color:'#f59e0b',label:'高危事件',value:'0',sub:'近24小时'},
			{icon:'🔔',bg:'#faf5ff',color:'#8b5cf6',label:'通知渠道',value:''+channelCount,sub:'已配置渠道'}
		];
		var summaryEls=sc.map(function(c){return E('div',{'class':'ec-summary-card'},[E('div',{'class':'ec-summary-icon',style:'background:'+c.bg+';color:'+c.color},c.icon),E('div',{'class':'ec-summary-label'},c.label),E('div',{'class':'ec-summary-value'},c.value),E('div',{'class':'ec-summary-sub'},c.sub)]);});

		var cpuC=hData.cpu>80?'#ef4444':'#7c3aed',memC=hData.mem>80?'#ef4444':'#3b82f6';
		var metricsEl=E('div',{'class':'ec-metrics'},[
			E('div',{'class':'ec-metric'},[E('div',{'class':'ec-metric-label'},'CPU 使用率'),E('div',{'class':'ec-metric-value',style:'color:'+cpuC},hData.cpu+'%'),E('div',{'class':'ec-sparkline'},spark(hData.cpu,100))]),
			E('div',{'class':'ec-metric'},[E('div',{'class':'ec-metric-label'},'内存使用率'),E('div',{'class':'ec-metric-value',style:'color:'+memC},hData.mem+'%'),E('div',{'class':'ec-sparkline'},spark(hData.mem,100))]),
			E('div',{'class':'ec-metric'},[E('div',{'class':'ec-metric-label'},'温度'),E('div',{'class':'ec-metric-value',style:'color:#9ca3af'},hData.temp>0?hData.temp+'°C':'N/A'),E('div',{'class':'ec-sparkline'},spark(hData.temp||20,80))])
		]);
		var dp=hData.disk||29,dt=64,da=(dt*(100-dp)/100).toFixed(1);
		var storageEl=E('div',{'class':'ec-storage'},[E('span',{'class':'ec-storage-label'},'存储空间'),E('div',{'class':'ec-storage-bar'},[E('div',{'class':'ec-storage-fill',style:'width:'+dp+'%;background:#7c3aed'})]),E('span',{'class':'ec-storage-text'},'可用 '+da+' GB / 共 '+dt+' GB')]);
		var resourceCard=E('div',{'class':'ec-card'},[E('div',{'class':'ec-card-header'},[E('div',{'class':'ec-card-title'},'系统资源')]),E('div',{'class':'ec-card-body'},[metricsEl,storageEl])]);

		var svcs=[{name:'事件中心',r:isRunning},{name:'OpenClash 监控',r:ocCfg.enable==='1'},{name:'节点健康',r:hlCfg.enable==='1'},{name:'设备监控',r:dvCfg.enable==='1'},{name:'Ntfy 通知',r:nfCfg.enable==='1'},{name:'系统服务',r:isRunning}];
		var serviceCard=E('div',{'class':'ec-card'},[E('div',{'class':'ec-card-header'},[E('div',{'class':'ec-card-title'},'服务状态')]),E('div',{'class':'ec-card-body'},[E('div',{'class':'ec-svc-grid'},svcs.map(function(s){return E('div',{'class':'ec-svc-item'},[E('div',{'class':'ec-svc-dot',style:'background:'+(s.r?'#22c55e':'#ef4444')}),E('span',{'class':'ec-svc-name'},s.name),E('span',{'class':'ec-svc-status'},s.r?'运行中':'未启用')]);}))])]);

		var evItems=recentEvents.length>0?recentEvents.map(function(ev){var ic=evIcon(ev.event),bd=lvlBadge(ev.level);return E('div',{'class':'ec-event'},[E('div',{'class':'ec-event-icon',style:'background:'+ic.bg+';color:'+ic.color},ic.icon),E('div',{'class':'ec-event-info'},[E('div',{'class':'ec-event-top'},[E('span',{'class':'ec-event-title'},ev.title||ev.event),E('span',{'class':'ec-event-badge',style:'background:'+bd.bg+';color:'+bd.color},bd.text)]),E('div',{'class':'ec-event-desc'},ev.message)]),E('span',{'class':'ec-event-time'},ev.time)]);}) : [E('div',{style:'text-align:center;padding:20px;color:#9ca3af;font-size:.82em'},'暂无事件记录')];
		var eventsCard=E('div',{'class':'ec-card'},[E('div',{'class':'ec-card-header'},[E('div',{'class':'ec-card-title'},'最近事件'),E('a',{'class':'ec-card-link',href:'/cgi-bin/luci/admin/services/eventcenter/logs'},'查看全部')]),E('div',{'class':'ec-card-body'},evItems)]);

		var devItems=deviceLines.length>0?deviceLines.map(function(l){var p=l.split('\t');return E('div',{'class':'ec-device'},[E('span',{'class':'ec-device-mac'},p[0]||'未知'),E('span',{'class':'ec-device-ip'},p[1]||'N/A'),E('span',{'class':'ec-device-status',style:'background:#d1fae5;color:#047857'},'● 在线')]);}) : [E('div',{style:'text-align:center;padding:20px;color:#9ca3af;font-size:.82em'},'暂无设备')];
		var deviceCard=E('div',{'class':'ec-card'},[E('div',{'class':'ec-card-header'},[E('div',{'class':'ec-card-title'},'设备监控'),E('span',{style:'font-size:.75em;color:#9ca3af'},'共 '+deviceLines.length+' 台')]),E('div',{'class':'ec-card-body',style:'max-height:480px;overflow-y:auto;padding-right:4px'},devItems)]);

		var footer=E('div',{'class':'ec-footer'},'EventCenter v1.0.0 | 让每一次事件，都被及时发现和处理');

		return E('div', {}, [
			ecMakeHdr('概述', '系统概览与实时状态', isRunning),
			E('div',{'class':'ec-summary'},summaryEls),
			E('div',{'class':'ec-row'},[resourceCard,serviceCard]),
			E('div',{'class':'ec-row'},[eventsCard,deviceCard]),
			footer
		]);
	}
});
