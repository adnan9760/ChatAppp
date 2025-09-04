import express from 'express';
import crypto from 'crypto'
import { User } from '../models/UserModel.js';
import { FriendRequest } from '../models/FriendRequestModel.js';
import mailSender from '../utils/mailSender.js'
import { v4 as uuidv4 } from "uuid";
import { Friendship } from '../models/FrindModel.js';

export const FriendRequests = async (req, res) => {
  try {
    const { email } = req.body;
    const currentUser = req.user; 

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: "Email is not valid" });
    }

    if (email === currentUser.email) {
      return res.status(400).json({ error: "You can't send self request" });
    }

    const alreadySent = await FriendRequest.findOne({
      recipient_email: email,
      request_email: currentUser.email,
    });
    if (alreadySent) {
      return res.status(400).json({ error: "Friend request already sent" });
    }

    const toUser = await User.findOne({ email });
    if (toUser && (await areAlreadyFriends(toUser._id, currentUser._id))) {
      return res.status(400).json({ error: "You are already friends" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const friendrequest = new FriendRequest({
      recipient_email: email,
      request_email: currentUser.email,
      token_hash: token,
      recipient_id: toUser ? toUser._id : null,
      requester_id:currentUser.id
    });
    await friendrequest.save();

    const userDoc = await User.findById(currentUser._id);
    if (userDoc) {
      userDoc.requested.push(friendrequest._id);
      await userDoc.save();
    }

    if (toUser) {
      await sendFriendRequestEmail(currentUser, toUser, token);
    } else {
      await sendInviteEmail(currentUser, email, token);
    }

    res.status(200).json({
      message: "Friend request sent successfully",
      type: toUser ? "friend_request" : "invite",
      success: true,
    });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({ error: "Internal server error", success: false });
  }
};

function validateEmail(email) {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
}

async function areAlreadyFriends(userId1, userId2) {
  const user1 = await User.findById(userId1).populate('friends');
  if (!user1) return false;
  return user1.friends.some(friend => friend._id.toString() === userId2.toString());
}

async function sendFriendRequestEmail(fromUser, toUser, token) {
  const acceptUrl = `http://localhost:3000/friends/accept?token=${token}`;
  const rejectUrl = `http://localhost:3000/friends/reject?token=${token}`;

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

  await mailSender({
    to: toUser.email,
    subject: `${fromUser.name} sent you a friend request`,
    html: htmlContent
  });
}

async function sendInviteEmail(fromUser, toEmail, token) {
  const signupUrl = `http://localhost:3000/signup?invite=${token}&email=${encodeURIComponent(toEmail)}`;

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f7fb; padding: 20px; color: #333;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <tr>
        <td style="background: linear-gradient(90deg, #4f46e5, #3b82f6); padding: 20px; text-align: center; color: #fff;">
          <h1 style="margin: 0; font-size: 24px;">You're Invited 🎉</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px; text-align: left; font-size: 16px; line-height: 1.6; color: #444;">
          <p><strong>${fromUser.name}</strong> (<a href="mailto:${fromUser.email}" style="color: #3b82f6; text-decoration: none;">${fromUser.email}</a>) has invited you to join our platform!</p>
          <p style="margin: 20px 0; text-align: center;">
            <a href="${signupUrl}" style="display: inline-block; background: #4f46e5; color: #fff; font-size: 16px; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              🚀 Join & Accept Friend Request
            </a>
          </p>
          <p style="font-size: 14px; color: #666;">This invitation will expire in <strong>7 days</strong>.</p>
        </td>
      </tr>
      <tr>
        <td style="background: #f4f7fb; padding: 15px; text-align: center; font-size: 13px; color: #888;">
          © ${new Date().getFullYear()} Our Platform · All Rights Reserved
        </td>
      </tr>
    </table>
  </div>
`;


  await mailSender({
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
 export const AcceptFriendRequest =  async (req, res) => {
  try {
    const userId = req.user.id;
    const useremail= req.user.email;
    const { id } = req.body;
console.log("idddd in accerept ",id);
    if (!id) {
      return res.status(400).json({ message: "requesterId is required" });
    }

    const [user1, user2] = await Promise.all([
      User.findById(userId),
      User.findById(id),
    ]);
    if (!user1 || !user2) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingFriendship = await Friendship.findOne({
      $or: [
        { user1_id: userId, user2_id: id },
        { user1_id: id, user2_id: userId },
      ],
    });

    if (existingFriendship) {
      return res
        .status(400)
        .json({ message: "Friendship already exists" });
    }

    const friendship = await Friendship.create({
      user1_id: userId,
      user2_id: id,
      chat_room_id: uuidv4(),
    });

   await FriendRequest.findOneAndDelete({
      recipient_id: userId,  
      requester_id: id,      
    });


  //  await notificationQueue.add("friend_request_accepted", {
  //     senderId: id,
  //     receiverId: userId,
  //     message: `${req.user.name} accepted your friend request`,
  //   });

    return res.status(201).json({
      message: "Friend request accepted",
      friendship,
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const friendships = await Friendship.find({
      $or: [{ user1_id: userId }, { user2_id: userId }],
    })
      .populate("user1_id", "username email _id")
      .populate("user2_id", "username email _id");

    let friends = friendships.map((friendship) => {
      if (
        friendship.user1_id &&
        friendship.user1_id._id.toString() === userId.toString()
      ) {
        return friendship.user2_id;
      } else {
        return friendship.user1_id;
      }
    });

    const uniqueFriends = [
      ...new Map(friends.map((f) => [f._id.toString(), f])).values(),
    ];

    return res.json({ success: true, friends: uniqueFriends });
  } catch (err) {
    console.error("Error fetching friends:", err);
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

export const getfriendRequest = async (req, res) => {
  try {
    const email = req.user.email;

    const friendRequests = await FriendRequest.find({
      recipient_email: email,
    }).populate("request_email", "username email created_at"); 

    const senderEmails = friendRequests.map((req) => req.request_email);

    const friendDetails = await User.find({
      email: { $in: senderEmails },
    }).select("username email created_at");

    return res.json({
      success: true,
      requests: friendRequests,
      senders: friendDetails,
    });
  } catch (err) {
    console.error("Error fetching friend requests:", err);
    res.status(500).json({ success: false, message: "Server error" });
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




