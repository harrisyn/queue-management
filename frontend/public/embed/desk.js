/*
 * Desk widget for other web apps. Paste into any page:
 *   <script src="https://YOUR-WORKSPACE/embed/desk.js" async></script>
 * Options (attributes on the script tag):
 *   data-position="left"   put the button bottom-left instead of bottom-right
 *   data-open="true"       start with the panel open
 * Staff sign in once inside the panel; it remembers them in this browser.
 */
(function () {
  if (window.__qmsDesk) return;
  window.__qmsDesk = true;

  var script = document.currentScript || document.querySelector('script[src*="/embed/desk.js"]');
  if (!script) return;
  var origin = new URL(script.src).origin;
  var left = script.getAttribute('data-position') === 'left';
  var startOpen = script.getAttribute('data-open') === 'true';

  var host = document.createElement('div');
  host.style.cssText = 'position:fixed;bottom:20px;' + (left ? 'left' : 'right') + ':20px;z-index:2147483000;font-family:system-ui,sans-serif';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var style = document.createElement('style');
  style.textContent = [
    '.btn{display:flex;align-items:center;gap:8px;height:48px;padding:0 18px 0 14px;border:0;border-radius:999px;background:#0e8f80;color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(28,39,51,.28)}',
    '.btn:focus-visible{outline:3px solid #f0b429;outline-offset:2px}',
    '.count{min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#f0b429;color:#1c2733;font-size:13px;display:none;align-items:center;justify-content:center}',
    '.panel{position:absolute;bottom:60px;' + (left ? 'left' : 'right') + ':0;width:340px;height:520px;max-height:calc(100vh - 100px);border:0;border-radius:16px;background:#fff;box-shadow:0 18px 48px rgba(28,39,51,.3);display:none}',
    '.open .panel{display:block}'
  ].join('');
  shadow.appendChild(style);

  var wrap = document.createElement('div');
  var button = document.createElement('button');
  button.className = 'btn';
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span>Desk</span><span class="count"></span>';
  var count = button.querySelector('.count');

  var frame = document.createElement('iframe');
  frame.className = 'panel';
  frame.title = 'Desk';
  frame.allow = 'notifications';

  function setOpen(open) {
    if (open && !frame.src) frame.src = origin + '/widget/desk?embed=1';
    wrap.className = open ? 'open' : '';
    button.setAttribute('aria-expanded', String(open));
  }
  button.addEventListener('click', function () { setOpen(wrap.className !== 'open'); });

  // The widget reports its waiting count so the button can show it while closed.
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== 'qms-desk') return;
    var n = Number(e.data.waiting) || 0;
    count.textContent = n > 99 ? '99+' : String(n);
    count.style.display = n > 0 ? 'inline-flex' : 'none';
  });

  wrap.appendChild(frame);
  wrap.appendChild(button);
  shadow.appendChild(wrap);
  document.body.appendChild(host);
  // Load the panel in the background so the count shows before first open.
  frame.src = origin + '/widget/desk?embed=1';
  setOpen(startOpen);
})();
