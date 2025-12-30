const express=require("express");
const user=express.Router();
const{createUser,LoginHandler, requestRide, cancelRide, getAllRides, getActiveRide}=require("../controller/userController.js")
const validatejson = require("../middleware/validate.js")

user.route("/register").post(createUser)
user.route("/login").post(LoginHandler)
user.route("/request").post(validatejson,requestRide)
user.route("/cancleRide/:id").get(validatejson,cancelRide)
user.route("/getRides").get(validatejson,getAllRides)
user.route("/active_ride").get(validatejson,getActiveRide)

module.exports=user

