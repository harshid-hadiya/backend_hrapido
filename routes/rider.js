const express=require("express");
const { createRider, loginRider, acceptRide } = require("../controller/userController");
const validatejson = require("../middleware/validate");
const rider=express.Router();
rider.route("/register").post(createRider)
rider.route("/login").post(loginRider)
rider.route("/accept_ride").put(validatejson,acceptRide)

module.exports=rider;