const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Variant = require("../../models/variantSchema");

const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");
const  calculateFinalPrice  = require('../../helpers/priceCalculator');

const loadWhistList = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const userData = await User.findOne({ _id: userId });

    if (!userId) {
      return res.redirect("/login");
    }
    let wishlist = await Wishlist.findOne({ userId: userId })
  .populate({
    path: "products.productId",
    select: "productName productImage productOffer category",
    populate: { path: "category", select: "categoryOffer" }
  })
  .populate("products.variantId");

      if (!wishlist) {
        return res.render("wishlist", { wishlist: [], user: userData }); 
      }

      wishlist.products = wishlist.products.filter((item) => item.productId);

      if (wishlist.products.length > 0) {
        wishlist.products = await Promise.all(
          wishlist.products.map(async (item) => {
            const product = item.productId;
            let variant = item.variantId;

            if (!variant || !variant.price) {
              variant = await Variant.findById(item.variantId);
            }

            const priceInfo = calculateFinalPrice(product, variant);

            item.originalPrice = parseFloat(priceInfo.originalPrice);
            item.discountedPrice = parseFloat(priceInfo.finalPrice);
            item.isDiscounted = priceInfo.isDiscounted;
            return item;
          })
        );
      }

      res.render("wishlist", { wishlist: wishlist.products, user: userData });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const addToWishlist = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    const userId = req.session.user._id;

    
    if (!productId || !variantId || !quantity) {
      return res
        .status(400)
        .json({ success: false, message: "Missing product details" });
    }
    const parsedQuantity = Number(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid quantity" });
    }

  
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res
        .status(400)
        .json({ success: false, message: "Variant not found" });
    }
    // if (variant.stock <= 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Stock is not available for the selected variant",
    //   });
    // }
    // if (parsedQuantity > variant.stock) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Only ${variant.stock} is available in stock`,
    //   });
    // }

  
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: [
          {
            productId,
            variantId,
            weight: variant.weight,
            quantity: parsedQuantity,
            price: variant.price * parsedQuantity,
          },
        ],
      });
    } else {
      
      const existingProduct = wishlist.products.find(
        (item) =>
          item.productId.toString() === productId &&
          item.variantId.toString() === variantId
      );
      if (existingProduct) {
        // if (existingProduct.quantity + parsedQuantity > variant.stock) {
        //   return res.status(400).json({
        //     success: false,
        //     message: `Only ${variant.stock} is available in stock`,
        //   });
        // }
        existingProduct.quantity += parsedQuantity;
        existingProduct.price = variant.price * existingProduct.quantity;
      } else {
        wishlist.products.push({
          productId,
          variantId,
          weight: variant.weight,
          quantity: parsedQuantity,
          price: variant.price * parsedQuantity,
        });
      }
    }

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      wishlistCount: wishlist.products.length,
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const moveToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    const userId = req.session.user._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    if (!productId || !variantId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Invalid product details" });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist || wishlist.products.length === 0) {
      return res.status(404).json({ success: false, message: "Wishlist is empty" });
    }

    let itemIndex = wishlist.products.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.variantId.toString() === variantId
    );
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Item not found in wishlist" });
    }
    let item = wishlist.products[itemIndex];

    
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return res.status(400).json({ success: false, message: "Variant not found" });
    }

    
    if (variant.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "Stock is not available for the selected variant",
      });
    }


    const moveQty = item.quantity;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    let cartItemIndex = cart.items.findIndex(
      (cartItem) =>
        cartItem.productId.toString() === productId &&
        cartItem.variantId.toString() === variantId
    );

    if (cartItemIndex !== -1) {
      
      const newQuantity = cart.items[cartItemIndex].quantity + moveQty;
      if (newQuantity > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variant.stock} units available in stock`,
        });
      }
      cart.items[cartItemIndex].quantity = newQuantity;
      cart.items[cartItemIndex].subtotal = cart.items[cartItemIndex].price * newQuantity;
    } else {
      if (moveQty > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variant.stock} units available in stock`,
        });
      }
      cart.items.push({
        productId,
        variantId,
        quantity: moveQty,
        weight: variant.weight,
        price: variant.price,
        subtotal: variant.price * moveQty,
      });
    }

    await cart.save();

    
    wishlist.products.splice(itemIndex, 1);
    await wishlist.save();

    return res.status(200).json({ success: true, message: "Item moved to cart successfully!" });
  } catch (error) {
    console.error("Error moving item to cart:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const removeFromWishlist = async (req,res)=>{
    try {
        const { productId, variantId } = req.body;
        const userId = req.session.user._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
          }

          if (!productId || !variantId) {
            return res.status(400).json({ success: false, message: "Invalid product details" });
          }
          
          const updatedWishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId, variantId } } },
            { new: true }
          );

          return res.status(200).json({ success: true, message: "Item removed from wishlist successfully!" });


    } catch (error) {
        console.error("Error removing item from wishlist:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

module.exports = {
  loadWhistList,
  addToWishlist,
  moveToCart,
  removeFromWishlist,

};
