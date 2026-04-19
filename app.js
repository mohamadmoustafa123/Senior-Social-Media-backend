const express =require("express");
const mongoose=require("mongoose");
const dotenv=require("dotenv");
const cors=require("cors");
const authRoutes=require("./routes/auth")
const postRoutes=require("./routes/posts")
const freindRoutes=require("./routes/freinds")
const storyRoutes=require("./routes/story")
const commentsRoutes=require("./routes/comments")
const voiceRoutes=require("./routes/voice")
dotenv.config();
const app=express();

app.use(cors({
  origin: "http://localhost:3001",  
  credentials: true                 
}));

app.use(express.json());
const cookieParser=require("cookie-parser");
app.use(cookieParser())

app.use("/uploads", express.static("uploads"));
app.use("/publicImg", express.static("publicImg"));
app.use("/api/auth",authRoutes);
app.use("/api/posts",postRoutes);
app.use("/api/freinds",freindRoutes)
app.use("/api/stories",storyRoutes)
app.use("/api/comments",commentsRoutes)
app.use("/api/voice",voiceRoutes)

mongoose.connect(process.env.MONGO_URL)
.then(()=>{
    console.log("connected to MongDB");
    app.listen(process.env.PORT,()=>{
        console.log("server running on port ",process.env.PORT)
    })
})
.catch((err)=>{
    console.error("Database connection error",err)
})
