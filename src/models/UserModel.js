import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema, model } = mongoose;

const userSchema = new Schema({
  user_id: {
    type: String, // UUID as string
    required: true,
    unique: true,
    default: uuidv4,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  profile_picture: {
    type: String, // Store URL or base64
    default: null,
  },
   friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  is_verified: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  last_seen: {
    type: Date,
    default: Date.now,
  },
});

export const User = model("User", userSchema);
