import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema, model } = mongoose;

const friendRequestSchema = new Schema({
  request_id: {
    type: String, // UUID as string
    required: true,
    unique: true,
    default: uuidv4,
  },
  requester_id: {
    type:mongoose.Schema.Types.ObjectId,
    required: true,
    ref:'User'
  },
  reciever_id: {
    type:mongoose.Schema.Types.ObjectId,
    required: true,
    ref:'User'
  },
  recipient_email: {
    type: String,
    required: true,
  },
  recipient_id: {
    type: String,
    default: null,
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
    required: true,
  },
});

export const FriendRequest = model("FriendRequest", friendRequestSchema);
