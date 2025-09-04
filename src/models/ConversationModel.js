
import mongoose from "mongoose";
const { Schema, model } = mongoose;
const conversationSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  ],
  created_at: { type: Date, default: Date.now }
});

export const Conversation = model("Conversation", conversationSchema);
