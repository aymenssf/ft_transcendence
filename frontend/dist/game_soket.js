let socket = null;
const listeners = [];
export function initgameSocket() {
    if (socket)
        return socket;
    socket = new WebSocket(`ws://localhost:3012/ws?token=${localStorage.getItem('jwt_token')}`);
    socket.onopen = () => console.log("✅ Connected to server");
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        listeners.forEach((fn) => fn(data));
    };
    socket.onclose = (ev) => console.log("⚠️ Connection closed");
    socket.onerror = (ev) => console.log("⚠️ Connection error");
    return socket;
}
export function sendMessage(type, payload = {}) {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, payload }));
    }
    else {
        console.warn("⚠️ WebSocket not ready");
    }
}
export function addMessageListener(fn) {
    listeners.push(fn);
}
export function removeMessageListener(fn) {
    const idx = listeners.indexOf(fn);
    if (idx !== -1)
        listeners.splice(idx, 1);
}
