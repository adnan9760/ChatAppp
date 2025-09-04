import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const connect = () => {
  mongoose.connect('mongodb+srv://ak9760049:WhKTOh8fLHSGd9MD@cluster0.uywa44u.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0',{
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log(" DB connected successfully",mongoose.connection.name);
  })
  .catch((error) => {
    console.error(" DB not connected");
    console.error(error);
    process.exit(1);
  });
};

export default connect;
