const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {  
        type: String,
        required: true
      },
    alternativeNo: {
        type: Number,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    landmark: {
        type: String,
        required: true,
    },
    addresstype: {
        type: String,
        enum: ['Home', 'Office', 'Other'],
        default: 'Home',
        set: function (value) {
            if (typeof value === 'string') {
                return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
            }
            return value;
        }
    },
}, {
    timestamps: true,
});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
