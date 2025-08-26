import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema, model } = mongoose;

const notificationSchema = new Schema({
  notification_id: {
    type: String, // UUID as string
    required: true,
    unique: true,
    default: uuidv4,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref:"User", 
    required: true,
  },
  type: {
    type: String, 
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: Schema.Types.Mixed, 
    default: {},
  },
  status: {
    type: String,
    enum: ["unread", "read"], 
    default: "unread",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

export const Notification = model("Notification", notificationSchema);
