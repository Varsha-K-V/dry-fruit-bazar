const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Variant = require("../../models/variantSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const razorpayInstance = require("../../config/razorpayConfig");
const crypto = require('crypto');
const  calculateFinalPrice  = require('../../helpers/priceCalculator');
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/couponSchema');
const { type } = require("os");
const PDFDocument = require("pdfkit-table");


function validateRazorpayPayment(order_id, payment_id, razorpay_signature) {
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(`${order_id}|${payment_id}`);
  const generatedSignature = hmac.digest("hex");
  return generatedSignature === razorpay_signature;
}




const viewCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = userId ? await User.findById(userId) : null;
    if (!userId) {
      return res.render("cart", { cart: null });
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "productName productImage productOffer category",
        populate:{path:"category",select:"categoryOffer"}
      })
      .populate("items.variantId");

    
    if (cart && cart.items.length > 0) {
      for (let item of cart.items) {
        const product = item.productId;
        let  variant = item.variantId;
        if(!variant || !variant.price){
          variant = await Variant.findById(item.variantId);
        }

        const priceInfo = calculateFinalPrice(product,variant);
        item.originalPrice = parseFloat(priceInfo.originalPrice);
        item.price = parseFloat(priceInfo.finalPrice);
        item.subtotal = item.quantity * item.price;

        const variantFromDB = await Variant.findById(item.variantId);
        item.inStock = variantFromDB && variantFromDB.stock > 0;
        item.availableStock = variantFromDB ? variantFromDB.stock : 0;
      }
      cart.totalPrice = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    }

    res.render("cart", {
      user: userData,
      cart,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.render("cart", { cart: null, error: "Failed to fetch cart" });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    const userId = req.session.user;

    const parsedQuantity = Number(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid quantity" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const selectedVariant = await Variant.findOne({
      productId,
      _id: variantId,
    });
    if (!selectedVariant) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid variant selected" });
    }

    if (selectedVariant.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: `Stock is not available for the selected variant`,
      });
    }


    if (!selectedVariant.price || isNaN(selectedVariant.price)) {
      return res.status(500).json({
        success: false,
        message: "Variant price is missing or invalid",
      });
    }

    const priceInfo = calculateFinalPrice(product, selectedVariant);
    const finalPrice = parseFloat(priceInfo.finalPrice);

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId &&
        item.variantId.toString() === variantId
    );

    if (existingItem) {
      if (existingItem.quantity + parsedQuantity > selectedVariant.stock) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Only ${selectedVariant.stock} is available in stock`,
          });
      }
      existingItem.quantity += parsedQuantity;
      existingItem.subtotal = existingItem.quantity * finalPrice;
    } else {
      if (parsedQuantity > selectedVariant.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${selectedVariant.stock} is available in stock`,
        });
      }
      cart.items.push({
        productId,
        variantId,
        quantity: parsedQuantity,
        originalPrice: selectedVariant.price,
        price: finalPrice,
        subtotal: parsedQuantity * finalPrice,
      });
    }

    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.subtotal, 0);

    if (isNaN(cart.totalPrice)) {
      return res
        .status(500)
        .json({ success: false, message: "Total price calculation error" });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully!",
      cartCount: cart.items.length,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, variantId } = req.params;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) =>
        !(
          item.productId.toString() === productId &&
          item.variantId.toString() === variantId
        )
    );

    cart.totalPrice = cart.items.reduce(
      (total, item) => total + item.subtotal,
      0
    );

    await cart.save();

    return res.json({ success: true, message: "Item removed successfully" });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    return res.json({ success: false, message: "Error removing item" });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, variantId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Quantity must be at least 1." });
    }
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.status(400).json({ success: false, message: "Variant not found" });
    }
    if (quantity > variant.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} items are available in stock`,
      });
    }

    const product = await Product.findById(productId).populate("category");
    if(!product){
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const priceInfo = calculateFinalPrice(product, variant);
    const finalPrice = parseFloat(priceInfo.finalPrice);

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found." });
    }

    const item = cart.items.find(
      (item) =>
        item.productId.equals(productId) && item.variantId.equals(variantId)
    );

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart." });
    }
    
    if (+quantity > variant.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} items are available in stock`,
      });
    }
    item.quantity = quantity;
    item.price = finalPrice;
    item.subtotal = finalPrice * quantity;

    cart.totalPrice = cart.items.reduce(
      (total, item) => total + item.subtotal,
      0
    );

    await cart.save();

    res.json({
      success: true,
      newSubtotal: item.subtotal,
      newTotalPrice: cart.totalPrice,
      newPrice:item.price,
      originalPrice:priceInfo.originalPrice,
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal Server Error", error });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found." });
    }

    cart.items = [];
    cart.totalPrice = 0;

    await cart.save();

    res.json({ success: true, message: "Cart has been cleared." });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Internal Server Error", error });
  }
};

const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user;

    const userData = userId ? await User.findById(userId) : null;

    if (!userData) {
      return res.status(404).send("User not found");
    }

    const cart = await Cart.findOne({ userId }).populate({
      path:"items.productId",
      select: "productName productImage productOffer category",
      populate: {path:"category",select:"categoryOffer"}
  })
  .populate("items.variantId");

  if(cart && cart.items && cart.items.length >0){
    for(let item of cart.items){
      const product = item.productId;
      let variant = item.variantId;
      if(!variant || !variant.price){
        variant = await Variant.findById(item.variantId);
      }
      const priceInfo = calculateFinalPrice(product,variant);
      item.price = parseFloat(priceInfo.finalPrice);
      item.subtotal = item.quantity * item.price;
    }
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

    const userAddresses = await Address.find({ userId });

    const wallet = await Wallet.findOne({ userId }) || { balance: 0 };

    res.render("checkOut", {
      user: userData,
      cart: cart || { items: [], totalPrice: 0 },
      addresses: userAddresses,
      wallet: wallet
    });
  } catch (error) {
    console.error("Error in checkout:", error);
    res.status(500).send("Internal Server Error");
  }
};

const saveAddress = async (req, res) => {
  console.log("addres is come");
  try {
    const {
      name,
      addresstype,
      landmark,
      city,
      state,
      pincode,
      phone,
      alternativeNo,
    } = req.body;
    console.log("the addres id got from ", req.body);
    //console.log(req.body);
    const newAddress = new Address({
      userId: req.user._id,
      name,
      addresstype,
      landmark,
      city,
      state,
      pincode,
      phone,
      alternativeNo,
    });
    await newAddress.save();
    console.log("after saving the address is", newAddress);
    res.json({ success: true, message: "Address saved succesfully" });

  } catch (error) {
    console.error("Error saving address:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error. Try again!" });
  }
};


const getEditAddress = async (req, res) => {
  try {
    let addressId = req.query.id;
   
    let address = await Address.findById(addressId);
    if (address) {
      res.json({ success: true, address });
    } else {
      res.json({ success: false, message: "Address not found" });
    }
  } catch (error) {
    res.json({ success: false, message: "Error fetching address" });
  }
};


const getAllAddress = async (req, res) => {
  try {
    userId=req.session.user._id
    let address = await Address.find({ userId: userId });

    if (address) {
      res.json({ success: true, address });
    } else {
      res.json({ success: false, message: "Address not found" });
    }
  } catch (error) {
    res.json({ success: false, message: "Error fetching address" });
  }
};

const updateAddress = async (req, res) => {
  
  const { addressId } = req.params;
  

  try {
    let { name, addresstype, landmark, city, state, pincode, alternativeNo } =
      req.body;

    const updatedAddress = await Address.updateOne(
      { _id: addressId },
      {
        $set: {
          name,
          addresstype,
          landmark,
          city,
          state,
          pincode,
          alternativeNo,
        },
      }
    );
    console.log("address saved ", updatedAddress);
    res.json({ success: true, message: "Address updated successfully!" });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { 
      selectedAddressId, 
      paymentMethod,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature ,
      couponCode,
      paymentFailed
    } = req.body;

    const address = await Address.findById(selectedAddressId);
    if (!address) {
      return res.status(400).json({ success: false, message: "Address not found." });
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "productName productOffer category",
        populate: { path: "category", select: "categoryOffer" }
      })
      .populate("items.variantId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "No products in your cart." });
    }
    
    
    if (paymentMethod === 'ONLINE' && !paymentFailed) {
      const isValidPayment = validateRazorpayPayment(
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature
      );

      if (!isValidPayment) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment signature"
        });
      }
    }

    let productDetails = [];
    let totalAmount = 0;
    let outOfStockItems = [];

    
    for (let item of cart.items) {
      const product = item.productId;
      let variant = item.variantId;
      
      if (!variant || !variant.price) {
        variant = await Variant.findById(item.variantId._id);
      }

      const priceInfo = calculateFinalPrice(product, variant);
      const finalPrice = parseFloat(priceInfo.finalPrice);

      if (variant.stock < item.quantity) {
        outOfStockItems.push({
          variantId: variant._id,
          availableStock: variant.stock,
        });
      }

      productDetails.push({
        productId: product._id,
        variantId: variant._id,
        quantity: item.quantity,
        price: finalPrice,
        total: item.quantity * finalPrice,
      });

      totalAmount += item.quantity * finalPrice;
    }

    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items are out of stock.",
        outOfStockItems,
      });
    }

    let discountAmount = 0;
    let finalAmount = totalAmount;
    
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

      if (!coupon) {
        return res.status(400).json({ success: false, message: "Invalid coupon code." });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (new Date(coupon.expiryDate) < today) {
        return res.status(400).json({ success: false, message: "Coupon has expired." });
      }

      if (totalAmount < coupon.minPurchaseAmount) {
        return res.status(400).json({ 
          success: false, 
          message: `Coupon requires a minimum purchase of ₹${coupon.minPurchaseAmount}.`
        });
      }

      
      discountAmount = (totalAmount * coupon.discountValue) / 100;
      finalAmount -= discountAmount;

      await Coupon.updateOne(
        { _id: coupon._id },
        { $inc: { usedCount: 1 } }
      );
    }

    

     const shippingCharge = 50;
     
     finalAmount += shippingCharge;

    let walletDeduction = 0;

    if (paymentMethod === "WALLET") {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        return res.status(404).json({ success: false, message: "Wallet not found" });
      }

      if (wallet.balance < totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet funds. Please add funds or choose another payment method."
        });
      }

      walletDeduction = finalAmount;
      wallet.balance -= walletDeduction;
      wallet.transactions.push({
        type: "Payment",
        amount: -walletDeduction,
        description: "Order payment via wallet"
      });
      await wallet.save();
    }

    
    const order = new Order({
      userId,
      shippingAddress: address,
      paymentMethod,
      products: productDetails,
      status: 'Confirmed',
      paymentStatus: paymentMethod === 'ONLINE' 
                      ? (paymentFailed ? 'Pending' : 'Confirmed') 
                      : paymentMethod === 'COD'
                      ? 'Pending'
                      : 'Confirmed',
      totalAmount: finalAmount,
      walletDeduction,
      paymentDetails: paymentMethod === 'ONLINE' ? {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      } : undefined,
      coupon: couponCode ? { code: couponCode.toUpperCase(), discount: discountAmount } : undefined
    });

    await order.save();

    for (let item of cart.items) {
      await Variant.findByIdAndUpdate(item.variantId._id, {
        $inc: { stock: -item.quantity },
      });
    }
    await Cart.deleteOne({ userId });

    return res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      orderId: order._id,
    });
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while placing the order.",
    });
  }
};

const orderConfirmation = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData= await User.findById(userId);
    const { orderId } = req.params;
    //console.log(orderId);

    const order = await Order.findById(orderId)
      .populate("products.productId")
      .populate("products.variantId");
    //console.log(order)
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.render("orderConfirmation", { order:order,user:userData});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching Oredr Details" });
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const orderId = req.params.orderId;
    const userData = await User.findById(userId);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Order ID" });
    }

    const order = await Order.findById(orderId)
      .populate("products.productId")
      .populate("products.variantId");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    res.render("orderDetails", { order:order,user:userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching Oredr Details" });
  }
};

const loadOrderHistory = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData= await User.findById(userId);
    // console.log(userId);

    const page = parseInt(req.query.page) || 1;
    const perPage = 5;

    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / perPage);

    const orders = await Order.find({ userId: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .populate({
      path: "products.productId",
      select: "productName productImage",
    }).populate({
      path:"products.variantId",
      select:"weight",
    });
    // console.log(orders);
    return res.render("orderHistory", {
       orders:orders,
       user:userData,
       currentPage: page,
       totalPages 
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching Oredrs" });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId, productId, variantId } = req.params; 
    const userId = req.session.user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const orderAmount = order.totalAmount; 
    const refundAmount = Number(orderAmount);

    if (order.paymentMethod === "ONLINE" || order.paymentMethod === "WALLET") {
      
      let wallet = await Wallet.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "Refund",
        amount: refundAmount,
        description: `Refund for cancelled order ${orderId}`
      });
      await wallet.save();
    }

    order.status = "Cancelled";
    await order.save();

    for(const item of order.products){
      const variant = await Variant.findById(item.variantId);;

      if(variant){
          variant.stock += item.quantity;
          await variant.save()
      }
  }

    return res.json({ success: true, message: "Order successfully canceled!" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error. Try again later." });
  }
};


const createorder = async (req, res) => {
  try {
      if (!req.session.user) {
          return res.status(401).json({
              success: false,
              message: "Please login to continue"
          });
      }

      let { amount } = req.body;

      if (!amount) {
          return res.status(400).json({
              success: false,
              message: "Amount is required in the request body"
          });
      }

      // const shippingCharge = 50;
      // amount += shippingCharge;

      const timestamp = Date.now().toString().slice(-8);
      const userIdSuffix = req.session.user._id.toString().slice(-4);
      const receipt = `rcpt_${timestamp}${userIdSuffix}`;

      
      const options = {
          amount: Math.round(amount * 100), 
          currency: "INR",
          receipt: receipt, 
          payment_capture: 1
      };

      console.log("Creating order with options:", options); 

      const order = await razorpayInstance.orders.create(options);

      return res.status(200).json({
          success: true,
          order
      });
  } catch (error) {
      console.error("Error creating Razorpay order:", error);
      return res.status(500).json({
          success: false,
          message: "Failed to create order",
          error: error.message
      });
  }
};


const requestReturn = async(req,res)=>{
  try {
    const {orderId,reason}= req.body;

    const order= await Order.findById(orderId)

    if(!order){
      return res.status(400).json({error:"Order not found"});
    }

    if(order.status !=="Delivered"){
      return res.status(400).json({ error: "Return not allowed for the current order status" });
    }

    order.returnRequest ={
      status: "Pending",
      reason,
      requestDate: new Date()
    }
    await order.save();

    res.json({ success: true, message: "Return request submitted successfully." });
  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


const retryPayment = async(req,res)=>{
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.paymentStatus.toLowerCase() !== "pending") {
      return res.status(400).json({ success: false, message: "Payment retry is not available for this order." });
    }

    const options = {
      amount: Math.round(order.totalAmount * 100), // amount in paise
      currency: "INR",
      receipt: `order_${order._id}_retry`,
      payment_capture: 1,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);
    res.status(200).json({ success: true, razorpayOrder });


  } catch (error) {
    console.error("Error in retry payment route:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}


const updatePaymentStatus = async (req,res)=>{
  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.paymentDetails = {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    };

    order.paymentStatus = 'Confirmed';

    await order.save();

    res.status(200).json({ success: true, message: "Payment updated successfully" });


  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}


async function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    try {
      
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];

      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      
      doc.fontSize(20).text('Dry Fruit Bazar', { align: 'center' });
      doc.moveDown();

      
      doc.fontSize(12)
         .text(`Order ID: ${order._id}`)
         .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`)
         .text(`Payment Status: ${order.paymentStatus}`)
         .moveDown();

      
      const tableTop = doc.y;
      const itemX = 50;
      const itemNameX = 100;
      const qtyX = 300;
      const priceX = 350;
      const totalX = 430;

      doc.fontSize(12)
         .text('S.No', itemX, tableTop, { width: 30, align: 'left' })
         .text('Item', itemNameX, tableTop, { width: 200, align: 'left' })
         .text('Qty', qtyX, tableTop, { width: 40, align: 'center' })
         .text('Price Each', priceX, tableTop, { width: 70, align: 'right' })
         .text('Total', totalX, tableTop, { width: 70, align: 'right' });

      
      doc.moveTo(itemX, doc.y + 5)
         .lineTo(550, doc.y + 5)
         .stroke();
      doc.moveDown();

      
      let subtotal = 0;
      order.products.forEach((product, idx) => {
        const y = doc.y;
        const totalPrice = product.price * product.quantity;
        subtotal += totalPrice;

        doc.fontSize(10)
           .text(idx + 1, itemX, y, { width: 30, align: 'left' })
           .text(product.productId.productName, itemNameX, y, { width: 200, align: 'left' })
           .text(product.quantity, qtyX, y, { width: 40, align: 'center' })
           .text(`Rs.${product.price.toFixed(2)}`, priceX, y, { width: 70, align: 'right' })
           .text(`Rs.${totalPrice.toFixed(2)}`, totalX, y, { width: 70, align: 'right' });
        doc.moveDown();
      });

      
      doc.moveTo(itemX, doc.y + 5)
         .lineTo(550, doc.y + 5)
         .stroke();
      doc.moveDown();

      
      const shippingCharge = 50;
      doc.fontSize(12)
         .text(`Subtotal: Rs.${subtotal.toFixed(2)}`, { align: 'right' });

      
      if (order.coupon && order.coupon.discount) {
        doc.fontSize(12)
          
           .text(`Discount: -Rs.${order.coupon.discount.toFixed(2)}`, { align: 'right' })
          
      }

      doc.fontSize(12)
         .text(`Shipping Charge: Rs.${shippingCharge.toFixed(2)}`, { align: 'right' })
         .moveDown(0.5);

      
      doc.fontSize(12)
         .text(`Grand Total: Rs.${order.totalAmount.toFixed(2)}`, { align: 'right', underline: true });

    
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}


const downloadPDF = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('products.productId');
    
    if (!order) {
      return res.status(404).send("Order not found");
    }

    
    if (order.paymentStatus.toLowerCase() !== 'confirmed') {
      return res.status(400).send("Invoice is available only for confirmed payments.");
    }

    
    const invoiceBuffer = await generateInvoicePDF(order);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice_${orderId}.pdf`,
      'Content-Length': invoiceBuffer.length,
    });
    res.send(invoiceBuffer);
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Internal server error");
  }
};








module.exports = {
  viewCart,
  getAllAddress,
  addToCart,
  removeCartItem,
  updateCartItem,
  clearCart,
  loadCheckOut,
  saveAddress,
  placeOrder,
  orderConfirmation,
  loadOrderDetails,
  loadOrderHistory,
  cancelOrderItem,
  getEditAddress,
  updateAddress,
  createorder,
  validateRazorpayPayment,
  requestReturn,
  retryPayment,
  updatePaymentStatus,
  generateInvoicePDF,
  downloadPDF,
 
};
