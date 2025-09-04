import WebSocket from "ws";
import { v4 } from "uuid";
import redis from "./Redis.js";
class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.clients = new Map();
         this.redis = redis;
        this.clientinfo = new Map();
    }

    CreateRoom(client,roomId ) {
        console.log("idddddd",roomId)

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            console.log(`Room Created, ${roomId}`);
        }
        this.rooms.get(roomId).add(client);
        this.clientinfo.set(client, roomId);

        console.log(`Client auto-joined room ${roomId}`);
        return roomId;
    }

  

async JoinRoom(client, roomId, clientData = {}) {
    if (!this.rooms.has(roomId)) {
        this.CreateRoom(roomId);
    }

    console.log("inside JoinRoom");
    console.log("client", client);
    console.log("roomid", roomId);

    this.rooms.get(roomId).add(client);

    if (!this.clients.has(client)) {
        this.clients.set(client, new Set());
    }
    this.clients.get(client).add(roomId);

    this.clientinfo.set(client, {
        id: roomId,
        username: clientData.name || "Anonymous",
        joinedAt: new Date(),
    });

    const clientInfo = this.clientinfo.get(client);
    console.log(`${clientInfo.username} has joined room: ${roomId}`);

    this.broadcastToRoom(
        roomId,
        {
            type: "user_joined",
            roomId,
            user: clientInfo,
            timestamp: new Date().toISOString(),
        },
        client 
    );

    const history = await this.getRoomMessages(roomId, 50);
    this.sendToClient(client, {
        type: "room_joined",
        roomId,
        history,
        users: this.getRoomUsers(roomId),
        timestamp: new Date().toISOString(),
    });

    return true;
}


    async handleRoomMsg(roomId, client, data) {
        console.log("roomname",roomId);
    const room = this.rooms.get(roomId);
    if (!room) {
        console.log("Room doesn't exist:", roomId);
        return;
    }

    const senderInfo = this.clientinfo.get(client);

    const message = {
        type: 'room_message',
        roomId,           
        data,             
        from: senderInfo, 
        timestamp: new Date().toISOString()
    };

    console.log("Message to broadcast:", message);

    try {
        await this.redis.rPush(`room:${roomId}:Message`, JSON.stringify(message));
    } catch (error) {
        console.error("Error saving message to Redis:", error);
    }

    room.forEach(c => {
        if (c.readyState === WebSocket.OPEN) {
            console.log("adnan")
            c.send(JSON.stringify(message));
        }
    });
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