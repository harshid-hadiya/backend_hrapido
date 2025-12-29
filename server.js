const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connection = require("./config/db.js");
const { notFound, errorHandler } = require("./middleware/errorhanler.js");

dotenv.config();
const app = express();
connection();

app.use(express.json());
app.use(cors({
    origin: "*"
}));

app.use("/api/customer/", require("./routes/customer.js"));
app.use("/api/rider/", require("./routes/rider.js"));
app.use(notFound);
app.use(errorHandler);

let server = app.listen(process.env.BACKEND_PORT, () => {
    console.log(`Server is running on port ${process.env.BACKEND_PORT}`);
});

const io = require("socket.io")(server, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    }
});

// Socket.IO setup for real-time communication
io.on("connection", (socket) => {
    console.log("Socket Connected: ", socket.id);

    // Join a room based on the user's current location
    socket.on("join_current_location", (data) => {
        socket.join(data);
        console.log(`Socket ${socket.id} joined location room: ${data}`);
    });

    // Leave the previous location room and join a new one
    socket.on("leave_current_location", (data) => {
        socket.leave(data.previous);
        socket.join(data.current);
        console.log(`Socket ${socket.id} moved from ${data.previous} to ${data.current}`);
    });

    // Join a ride room
    socket.on("join_ride", (data) => {
        socket.join(data);
        console.log(`Socket ${socket.id} joined ride room: ${data}`);
    });

    // Leave a ride room
    socket.on("leave_ride", (data) => {
        socket.leave(data);
        console.log(`Socket ${socket.id} left ride room: ${data}`);
    });

    // Send location updates to the captain
    socket.on("sending_location_to_captain", (data) => {
        socket.to(data.rideId).emit("receiving_location_to_captain", data);
        console.log(`Location sent to captain in ride ${data.rideId}`);
    });

    // Send location updates to the customer
    socket.on("sending_location_to_customer", (data) => {
        socket.to(data.rideId).emit("receiving_location_to_customer", data);
        console.log(`Location sent to customer in ride ${data.rideId}`);
    });

    // Notify the customer that the ride request has been accepted
    socket.on("accept_ride_request", (data) => {
        socket.to(data.rideId).emit("ride_request_accepted", data);
        console.log(`Ride request accepted for ride ${data.rideId}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`Socket Disconnected: ${socket.id}`);
    });
});