const express=require("express");
const { createRider, loginRider, acceptRide, getNearbyRideRequests, pickupRide, completeRide, getActiveRide } = require("../controller/userController");
const validatejson = require("../middleware/validate");
const rider=express.Router();
rider.route("/register").post(createRider)
rider.route("/login").post(loginRider)
rider.route("/accept_ride").put(validatejson,acceptRide)
rider.route("/nearby_requests").get(validatejson,getNearbyRideRequests)
rider.route("/pickup_ride").put(validatejson,pickupRide)
rider.route("/complete_ride").put(validatejson,completeRide)
rider.route("/active_ride").get(validatejson,getActiveRide)

module.exports=rider;