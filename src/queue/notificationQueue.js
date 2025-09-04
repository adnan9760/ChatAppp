import { Queue, tryCatch, Worker } from "bullmq";
import redis from "../sockets/Redis";
import { Notification} from "../models/Notification";

import {storePendingNotification,getUserSocket} from "../sockets/WebSocketRoomServer";
const notificationQueue = new Queue("notifications", {
    redis: {
        host: "127.0.0.1",
        port: 6379,
    }
});

export const addNotificationToQueue = async (notificationData) => {
    await notificationQueue.add(notificationData, {
        attempts: 3,
        backoff: 5000,
        removeOnComplete: true,
        removeOnFail: false,
    });
};
await notificationQueue.add("friend_request_accepted", {
    senderId: requesterId,
    receiverId: userId,
    message: `${req.user.name} accepted your friend request`,
});

notificationQueue.process(async (Job, done) => {
    try {
        console.log("job data", Job.data)
        const { user_id, type, title, message, data } = Job.data;

        const notificationdata = await Notification.create({
            user_id,
            type,
            title,
            message,
            data,
        })

        const socket =getUserSocket(user_id);

        if(socket){
        socket.emit("notification", notificationdata);
        }

        storePendingNotification(user_id,notificationdata);


done();


    } catch (error) {
     console.error("Notification processing failed:", error);
    done(err);
    }
})