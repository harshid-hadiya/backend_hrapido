const mongoose=require("mongoose")
const userModel=mongoose.Schema({
  name:{type:String,required:true,trim:true},
  username:{type:String,required:true,trim:true,unique:true},
  isRider:{type:Boolean,default:false},
  rideType:{type:String,enum:["BIKE","CAR","AUTO"],default:""},
  email:{type:String,required:true,trim:true},
  password:{type:String,required:true},
  Mobile:{type:Number,required:[true,"without mobile number how we contact you ?"]} 
},{timestamps:true})
const User=mongoose.model("User",userModel);
module.exports=User;