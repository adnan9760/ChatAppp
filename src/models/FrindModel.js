import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema, model } = mongoose;

const friendshipSchema = new Schema({
  friendship_id: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  user1_id: {
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref:"User"
  },
  user2_id: {
   type: mongoose.Schema.Types.ObjectId, // UUID as string, reference to User
    required: true,
    ref:"User"
  },
  status: {
    type: String,
    enum: ["active", "blocked"],
    default: "active",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  chat_room_id: {
    type: String,
    required: true,
    
  },
});

export const Friendship = model("Friendship", friendshipSchema);
