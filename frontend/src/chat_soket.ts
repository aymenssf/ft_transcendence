let socket: WebSocket | null = null;
const listeners: ((msg: any) => void)[] = [];

export function initchatSocket() {
    if (socket) return socket;

    socket = new WebSocket(`ws://0.0.0.0:3011/socket.io?token=${localStorage.getItem('jwt_token')}`);

    socket.onopen = () => console.log("✅ Connected to chat server");
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        listeners.forEach((fn) => fn(data));
    };
    socket.onclose = (ev) => console.log("⚠️ Connection closed");
    socket.onerror = (ev) => console.log("⚠️ Connection error")

    return socket;
}

export function onChatMessage(fn: (msg: any) => void) {
    listeners.push(fn);
}

