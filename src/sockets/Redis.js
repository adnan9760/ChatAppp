import { createClient } from "redis";

<<<<<<< HEAD
=======
// Remote Redis URL
>>>>>>> 63aa0d7ed60ef7a213f71deba31fc62f26468487
const REDIS_URL = "redis://default:Eq8eXdUZ6PXsqi4o76aLu8HuHAUuOmOL@redis-17683.c14.us-east-1-2.ec2.redns.redis-cloud.com:17683";

const redis = createClient({
  url: REDIS_URL
});

redis.on("error", (err) => console.error("Redis Client Error", err));

await redis.connect();

console.log("Connected to remote Redis!");

export default redis;
