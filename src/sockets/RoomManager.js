import WebSocket from "ws";
import { v4 } from "uuid";
import redis from "./Redis.js";
import { Message } from "../models/MessageModel.js";
import { tryCatch } from "bullmq";
import { Conversation } from "../models/ConversationModel.js";
import mongoose from "mongoose";
class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.clients = new Map();
    this.redis = redis;
    this.clientinfo = new Map();
  }

  CreateRoom(client, roomId) {
    console.log("idddddd", roomId)

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
      console.log(`Room Created, ${roomId}`);
    }
    this.rooms.get(roomId).add(client);
    this.clientinfo.set(client, roomId);

    console.log(`Client auto-joined room ${roomId}`);
    return roomId;
  }


  generateRandomString(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async handleopenchat(client, UserId, FriendId) {
    console.log("friend", FriendId);
    console.log("inside handle open chat");
    console.log(mongoose.connection.readyState);

    const messages = await Message.find({
      $or: [
        { sender_id: UserId, reciver_id: FriendId },
        { sender_id: FriendId, reciver_id: UserId },
      ],
    })
      .sort({ created_at: 1 })
      .limit(50);
    console.log(mongoose.connection.readyState)

    if (messages.length === 0) {
      console.log("📭 No messages found");
    }

    console.log("Messages", messages);

    client.send(
      JSON.stringify({
        type: "chat_history",
        FriendId,
        messages,
      })
    );

    // If using socket.io (comment out above and use this instead)
    // client.emit("chat_history", { FriendId, messages });
  }

  Callhanderler(FriendId, from,UserId, client, frdsocket) {
    const payload = {
      type: "webrtc_call_request",
      from,
      UserId,
      FriendId
    }

    if (Array.isArray(frdsocket)) {
      let delived = false;
      for (const sock of frdsocket) {
        if (sock.readyState === 1) {
          sock.send(JSON.stringify(payload));
          delived = true;
        }
      }
    }

  }
  handleanswer(from, data, frdsocket) {
    const payload = { type: "webrtc_answer", data };
    if (Array.isArray(frdsocket)) {
      let delivered = false;
      for (const sock of frdsocket) {
        if (sock.readyState === 1) {
          sock.send(JSON.stringify(payload));
          delivered = true;
        }

      }


    }
  }
  handleoffer(FriendId, data, client, frdsocoffer) {
    const payload = { type: "webrtc_offer", data };
    if (Array.isArray(frdsocoffer)) {
      let delivered = false;
      for (const sock of frdsocoffer) {
        if (sock.readyState === 1) {
          sock.send(JSON.stringify(payload));
          delivered = true;
        }

      }


    }
  }
  handleicecandidate(FriendId, data, client, friendSockets) {
  console.log("ICE Candidate from", client.userId, "to", FriendId, "=>", data);

  const payload = {
    type: "webrtc_ice_candidate",
    from: client.userId,  // sender ID
    to: FriendId,         // receiver ID
    data,                 // ICE candidate object
  };

  if (Array.isArray(friendSockets)) {
    for (const sock of friendSockets) {
      try {
        if (sock.readyState === 1) {
          sock.send(JSON.stringify(payload));
        }
      } catch (err) {
        console.error("Failed to send ICE candidate:", err);
      }
    }
  }
}

async  DirectMessage(UserId, FriendId, data, msgType, client, friendSockets) {
  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [UserId, FriendId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [UserId, FriendId]
      });
    }

    const message = await Message.create({
      conversation_id: conversation._id,
      sender_id: UserId,
      reciver_id: FriendId,
      content: data,
      message_type: msgType || "text"
    });

    const payload = {
      type: "receive_message",
      from: UserId,
      data,
      msgType,
      conversation_id: conversation._id,
      message_id: message.message_id
    };

    if (Array.isArray(friendSockets)) {
      for (const sock of friendSockets) {
        if (sock.readyState === 1) {
          sock.send(JSON.stringify(payload));
        }
      }
    }

    console.log("Message stored and delivered:", message._id);
    return message;

  } catch (err) {
    console.error("Error in DirectMessage:", err);
  }
}


  async JoinRoom(client, roomId, clientData = {
    username: this.generateRandomString()
  }) {
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
      username: clientData.username,
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
    console.log("roomname", roomId);
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


  async getRoomMessages(roomid, limit = 50) {
    try {
      const Message = await this.redis.lPop(`room:${roomid}:Messsage`, -limit, -1);
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
    console.log("room", room)
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

  handleAcceptcall(FriendId,from, UserId,client, frdsoc) {
    console.log("From:", from);
    console.log("Target socket(s):", frdsoc);

    const payload = {
      type: "webrtc_call_accept",
      from,
      FriendId,
      UserId
    };

    if (Array.isArray(frdsoc)) {
      console.log("array ")
      frdsoc.forEach(sock => {
        if (sock.readyState === 1) {
          
          sock.send(JSON.stringify(payload));
        }
      });
    } else if (frdsoc && frdsoc.readyState === 1) {
      console.log("not array")
      frdsoc.send(JSON.stringify(payload));
    } else {
      console.log(" No active socket to deliver call accept");
    }
  }


  handleClientDisconnect(client) {
    const clientRooms = this.clients.get(client);
    if (clientRooms) {
      Array.from(clientRooms).forEach(roomId => this.Leave_Room(client, roomId));
    }
    this.rooms.delete(client);
    this.clientinfo.delete(client);
  }
}
export default RoomManager;