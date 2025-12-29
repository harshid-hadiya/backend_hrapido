const jwt=require("jsonwebtoken")
// here in this we are put data into the encryption and json sign where we get the token

const getJsonToken=(email,_id) => {
    const user={
        email:email,
        _id:_id
    }
    const data=jwt.sign(user,process.env.BACKEND_JWT_SECRET_KEY,{
        expiresIn:"1d"
    });
    return data;
}
module.exports=getJsonToken