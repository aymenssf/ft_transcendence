let socket = null;
const listeners = [];
export function initchatSocket() {
    if (socket)
        return socket;
    socket = new WebSocket(`ws://localhost:3000/chat/ws?token=${localStorage.getItem('jwt_token')}`);
    socket.onopen = () => console.log("✅ Connected to chat server");
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        listeners.forEach((fn) => fn(data));
    };
    socket.onclose = (ev) => console.log("⚠️ Connection closed");
    socket.onerror = (ev) => console.log("⚠️ Connection error");
    return socket;
}
export function onChatMessage(fn) {
    listeners.push(fn);
}
