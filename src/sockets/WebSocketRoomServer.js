import { WebSocketServer } from "ws";
import RoomManager from "./RoomManager.js";
import redis from "./Redis.js";
import jwt from "jsonwebtoken";
import url from "url";
import { v4 as uuidv4 } from "uuid";

class WebSocketRoomServer {
  constructor(port = 8080) {
    this.userSockets = new Map();
    this.roomManager = new RoomManager();
    this.wss = new WebSocketServer({ port });
    console.log(`WebSocket server started on port ${port}`);

    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
  }

  async handleConnection(ws, req) {
    console.log("New client trying to connect...");

    const query = url.parse(req.url, true).query;

    let token = query.token;

    if (token && token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }
    const secret = "ADNAN";

    let userId;
    try {
      const decoded = jwt.verify(token, secret);
      userId = decoded.id;
      ws.userId = userId;
      console.log("✅ User authenticated:", userId);
    } catch (err) {
      console.error("Invalid token:", err.message);
      ws.close();
      return;
    }

    // Assign unique connection ID
    const connectionId = uuidv4();
    ws.connectionId = connectionId;

    // Save socket in memory map
    const sockets = this.userSockets.get(userId) || [];
    sockets.push(ws);
    this.userSockets.set(userId, sockets);

    // Save socket in Redis
    await redis.sAdd(`user_sockets:${userId}`, connectionId);

    // Deliver any pending notifications
    await this.deliverPendingNotifications(userId, ws);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMsg(ws, msg);
      } catch (error) {
        console.error("Invalid Message:", error.message);
      }
    });

    ws.on("close", async () => {
      console.log(` Client disconnected: ${userId}`);
      this.removeSocket(userId, ws);
      this.roomManager.handleClientDisconnect(ws);
      await redis.sRem(`user_sockets:${userId}`, ws.connectionId);
    });
  }

  removeSocket(userId, ws) {
    const sockets = this.userSockets.get(userId) || [];
    const updated = sockets.filter((s) => s !== ws);
    if (updated.length > 0) {
      this.userSockets.set(userId, updated);
    } else {
      this.userSockets.delete(userId);
    }
  }

  async handleMsg(client, message) {
    console.log("Message from client", message);
    const { type, roomId, data, UserId, FriendId, msgType, from } = message;
    console.log(`Received: ${type} for room: ${roomId}`);

    switch (type) {
      case "join_room":
        this.roomManager.JoinRoom(client, roomId, data);
        break;
      case "direct_message":
        const friendSockets = this.userSockets.get(FriendId) || [];
        console.log("inside Direct message, sockets:", friendSockets.length);

        if (friendSockets.length > 0) {
          this.roomManager.DirectMessage(UserId, FriendId, data, msgType, client, friendSockets);
        } else {
          await this.storePendingNotification(FriendId, {
            from: UserId,
            data,
            msgType,
            timestamp: Date.now(),
          });
        }
        break;
      case "webrtc_call_request":
        const frdsocket = this.userSockets.get(FriendId) || [];
        console.log("inside web message, sockets:", frdsocket.length);

        if (frdsocket.length > 0) {
          this.roomManager.Callhanderler(FriendId, UserId, from, client, frdsocket);
        }
        break;
      case "leave_room":
        this.roomManager.Leave_Room(client, roomId);
        break;

      case "create_room":
        const newRoomId = this.roomManager.CreateRoom(client, roomId);
        this.roomManager.sendToClient(client, {
          type: "room_created",
          roomId: newRoomId,
        });
        break;
      case "open_chat":
        console.log("iside open chat")
        this.roomManager.handleopenchat(client, UserId, FriendId);
        break;
      case "webrtc_ice_candidate":
         console.log("friedn",FriendId);
        const frdicecan = this.userSockets.get(FriendId) || [];
        if(frdicecan.length>0){
        this.roomManager.handleicecandidate(FriendId, data, client, frdicecan);        }
        else{
         console.log("eroor ");
        }
        


        break;
      case "webrtc_offer":
 console.log("friedn",FriendId);
        const frdsocoffer = this.userSockets.get(FriendId) || [];
        if(frdsocoffer.length>0){
        this.roomManager.handleoffer(FriendId, data, client, frdsocoffer);
        }
        else{
         console.log("eroor ");
        }
       

        break;
      case "webrtc_answer":

        this.roomManager.handleanswer(from, data, frdsocket)

        break;
      case "room_message":
        this.roomManager.handleRoomMsg(roomId, client, data);
        break;
      case "webrtc_call_accept":
        console.log("friedn",FriendId);
        const frdsoc = this.userSockets.get(FriendId) || [];
        if(frdsoc.length>0){
        this.roomManager.handleAcceptcall(FriendId,from,UserId, client, frdsoc);
        }
        else{
         console.log("eroor ");
        }
        
        

        break;
      default:
        this.roomManager.sendToClient(client, {
          type: "error",
          message: `Unknown message type: ${type}`,
        });
    }
  }

  deliverPendingNotifications = async (userId, socket) => {
    const key = `notifications:${userId}`;
    const notifications = await redis.lRange(key, 0, -1);

    if (notifications.length > 0) {
      notifications.forEach((n) => {
        socket.send(JSON.stringify({ type: "notification", data: JSON.parse(n) }));
      });
      await redis.del(key);
    }
  };

  storePendingNotification = async (userId, notification) => {
    await redis.lPush(`notifications:${userId}`, JSON.stringify(notification));
  };

  notifyUser(userId, payload) {
    const sockets = this.userSockets.get(userId) || [];
    sockets.forEach((socket) => {
      if (socket.readyState === 1) socket.send(JSON.stringify(payload));
    });
  }
}

export default WebSocketRoomServer;
