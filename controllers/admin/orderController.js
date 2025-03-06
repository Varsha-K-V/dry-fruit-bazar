const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Variant = require("../../models/variantSchema.js");
const Order = require("../../models/orderSchema.js");
const Wallet= require("../../models/walletSchema.js");
const mongoose = require("mongoose");


const loadOrderList = async (req,res)=>{
    try {
        const page= parseInt(req.query.page)||1;
        const limit= parseInt(req.query.limit)||5;
        const skip= (page-1)*limit;
        const totalOrders= await Order.countDocuments();

        const orders = await Order.find()
        .populate({path:'products.productId',select: 'productName productImage'})
        .populate("userId","email")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
        .lean();
        

        orders.forEach(order => {
            order.orderDate = new Date(order.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        });

        

        res.render("order",{
            orders,
            currentPage:page,
            totalPages:(totalOrders/limit),
        });

    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Internal Server Error");
    }
}

const loadOrderDetails = async (req,res)=>{
    try {
        const orderId = req.query.orderId;

        if (!orderId) {
            return res.status(400).send("Order ID is required");
        }
        const order = await Order.findById(orderId)
        .populate("products.productId")
        .populate("products.variantId")
        .select("products shippingAddress totalAmount paymentMethod status createdAt returnRequest coupon");
      
        
        if (!order) {
            return res.status(404).send("Order not found");
        }

        console.log("Fetched Order Data:", order);


        return res.render("orderDetailsAdmin",{order})
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Internal Server Error");
    }
}

const updateOrderStatus = async (req,res)=>{
    try {
        const {orderId,status} = req.body;
       
        const order = await Order.findById(orderId);
        if(!order){
            res.status(404).send("Order not found");
        }

        order.status = status;
        await order.save()

        if(status ==="Cancelled" && order.paymentMethod !=="COD"){
            const wallet = await Wallet.findOne({userId:order.userId});
           
            if(!wallet){
                return res.status(400).send("Wallet is not found for this user");
            }

            const refundAmount = order.totalAmount;

            wallet.balance += refundAmount;

            wallet.transactions.push({
                type : "Refund",
                amount : refundAmount,
                description:`Refund for cancelled order ${order._id}`,
            });
            await wallet.save();
        }

        


        res.redirect(`/admin/orderDetails?orderId=${orderId}`);
    } catch (error) {
        console.error(error);
    }
}


const approveReturn = async (req,res)=>{
    try {
        const {orderId}= req.body;

        const order = await Order.findById(orderId);

        if(!order){
            return res.status(400).json({error:"Order not found"});
        }

        if(order.returnRequest.status !== "Pending"){
            return res.status(400).json({ error: "Invalid return request status" });
        }

            order.returnRequest.status = "Approved";
            order.status ="Returned";
            order.paymentStatus = "Refunded";
            await order.save();

            let wallet = await Wallet.findOne({userId : order.userId});
            if(!wallet){
                wallet = new Wallet ({userId:order.userId,balance:0,transactions:[]});
            }
            
            wallet.balance += order.totalAmount;

            wallet.transactions.push({
                type:"Refund",
                amount:order.totalAmount,
                date:new Date(),
                description:`Refund for order #${order._id}`,
            });

            await wallet.save();

            for(const item of order.products){
                const variant = await Variant.findById(item.variantId);;

                if(variant){
                    variant.stock += item.quantity;
                    await variant.save()
                }
            }
            res.json({ success: true, message: "Return request Approved." });
    } catch (error) {
        console.error("Error approving return request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }

}

const rejectReturn = async(req,res)=>{
    try {
        const {orderId} = req.body;
        const order = await Order.findById(orderId);

        if(!order){
            return res.status(400).json({error:"Order not found"});
        }

        if (order.returnRequest.status !== "Pending") {
            return res.status(400).json({ error: "Invalid return request status" });
          }

          order.returnRequest.status = "Rejected";
          await order.save();

          res.json({ success: true, message: "Return request rejected." });
    } catch (error) {
        console.error("Error rejecting return request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}










module.exports = {
    loadOrderList,
    loadOrderDetails,
    updateOrderStatus,
    approveReturn,
    rejectReturn,

}