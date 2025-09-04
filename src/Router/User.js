import { sendOTP, signup, login, changePassword, logout } from "../api/auth.controller.js";
import { FriendRequests ,getfriendRequest,AcceptFriendRequest,getFriends} from "../api/request.controller.js";
import { auth } from "../Middleware/auth.js";
import express from "express";

const router = express.Router();  

router.post("/sendOtp",sendOTP)

router.post("/login", login);
router.post("/register",signup);
router.get("/getfriend",auth,getFriends);

router.post("/friendrequest",auth,FriendRequests);
router.get("/getfriendrequest",auth,getfriendRequest)
router.post("/accpetfriendrequest",auth,AcceptFriendRequest);


export default router;



