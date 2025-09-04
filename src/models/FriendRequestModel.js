import mongoose from "mongoose";
import { type } from "os";
import { v4 as uuidv4 } from "uuid";

const { Schema, model } = mongoose;

const friendRequestSchema = new Schema({
  request_id: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  requester_id: {
    type:mongoose.Schema.Types.ObjectId,
    ref:'User'
  },
  request_email:{
    type: String,
    required: true,

  },
  reciever_id: {
    type:mongoose.Schema.Types.ObjectId,
    ref:'User'
  },
  recipient_email: {
    type: String,
    required: true,
    ref:"User"
  },
  reciever_email: {
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },
  recipient_id: {
    type:mongoose.Schema.Types.ObjectId,
     ref:"User"
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  token_hash: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  expires_at: {
    type: Date,
    // required: true,
  },
});

export const FriendRequest = model("FriendRequest", friendRequestSchema);
