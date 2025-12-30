const jwt=require("jsonwebtoken");
const asyncHandler=require("express-async-handler");

const validatejson=asyncHandler((req,res,next)=>{
 const authHeader=req.headers.Authorization || req.headers.authorization;

 
 if (authHeader && authHeader.startsWith("Bearer")) {
    const token=authHeader.split(" ")[1];
    
    jwt.verify(token,process.env.BACKEND_JWT_SECRET_KEY,(err,decoded)=>{
       
        
        if (err) {
            console.log(err);
            
            res.status(401);
            throw new Error("You Have To Login First");
        }
        else{
            req.user=decoded;
            
            next();
        }
    })
 }
 else{
    return res.status(401).json({message:"You Have To Login First"})
 }
})
module.exports=validatejson;