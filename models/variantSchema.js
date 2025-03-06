const mongoose = require("mongoose");
const variantSchema = new mongoose.Schema({
    productId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Product",
        required:true,
    },
    weight:{
        type:String,
        required:true,
    },
    price: {
        type: Number,
        required: true,
    },
    stock: {
        type: Number,
        required: true,
        default: 0,
        
    }, createdAt: {
        type: Date,
        default: Date.now,
    },
})

    const Variant = mongoose.model('Variant', variantSchema);
    module.exports = Variant;


