// ── JEXONGO WS CLIENT ─────────────────────────────────────────────────────────
// Singleton WebSocket wrapper — connect once, subscribe anywhere.

const _handlers = new Map(); // eventType → Set<fn>
let _ws         = null;
let _connected  = false;

export const WS_URL =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? `ws://${location.hostname}:8080`
    : `wss://${location.hostname}/ws`;

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export function wsConnect(url = WS_URL) {
  return new Promise((resolve, reject) => {
    if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; }

    let settled = false;
    const ws    = new WebSocket(url);

    const timer = setTimeout(() => {
      if (!settled) { settled = true; try { ws.close(); } catch (_) {} reject(new Error('timeout')); }
    }, 5000);

    ws.onopen = () => {
      if (settled) return; settled = true;
      clearTimeout(timer);
      _ws = ws; _connected = true;
      resolve();
    };

    ws.onerror = () => {
      if (settled) return; settled = true;
      clearTimeout(timer);
      _connected = false;
      reject(new Error('connect failed'));
    };

    ws.onclose = () => {
      _connected = false;
      _ws = null;
      _emit('_disconnect', {});
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        _emit(msg.type, msg);
      } catch (_) {}
    };
  });
}

export function wsSend(obj) {
  if (_ws && _ws.readyState === WebSocket.OPEN)
    _ws.send(JSON.stringify(obj));
}

export function wsOn(event, fn) {
  if (!_handlers.has(event)) _handlers.set(event, new Set());
  _handlers.get(event).add(fn);
}

export function wsOff(event, fn) {
  _handlers.get(event)?.delete(fn);
}

export function wsOffAll(event) {
  _handlers.delete(event);
}

export function wsDisconnect() {
  if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; }
  _connected = false;
}

export function wsIsConnected() { return _connected; }

// ── PRIVATE ───────────────────────────────────────────────────────────────────
function _emit(event, data) {
  _handlers.get(event)?.forEach(fn => { try { fn(data); } catch (_) {} });
}
