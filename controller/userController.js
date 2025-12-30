const axios = require("axios");
const geohash = require("ngeohash");
const User = require("../model/userModel.js");
const Ride = require("../model/rideModel.js");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const getJsonToken = require("../config/getJsonToken.js");

// Get io instance from socket config
const socketConfig = require("../config/socket.js");
const getIO = () => socketConfig.getIO();
// 1. CREATE USER (Customer)
const createUser = asyncHandler(async (req, res) => {
  const { name, email, username, password, Mobile } = req.body;

  if (!name || !email || !password || !username || !Mobile) {
    res.status(400);
    throw new Error("Please fill all data fields");
  }

  const userExists = await User.findOne({ $or: [{ username }, { email }] });

  if (userExists) {
    // If user exists, check password to allow "auto-login" or throw error
    const isMatch = await bcrypt.compare(password, userExists.password);
    if (!isMatch) {
      res.status(400);
      throw new Error(
        "Username/Email already taken. If it's yours, enter correct password."
      );
    }
    // If password matches existing user, just return them (Auto-Login)
    return res.status(200).json({
      user_name: userExists.username,
      Mobile: userExists.Mobile,
      jsonToken: getJsonToken(userExists.email, userExists._id),
    });
  }

  // Create new user
  const hashPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    name,
    email,
    username,
    Mobile,
    password: hashPassword,
  });

  res.status(201).json({
    user_name: newUser.username,
    Mobile: newUser.Mobile,
    jsonToken: getJsonToken(newUser.email, newUser._id),
  });
});

// 2. CREATE/UPGRADE RIDER
const createRider = asyncHandler(async (req, res) => {
  const { name, email, username, password, Mobile, rideType } = req.body;

  if (!name || !email || !password || !username || !Mobile || !rideType) {
    res.status(400);
    throw new Error("Please fill all fields");
  }

  const allowedRides = ["BIKE", "CAR", "AUTO"];
  if (!allowedRides.includes(rideType.toUpperCase())) {
    res.status(400);
    throw new Error("Ride type must be BIKE, CAR, or AUTO");
  }

  let user = await User.findOne({ $or: [{ username }, { email }] });

  if (user) {
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      res.status(401);
      throw new Error("Account exists, but password incorrect");
    }
    // Upgrade existing user to Rider
    user.isRider = true;
    user.rideType = rideType.toUpperCase();
    await user.save();
  } else {
    // Create new account directly as Rider
    const hashPassword = await bcrypt.hash(password, 10);
    user = await User.create({
      name,
      email,
      username,
      Mobile,
      password: hashPassword,
      isRider: true,
      rideType: rideType.toUpperCase(),
    });
  }

  res.status(201).json({
    user_name: user.username,
    Mobile: user.Mobile,
    isRider: user.isRider,
    jsonToken: getJsonToken(user.email, user._id),
  });
});

// 3. LOGIN HANDLER (General/Customer)
const LoginHandler = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  const currentUser = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });

  if (!currentUser || !(await bcrypt.compare(password, currentUser.password))) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  res.status(200).json({
    user_name: currentUser.username,
    Mobile: currentUser.Mobile,
    jsonToken: getJsonToken(currentUser.email, currentUser._id),
  });
});

// 4. LOGIN RIDER
const loginRider = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  const currentUser = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });

  if (!currentUser || !(await bcrypt.compare(password, currentUser.password))) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  if (!currentUser.isRider) {
    res.status(403);
    throw new Error("Account found, but you are not registered as a rider.");
  }

  res.status(200).json({
    user_name: currentUser.username,
    Mobile: currentUser.Mobile,
    isRider: currentUser.isRider,
    rideType: currentUser.rideType,
    jsonToken: getJsonToken(currentUser.email, currentUser._id),
  });
});

const requestRide = asyncHandler(async (req, res) => {
  const { lat, long, destlat, destlong, rideType } = req.body;

  if (
    lat === undefined ||
    long === undefined ||
    destlat === undefined ||
    destlong === undefined ||
    !rideType
  ) {
    res.status(400);
    throw new Error("All fields are required");
  }

  const customerBlock = geohash.encode(lat, long, 6);

  const url = `http://router.project-osrm.org/route/v1/driving/${long},${lat};${destlong},${destlat}?overview=false`;

  const response = await axios.get(url);

  if (!response.data || response.data.code !== "Ok") {
    return res.status(400).json({ error: "Could not calculate route" });
  }

  const routeData = response.data.routes[0];
  const distanceInMeters = routeData.distance;
  const durationInSeconds = routeData.duration;

  const distanceInKM = Number((distanceInMeters / 1000).toFixed(2));
  const durationInMin = Math.ceil(durationInSeconds / 60);

  const rates = { BIKE: 10, AUTO: 15, CAR: 25 };
  const baseFare = 20;

  const rideKey = rideType.toUpperCase();
  if (!rates[rideKey]) {
    res.status(400);
    throw new Error("Invalid ride type");
  }

  const calculatedPrice = Math.round(baseFare + distanceInKM * rates[rideKey]);

  const createRide = await Ride.create({
    createdBy: req.user._id,
    destination: [lat, long, destlat, destlong],
    distance: distanceInKM,
    duration: `${durationInMin} min`,
    rideType: rideKey,
    price: calculatedPrice,
    block_location: customerBlock,
  });

  // Populate customer info for socket emission
  const rideWithCustomer = await Ride.findById(createRide._id).populate(
    "createdBy",
    "username Mobile"
  );

  // Emit ride request to all captains in the same geohash block
  const io = getIO();
  if (io) {
    const rideData = {
      rideId: createRide._id.toString(),
      distance: distanceInKM,
      duration: `${durationInMin} min`,
      price: calculatedPrice,
      rideType: rideKey,
      status: "REQUESTED",
      destination: [lat, long, destlat, destlong],
      customer: {
        username: rideWithCustomer.createdBy?.username || "Unknown",
        mobile: rideWithCustomer.createdBy?.Mobile || "N/A",
      },
      createdAt: createRide.createdAt,
    };

    // Emit to the geohash block room
    io.to(customerBlock).emit("new_ride_request", rideData);
    console.log(
      `Ride request ${createRide._id} emitted to block: ${customerBlock}`
    );
  }

  res.status(201).json({
    rideId: createRide._id,
    distance: distanceInKM,
    duration: durationInMin,
    price: calculatedPrice,
    unit: "KM/Min",
    status: "REQUESTED",
  });
});

const cancelRide = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const canceledRide = await Ride.findByIdAndUpdate(
    id,
    { status: "CANCELLED" },
    { new: true }
  );

  if (!canceledRide) {
    res.status(404);
    throw new Error("Ride not found");
  }

  // Emit cancellation to the block room
  const io = getIO();
  if (io && canceledRide.block_location) {
    io.to(canceledRide.block_location).emit("ride_cancelled", {
      rideId: canceledRide._id.toString(),
      status: "CANCELLED",
    });
    console.log(
      `Ride cancellation ${canceledRide._id} emitted to block: ${canceledRide.block_location}`
    );
  }

  res.status(200).json({
    rideId: canceledRide._id,
    distance: canceledRide.distance,
    duration: canceledRide.duration,
    price: canceledRide.price,
    unit: "KM/Min",
    status: "CANCELLED",
  });
});

const getAllRides = asyncHandler(async (req, res) => {
  const rides = await Ride.find({
    $or: [{ createdBy: req.user._id }, { captain: req.user._id }],
  });

  res.status(200).json(
    rides.map((ride) => ({
      rideId: ride._id,
      distance: ride.distance,
      duration: ride.duration,
      price: ride.price,
      unit: "KM/Min",
      status: ride.status,
    }))
  );
});

const acceptRide = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const acceptedRide = await Ride.findByIdAndUpdate(
    id,
    { status: "ACCEPTED", captain: req.user._id },
    { new: true }
  );

  if (!acceptedRide) {
    res.status(404);
    throw new Error("Ride not found");
  }

  // Emit ride accepted to the block room (so other captains know it's taken)
  const io = getIO();
  if (io && acceptedRide.block_location) {
    io.to(acceptedRide.block_location).emit("ride_accepted", {
      rideId: acceptedRide._id.toString(),
      status: "ACCEPTED",
    });
    console.log(
      `Ride accepted ${acceptedRide._id} emitted to block: ${acceptedRide.block_location}`
    );
  }

  res.status(200).json({
    rideId: acceptedRide._id,
    distance: acceptedRide.distance,
    duration: acceptedRide.duration,
    price: acceptedRide.price,
    unit: "KM/Min",
    status: "ACCEPTED",
  });
});

const getNearbyRideRequests = asyncHandler(async (req, res) => {
  const { lat, long, rideType } = req.query;

  if (!lat || !long) {
    res.status(400);
    throw new Error("Latitude and longitude are required");
  }

  // Get current location geohash
  const currentBlock = geohash.encode(parseFloat(lat), parseFloat(long), 6);

  // Find rides in the same block or nearby blocks
  // Status should be REQUESTED and rideType should match (if provided)
  const query = {
    status: "REQUESTED",
    block_location: currentBlock,
  };

  if (rideType) {
    query.rideType = rideType.toUpperCase();
  }

  const nearbyRides = await Ride.find(query)
    .populate("createdBy", "username Mobile")
    .sort({ createdAt: -1 })
    .limit(20);

  res.status(200).json(
    nearbyRides.map((ride) => ({
      rideId: ride._id,
      distance: ride.distance,
      duration: ride.duration,
      price: ride.price,
      rideType: ride.rideType,
      status: ride.status,
      destination: ride.destination,
      customer: {
        username: ride.createdBy?.username || "Unknown",
        mobile: ride.createdBy?.Mobile || "N/A",
      },
      createdAt: ride.createdAt,
    }))
  );
});

// Mark ride as picked up (ONGOING)
const pickupRide = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const ride = await Ride.findById(id);

  if (!ride) {
    res.status(404);
    throw new Error("Ride not found");
  }

  // Verify captain owns this ride
  if (ride.captain.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("You are not authorized to update this ride");
  }

  if (ride.status !== "ACCEPTED") {
    res.status(400);
    throw new Error(`Ride cannot be picked up. Current status: ${ride.status}`);
  }

  const updatedRide = await Ride.findByIdAndUpdate(
    id,
    { status: "ONGOING" },
    { new: true }
  )
    .populate("createdBy", "username Mobile")
    .populate("captain", "username Mobile");

  // Emit pickup notification
  const io = getIO();
  if (io) {
    io.to(updatedRide._id.toString()).emit("ride_picked_up", {
      rideId: updatedRide._id.toString(),
      status: "ONGOING",
    });
    console.log(`Ride ${updatedRide._id} picked up - status: ONGOING`);
  }

  res.status(200).json({
    rideId: updatedRide._id,
    distance: updatedRide.distance,
    duration: updatedRide.duration,
    price: updatedRide.price,
    status: updatedRide.status,
  });
});

// Mark ride as completed
const completeRide = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const ride = await Ride.findById(id);

  if (!ride) {
    res.status(404);
    throw new Error("Ride not found");
  }

  // Verify captain owns this ride
  if (ride.captain.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("You are not authorized to update this ride");
  }

  if (ride.status !== "ONGOING") {
    res.status(400);
    throw new Error(`Ride cannot be completed. Current status: ${ride.status}`);
  }

  const updatedRide = await Ride.findByIdAndUpdate(
    id,
    { status: "COMPLETED" },
    { new: true }
  )
    .populate("createdBy", "username Mobile")
    .populate("captain", "username Mobile");

  // Emit completion notification
  const io = getIO();
  if (io) {
    io.to(updatedRide._id.toString()).emit("ride_completed", {
      rideId: updatedRide._id.toString(),
      status: "COMPLETED",
    });
    console.log(`Ride ${updatedRide._id} completed`);
  }

  res.status(200).json({
    rideId: updatedRide._id,
    distance: updatedRide.distance,
    duration: updatedRide.duration,
    price: updatedRide.price,
    status: updatedRide.status,
  });
});

// Get active ride for captain or customer
const getActiveRide = asyncHandler(async (req, res) => {
  const activeRide = await Ride.findOne({
    $or: [{ createdBy: req.user._id }, { captain: req.user._id }],
    status: { $in: ["ACCEPTED", "ONGOING"] },
  })
    .populate("createdBy", "username Mobile")
    .populate("captain", "username Mobile rideType")
    .sort({ createdAt: -1 });

  if (!activeRide) {
    return res.status(200).json(null);
  }

  res.status(200).json({
    rideId: activeRide._id,
    distance: activeRide.distance,
    duration: activeRide.duration,
    price: activeRide.price,
    rideType: activeRide.rideType,
    status: activeRide.status,
    destination: activeRide.destination, // [pickupLat, pickupLng, dropoffLat, dropoffLng]
    customer: {
      username: activeRide.createdBy?.username || "Unknown",
      mobile: activeRide.createdBy?.Mobile || "N/A",
    },
    captain: activeRide.captain
      ? {
          username: activeRide.captain.username || "Unknown",
          mobile: activeRide.captain.Mobile || "N/A",
          rideType: activeRide.captain.rideType || "N/A",
        }
      : null,
    createdAt: activeRide.createdAt,
  });
});

module.exports = {
  LoginHandler,
  createUser,
  createRider,
  loginRider,
  requestRide,
  cancelRide,
  getAllRides,
  acceptRide,
  getNearbyRideRequests,
  pickupRide,
  completeRide,
  getActiveRide,
};
