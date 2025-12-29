const mongoose = require("mongoose");

const rideSchema = mongoose.Schema({
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    destination: { type: [Number], required: true }, 
    distance: { type: Number }, 
    duration: { type: String }, 
    rideType: { 
        type: String, 
        enum: ["BIKE", "CAR", "AUTO"], 
        default: "BIKE" 
    },
    price: { type: Number },
    block_location: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ["REQUESTED", "ONGOING", "COMPLETED", "CANCELLED"], 
        default: "REQUESTED" 
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

const Ride = mongoose.model("Ride", rideSchema);
module.exports = Ride;
