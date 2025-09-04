import WebSocketRoomServer from "./WebSocketRoomServer.js";
import connect from "../utils/databse.js";
connect();
const server = new WebSocketRoomServer();

