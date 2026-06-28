'use strict';

/**
 * Shared page header component for EventCenter LuCI pages.
 * Usage: var hdr = require('view/eventcenter/ec-header');
 *        container.appendChild(hdr.makeHeader('标题', '副标题', true));
 */
return {
	_cssInjected: false,

	_injectCSS: function() {
		if (this._cssInjected) return;
		this._cssInjected = true;
		var s = document.createElement('style');
		s.id = 'ec-hdr-shared-css';
		s.textContent = [
			'.ec-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:14px}',
			'.ec-hdr-left h2{margin:0 0 4px;font-size:1.2em;font-weight:700;color:#1f2937}',
			'.ec-hdr-left p{margin:0;font-size:.82em;color:#9ca3af}',
			'.ec-hdr-right{display:flex;align-items:center;gap:10px}',
			'.ec-hdr-status{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:18px;font-size:.8em;font-weight:600;background:#22c55e;color:#fff}',
			'.ec-hdr-stopped{background:#ef4444}',
			'.ec-hdr-time{font-size:.78em;color:#9ca3af}',
			'.ec-hdr-refresh{background:none;border:none;cursor:pointer;font-size:1.1em;color:#9ca3af;padding:4px;border-radius:6px;transition:all .15s}',
			'.ec-hdr-refresh:hover{background:#f3f4f6;color:#374151}'
		].join('\n');
		document.head.appendChild(s);
	},

	/**
	 * Create a page header element matching the reference design.
	 * @param {string} title - Main title (e.g. "节点健康")
	 * @param {string} subtitle - Description text
	 * @param {boolean} isRunning - Whether the service is running
	 * @returns {HTMLElement}
	 */
	makeHeader: function(title, subtitle, isRunning) {
		this._injectCSS();
		var header = document.createElement('div');
		header.className = 'ec-hdr';
		header.innerHTML = [
			'<div class="ec-hdr-left">',
				'<h2>' + title + '</h2>',
				'<p>' + subtitle + '</p>',
			'</div>',
			'<div class="ec-hdr-right">',
				'<span class="ec-hdr-status' + (isRunning ? '' : ' ec-hdr-stopped') + '">',
					'<span style="width:7px;height:7px;border-radius:50%;background:' + (isRunning ? '#fff' : '#fca5a5') + ';display:inline-block"></span>',
					isRunning ? '运行中' : '已停止',
				'</span>',
				'<span class="ec-hdr-time">最后更新: ' + new Date().toLocaleString('zh-CN') + '</span>',
				'<button class="ec-hdr-refresh" title="刷新">⟳</button>',
			'</div>'
		].join('');
		header.querySelector('.ec-hdr-refresh').addEventListener('click', function() {
			window.location.reload();
		});
		return header;
	}
};
