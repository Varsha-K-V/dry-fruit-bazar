const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
        required: true,
      },
      weight: String, 
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      total: {
        type: Number,
        required: true,
      }
    }
  ],
  shippingAddress: {
    name: String,
    addresstype: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    phone: String,
    alternativeNo: String
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ["COD", "ONLINE","WALLET"],
    default: "COD"
  },
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled","Returned"],
    default: "Pending",
    required: true,
  },

  paymentStatus:{
    type:String,
    enum:["Confirmed","Pending","Refunded"],
  },

  returnRequest: {
    status: {
      type: String,
      enum: ["Not Requested", "Pending", "Approved", "Rejected"],
      default: "Not Requested"
    },
    reason: {
      type: String,
    },
    requestDate: {
      type: Date,
    }
  },
  coupon: {
    code: { type: String },
    discount: { type: Number } 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
