import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SCRIPT_BODY = `
(function() {
  if (window.__eid) return; window.__eid = true;
  var sel = null, n = 0;

  var st = document.createElement('style');
  st.textContent =
    '[data-eid]{cursor:pointer!important}' +
    '[data-eid]:hover{outline:2px solid rgba(99,102,241,.75)!important;outline-offset:2px!important}' +
    '[data-eid].eid-sel{outline:2px solid #f59e0b!important;outline-offset:2px!important}' +
    '.eid-iw{position:relative;display:inline-block;cursor:pointer!important}' +
    '.eid-iw:hover{outline:2px solid rgba(99,102,241,.75)!important;outline-offset:2px!important}' +
    '.eid-iw.eid-sel{outline:2px solid #f59e0b!important;outline-offset:2px!important}' +
    '.eid-ib{position:absolute;top:4px;right:4px;background:rgba(99,102,241,.92);color:#fff;' +
    'font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;opacity:0;' +
    'transition:opacity .15s;pointer-events:none;font-family:sans-serif;z-index:9999}' +
    '.eid-iw:hover .eid-ib{opacity:1}';
  document.head.appendChild(st);

  document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,span,a,li,td,th,label,button,img').forEach(function(el) {
    if (!el.dataset.eid) el.dataset.eid = 'e' + (++n);
  });

  document.querySelectorAll('img[data-eid]').forEach(function(img) {
    var w = document.createElement('span');
    w.className = 'eid-iw';
    w.dataset.eid = img.dataset.eid;
    img.removeAttribute('data-eid');
    var b = document.createElement('span');
    b.className = 'eid-ib';
    b.textContent = '🖼 Changer';
    img.parentNode.insertBefore(w, img);
    w.appendChild(img);
    w.appendChild(b);
  });

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body && !el.dataset.eid) el = el.parentElement;
    if (!el || !el.dataset.eid) {
      if (sel) { sel.classList.remove('eid-sel'); sel = null; }
      parent.postMessage({ type: 'deselect' }, '*');
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (sel) sel.classList.remove('eid-sel');
    sel = el;
    el.classList.add('eid-sel');
    var isImg = el.classList.contains('eid-iw');
    var img = isImg ? el.querySelector('img') : null;
    parent.postMessage({
      type: 'select',
      id: el.dataset.eid,
      tag: isImg ? 'img' : el.tagName.toLowerCase(),
      isImg: isImg,
      html: isImg ? '' : el.innerHTML,
      src: img ? img.src : '',
      alt: img ? (img.alt || '') : ''
    }, '*');
  }, true);

  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.type) return;
    if (d.type === 'update-text') {
      var el = document.querySelector('[data-eid="' + d.id + '"]');
      if (el) el.innerHTML = d.value;
    } else if (d.type === 'update-img') {
      var w = document.querySelector('[data-eid="' + d.id + '"]');
      if (w) {
        var img = w.querySelector('img');
        if (img) {
          img.src = d.value;
          img.removeAttribute('data-export-src'); // user replaced → don't restore on export
        }
      }
    } else if (d.type === 'update-alt') {
      var w = document.querySelector('[data-eid="' + d.id + '"]');
      if (w) { var img = w.querySelector('img'); if (img) img.alt = d.value; }
    } else if (d.type === 'get-html') {
      parent.postMessage({ type: 'html', id: d.id, html: document.documentElement.outerHTML }, '*');
    }
  });
})()
`;

const EditorFrame = forwardRef(function EditorFrame({ html, onSelect, onDeselect }, ref) {
  const iframeRef  = useRef(null);
  const prevUrl    = useRef(null);
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Rebuild blob URL whenever html changes
  useEffect(() => {
    if (!html) return;
    setLoading(true);

    const tag      = '<scr' + 'ipt>' + SCRIPT_BODY + '<\/' + 'script>';
    const injected = html.includes('</body>')
      ? html.replace('</body>', tag + '</body>')
      : html + tag;

    const blob = new Blob([injected], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    prevUrl.current = url;
    setBlobUrl(url);
  }, [html]);

  // Cleanup on unmount
  useEffect(() => () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current); }, []);

  // Listen for messages from iframe
  useEffect(() => {
    function handler(e) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'select')   onSelect?.(e.data);
      if (e.data?.type === 'deselect') onDeselect?.();
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSelect, onDeselect]);

  // Expose sendMessage + getHtml to parent via ref
  useImperativeHandle(ref, () => ({
    sendMessage(msg) {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    },
    getHtml() {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        function handler(e) {
          if (e.data?.type === 'html' && e.data.id === id) {
            window.removeEventListener('message', handler);
            resolve(e.data.html);
          }
        }
        window.addEventListener('message', handler);
        iframeRef.current?.contentWindow?.postMessage({ type: 'get-html', id }, '*');
        setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 2000);
      });
    },
  }));

  return (
    <div className="editor-container">
      {loading && (
        <div className="editor-loading">
          <div className="spinner" />
          <span>Chargement…</span>
        </div>
      )}
      {blobUrl && (
        <iframe
          ref={iframeRef}
          src={blobUrl}
          className={`editor-frame${loading ? ' hidden' : ''}`}
          title="Éditeur visuel"
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
});

export default EditorFrame;
