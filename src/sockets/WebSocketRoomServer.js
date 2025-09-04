import { WebSocketServer } from "ws";
import RoomManager from "./RoomManager.js";
import redis from "./Redis.js";


class WebSocketRoomServer {
    constructor(port = 8080) {
        this.userSockets = new Map();  
        this.roomManager = new RoomManager();
        this.wss = new WebSocketServer({ port });
        console.log(`WebSocket server started on port ${port}`);

        this.wss.on('connection', (ws) => {
            console.log("New Client Connected");

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleMsg(ws, msg);
                } catch (error) {
                    console.log("Invalid Message:", error.message);
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected');
                // remove socket from map when disconnected
                for (let [uid, sock] of this.userSockets.entries()) {
                    if (sock === ws) {
                        this.userSockets.delete(uid);
                        break;
                    }
                }
                this.roomManager.handleClientDisconnect(ws);
            });
        });
    }

    handleMsg(client, message) {
        const { type, roomId, data, userId } = message;
        console.log(`Received: ${type} for room: ${roomId}`);

        switch (type) {
            case 'register_user':
                // when frontend sends {type: "register_user", userId: "..."}
                this.userSockets.set(userId, client);
                this.deliverPendingNotifications(userId,client);
                console.log(`Registered socket for user ${userId}`);
                break;

            case 'join_room':
                console.log("roomid",roomId);
                this.roomManager.JoinRoom(client, roomId, data);
                break;

            case 'leave_room':
                this.roomManager.Leave_Room(client, roomId);
                break;

            case 'create_room':
                console.log("iddddddddddddddd",roomId);
                const newRoomId = this.roomManager.CreateRoom(client,roomId);
                this.roomManager.sendToClient(client, {
                    type: 'room_created',
                    roomId: newRoomId
                });
                break;

            case 'room_message':
                console.log("rooooooomid",roomId);
                this.roomManager.handleRoomMsg(roomId, client, data);
                //  this.roomManager.sendToClient(client, {
                //     type: 'room_msg',
                //     roomId: roomId
                // });
                break;

            default:
                this.roomManager.sendToClient(client, {
                    type: 'error',
                    message: `Unknown message type: ${type}`
                });
        }
    }

    // notifyUser(userId, payload) {
    //     const socket = this.userSockets.get(userId);
    //     if (socket && socket.readyState === 1) { // 1 = OPEN
    //         socket.send(JSON.stringify(payload));
    //     }
    // }
    getUserSocket(user_id) {
        return this.userSockets.get(user_id) || null;
    };

    storePendingNotification = async (user_id, notification) => {
        await redis.lpush(`notifications:${user_id}`, JSON.stringify(notification));
    };
    deliverPendingNotifications = async (user_id, socket) => {
        const key = `notifications:${user_id}`;
        const notifications = await redis.lrange(key, 0, -1);

        if (notifications.length > 0) {
            notifications.forEach((n) => {
                socket.emit("notification", JSON.parse(n));
            });
            await redis.del(key); // clear after sending
        }
    };
}

export default WebSocketRoomServer;
