import WebSocket from "ws";
import { v4 } from "uuid";
import redis from "./Redis.js";
class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.clients = new Map();
        this.clientinfo = new Map();
    }

    CreateRoom(client,roomid ) {
        const id = roomid || v4;

        if (!this.rooms.has(id)) {
            this.rooms.set(id, new Set());
            console.log(`Room Created, ${id}`);
        }
        this.rooms.get(id).add(client);
        this.clientinfo.set(client, id);

        console.log(`Client auto-joined room ${id}`);
        return id;
    }

   async JoinRoom(client, roomid, clientData = {}) {
        if (!this.rooms.has(roomid)) {
            this.CreateRoom(roomid);
        }
        this.rooms.get(roomid).add(client);
        if (!this.clients.has(client)) {
            this.clients.set(client, new Set());
        }
        this.clients.get(client).add(roomid);

        this.clientinfo.set(client, {
            id: clientData.id || v4,
            username: clientData.name || 'Anonymous',
            joindAt: new Date(),
        })
        const clientInfo = this.clientinfo.get(client);
        console.log(`${clientInfo.username} has joined your group`);


        this.broadcastToRoom(roomid, {
            type: 'user_joined',
            roomid,
            user: clientInfo,
            timestamp: new Date().toISOString()
        }, client);
     const history = await this.getRoomMessages(roomid, 50);
        this.sendToClient(client, {
            type: 'room_joined',
            roomid,
            history,
            users: this.getRoomUsers(roomid),
            timestamp: new Date().toISOString()
        });
        return true;
    }

    async handleRoomMsg(roomid,client,data){
        
        const room = this.rooms.get(roomid);
        if(!room){
            console.log("room does'nt Exist");
            return;
        }

    const senderInfo = this.clientinfo.get(client);

    const Message = {
        type:'room_message',
        roomid,
        data,
        from :senderInfo,
        timestamp:new Date().toISOString()
    };
    console.log("MEssage",Message);

    try {
        console.log("in Try")
       
        await this.redis.rPush(`room:${roomid}:Message`,JSON.stringify(Message));
    } catch (error) {
        console.error("Error saving message to Redis:", error);
    }

        this.broadcastToRoom(roomid,data);
    }

    async getRoomMessages(roomid,limit=50){
        try {
          const Message =  await this.redis.lPop(`room:${roomid}:Messsage`,-limit,-1);
          return Message.map(m => JSON.parse(m));

        } catch (error) {
            console.error("Error fetching messages from Redis:", error);
        return [];
        }
    }

   Leave_Room(client, roomId) {
    console.log("In Leave Room");

    const room = this.rooms.get(roomId);
    const clientRoom = this.clients.get(client);
    const clientInfo = this.clientinfo.get(client);

    if (room && room.has(client)) {
        room.delete(client);

        clientRoom?.delete(roomId);

        console.log(`${clientInfo?.username || 'Anonymous'} left room: ${roomId}`);

        this.broadcastToRoom(roomId, {
            type: 'user_left',
            roomId,
            user: clientInfo,
            timestamp: new Date().toISOString()
        });

        if (room.size === 0) {
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} deleted (empty)`);
        }

        return true;
    }

    console.log(`Client not found in room ${roomId}`);
    return false;
}

    broadcastToRoom(roomid, message, excludeclient = null) {
        const room = this.rooms.get(roomid);
        const msgstr = JSON.stringify(message);
        let sentCount = 0;
console.log("room",room)
      room.forEach(client => {
    if (client !== excludeclient && client.readyState === WebSocket.OPEN) {
        try {
            client.send(msgstr);
            sentCount++;
        } catch (error) {
            console.error("Error sending to client:", error);
            this.handleClientDisconnect(client);
        }
    }
});

        console.log(` Broadcasted to ${sentCount} clients in room: ${roomid}`);
        return sentCount;
    }
    sendToClient(client, message) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('Error sending to client:', error);
                this.handleClientDisconnect(client);
                return false;
            }
        }
        return false;
    }

    getRoomUsers(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return []
        }
        return Array.from(room).map(client => {
            this.clientinfo.get(client)
        }).filter(Boolean);
    }

    handleClientDisconnect(client){
        const clientRooms = this.clients.get(client);
    if (clientRooms) {
      Array.from(clientRooms).forEach(roomId => this.Leave_Room(client, roomId));
    }
    this.rooms.delete(client);
    this.clientinfo.delete(client);
    }
}
export default RoomManager;