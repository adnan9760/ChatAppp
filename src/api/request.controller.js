// server.js or routes/friendRequest.js
import express from 'express';
import crypto from 'crypto'
const dbconnect = require('./lib/Dbconnect'); // your DB connection
import { User } from '../models/UserModel';
import { FriendRequest } from '../models/FriendRequestModel';
import mailSender from '../utils/mailSender'
const router = express.Router();
import { Friendship } from '../models/FrindModel';

router.use(express.json());

router.post('/send', async (req, res) => {
  try {
    const { email } = req.body;
    const currentUser = req.user; 

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Email is not valid' });
    }

    if (email === currentUser.email) {
      return res.status(400).json({ error: "You can't send self request" });
    }

    const alreadySent = await FriendRequest.findOne({ toUser: email, fromUser: currentUser.email });
    if (alreadySent) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    const toUser = await User.findOne({ email });
    if (toUser && await areAlreadyFriends(toUser._id, currentUser._id)) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const friendrequest = new FriendRequest({
      toUser: email,
      fromUser: currentUser.email,
      token
    });
    await friendrequest.save();

    if (toUser) {
      await sendFriendRequestEmail(currentUser, toUser, token);
    } else {
      await sendInviteEmail(currentUser, email, token);
    }

    res.status(200).json({
      message: 'Friend request sent successfully',
      type: toUser ? 'friend_request' : 'invite'
    });

  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utility functions
function validateEmail(email) {
  // basic email regex check
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
}

async function areAlreadyFriends(userId1, userId2) {
  const user1 = await User.findById(userId1).populate('friends');
  if (!user1) return false;
  return user1.friends.some(friend => friend._id.toString() === userId2.toString());
}

async function sendFriendRequestEmail(fromUser, toUser, token) {
  const acceptUrl = `${process.env.FRONTEND_URL}/friends/accept?token=${token}`;
  const rejectUrl = `${process.env.FRONTEND_URL}/friends/reject?token=${token}`;

  const htmlContent = `
    <div>
      <h2>Friend Request</h2>
      <p>Hi ${toUser.name},</p>
      <p><strong>${fromUser.name}</strong> (${fromUser.email}) has sent you a friend request!</p>
      <a href="${acceptUrl}">Accept Request</a> | 
      <a href="${rejectUrl}">Reject Request</a>
      <p>This link will expire in 7 days.</p>
    </div>
  `;

  await sendMail({
    from: process.env.EMAIL_FROM,
    to: toUser.email,
    subject: `${fromUser.name} sent you a friend request`,
    html: htmlContent
  });
}

async function sendInviteEmail(fromUser, toEmail, token) {
  const signupUrl = `${process.env.FRONTEND_URL}/signup?invite=${token}&email=${encodeURIComponent(toEmail)}`;

  const htmlContent = `
    <div>
      <h2>You're Invited!</h2>
      <p><strong>${fromUser.name}</strong> (${fromUser.email}) has invited you to join our platform!</p>
      <a href="${signupUrl}">Join & Accept Friend Request</a>
      <p>This invitation will expire in 7 days.</p>
    </div>
  `;

  await sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `${fromUser.name} invited you to join our platform`,
    html: htmlContent
  });
}


// router.post('/accept',async(req,res)=>{
// try {
//   const {request_id} = req.body;

//   const request = await FriendRequest.findById(request_id);

//   console.log("request",request);
//    if (!request) {
//       return res.status(404).json({ message: "Friend request not found" });
//     }
//   if(request.reciever_id !== req.user.id){
//     return res.status(403).json({ message: "Not authorized to accept this request" });
//   }
//   request.status='accepted';
//   await request.save();
//   await User.findByIdAndUpdate(request.requester_id,{
//     $addToSet :{
//       friends:request.reciever_id
//     }
//   })

//   await User.findByIdAndUpdate(request.reciever_id,{
//     $addToSet :{
//       friends:request.requester_id
//     }
//   })

//    await notificationQueue.add("friend_request_accepted", {
//       senderId: request.reciever_id,
//       receiverId: request.reciever_id,
//       message: `${req.user.name} accepted your friend request`,
//     });

//      res.json({ message: "Friend request accepted successfully" });


// } catch (error) {
//    console.error(error);
//     res.status(500).json({ message: "Server error" });
// }
// })
router.post("/accept", async (req, res) => {
  try {
    const userId = req.user.id;
    const { requesterId } = req.body;

    if (!requesterId) {
      return res.status(400).json({ message: "requesterId is required" });
    }

    const [user1, user2] = await Promise.all([
      User.findById(userId),
      User.findById(requesterId),
    ]);
    if (!user1 || !user2) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingFriendship = await Friendship.findOne({
      $or: [
        { user1_id: userId, user2_id: requesterId },
        { user1_id: requesterId, user2_id: userId },
      ],
    });

    if (existingFriendship) {
      return res
        .status(400)
        .json({ message: "Friendship already exists" });
    }

    const friendship = await Friendship.create({
      user1_id: userId,
      user2_id: requesterId,
      chat_room_id: uuidv4(),
    });
   await notificationQueue.add("friend_request_accepted", {
      senderId: requesterId,
      receiverId: userId,
      message: `${req.user.name} accepted your friend request`,
    });

    return res.status(201).json({
      message: "Friend request accepted",
      friendship,
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id; 

    const friendships = await Friendship.find({
      status: "active",
      $or: [
        { user1_id: userId },
        { user2_id: userId }
      ]
    })
      .populate("user1_id", "username email") 
      .populate("user2_id", "username email"); 

    const friends = friendships.map(friendship => {
      if (friendship.user1_id._id.toString() === userId.toString()) {
        return friendship.user2_id; 
      } else {
        return friendship.user1_id; 
      }
    });

    return res.json({ success: true, friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.body; 
    const userId = req.user._id;    

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (friendRequest.receiver.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to reject this request" });
    }

    friendRequest.status = "rejected";
    await friendRequest.save();

    return res.status(200).json({ message: "Friend request rejected successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPendingUser = async (req, res) => {
  try {
    const userId = req.user.id; 

     const pendingRequests = await FriendRequest.find({
      reciever_id: userId,
      status: "pending",
    }).populate("requester_id", "username email"); 

    

    return res.json({ success: true, friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = router;


