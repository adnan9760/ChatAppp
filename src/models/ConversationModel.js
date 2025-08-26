import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const conversationSchema = new Schema(
  {
    conversation_id: {
      type: Schema.Types.UUID || String, 
      required: true,
      unique: true,
      default: () => new Types.ObjectId().toString(),
    },
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    participants: [
      {
        type: String, 
        required: true,
      },
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    last_message_at: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed, 
      default: {},
    },
  },
  {
    timestamps: false, 
  }
);

export const Conversation = model("Conversation", conversationSchema);