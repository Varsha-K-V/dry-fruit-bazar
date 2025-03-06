const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      auto: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: Number,
      required: false,
      sparse: true,
      default: null,
    },
    email: {
      type: String,
      required: true,
    },
    googleId: {
      type: String,
    },
    password: {
      type: String,
      required: false,
    },
    is_admin: {
      type: Boolean,
      default: false,
    },
    is_Verified: {
      type: Boolean,
      default: false,
    },
    is_Blocked: {
      type: Boolean,
      default: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    searchHistory: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category", 
        },
        searchedOn: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true, 
  }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
