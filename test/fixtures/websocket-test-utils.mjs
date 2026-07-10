export function createMockWebSocketConstructor(hooks = {}) {
  const instances = [];

  class MockWebSocket {
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
    readyState = this.CONNECTING;
    listeners = new Map();
    addCalls = 0;
    removeCalls = 0;
    closeCalls = 0;
    sendCalls = [];
    _binaryType = 'blob';

    constructor(url, protocols) {
      this.url = String(url);
      this.protocols = protocols;
      instances.push(this);
      hooks.construct?.(this);
    }

    get binaryType() {
      return this._binaryType;
    }

    set binaryType(value) {
      this._binaryType = value;
      hooks.binaryType?.(this, value);
    }

    addEventListener(type, listener) {
      this.addCalls += 1;
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
      hooks.add?.(this, type, listener);
    }

    removeEventListener(type, listener) {
      this.removeCalls += 1;
      this.listeners.get(type)?.delete(listener);
      hooks.remove?.(this, type, listener);
    }

    close(code, reason) {
      this.closeCalls += 1;
      this.readyState = this.CLOSED;
      hooks.close?.(this, code, reason);
    }

    send(payload) {
      this.sendCalls.push(payload);
      hooks.send?.(this, payload);
    }

    emit(type, event = { type }) {
      for (const listener of [...(this.listeners.get(type) ?? [])]) {
        listener(event);
      }
    }

    open() {
      this.readyState = this.OPEN;
      this.emit('open');
    }

    message(data) {
      this.emit('message', { type: 'message', data });
    }

    serverClose() {
      this.readyState = this.CLOSED;
      this.emit('close', { type: 'close', code: 1006, reason: 'fixture' });
    }

    listenerCount() {
      let count = 0;
      for (const listeners of this.listeners.values()) {
        count += listeners.size;
      }
      return count;
    }
  }

  return { Constructor: MockWebSocket, instances };
}
