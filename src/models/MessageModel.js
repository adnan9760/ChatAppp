


import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema, model, Types } = mongoose;

const messageSchema = new Schema(
  {
    message_id: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4, 
    },
    conversation_id: {
     type: mongoose.Schema.Types.ObjectId, 
         required: true,
         ref:"Conversation"
    },
    sender_id: {
     type: mongoose.Schema.Types.ObjectId, 
         required: true,
         ref:"User"
    },
    content: {
      type: String,
      required: true,
    },
    message_type: {
      type: String,
      enum: ["text", "image", "video", "file"], 
      required: true,
      default: "text",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    edited_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false, 
  }
);

export const Message = model("Message", messageSchema);

