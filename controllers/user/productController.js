const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Variant = require("../../models/variantSchema");
const ObjectId=  mongoose.Types.ObjectId;
const { name } = require("ejs");
const  calculateFinalPrice  = require('../../helpers/priceCalculator');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.query.id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.redirect('/pageNotFound');
    }

    
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.redirect('/pageNotFound');
    }
    if (product.isBlocked) {
      return res.redirect('/');
    }

    
    const variants = await Variant.find({ productId: product._id });

    
    const computedVariants = variants.map((variant) => {
      const priceInfo = calculateFinalPrice(product, variant);
      return {
        ...variant.toObject(),
        effectiveDiscount: priceInfo.effectiveDiscount,
        discountedPrice: priceInfo.finalPrice,
        originalPrice: priceInfo.originalPrice,
      };
    });

    
    const bigstock = variants.reduce((max, variant) => {
      return variant.stock > max ? variant.stock : max;
    }, 0);

    if (!variants || variants.length === 0) {
      console.warn(`No variants found for product ID: ${product._id}`);
    }

    
    const userData = userId ? await User.findById(userId) : null;

  
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
    }).limit(3);

    
    res.render('product-details', {
      user: userData,
      product,
      category: product.category,
      relatedProducts,
      name: product.productName,
      productImages: product.images || [],
      variants: computedVariants,
      bigstock,
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.redirect('/pageNotFound');
  }
};





const loadShopPage = async (req, res) => {
    try {
      
      const user = req.session.user;
      
      const userData = await User.findOne({ _id: user._id });
  
  
      const category = await Category.find({ isListed: true });
  
    
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page - 1) * limit;
  
    
  

       const products = await Product.aggregate([
          {
              $lookup: {
                  from: "variants",
                  localField: "_id",
                  foreignField: "productId",
                  as: "variants"
              }
          },
          {
              $match: {
                  isBlocked: false,
                  category: { $exists: true, $ne: null },
                  "variants.stock": { $gt: 0 },
              }
          },

          {
            $lookup: {
              from: "categories",        
              localField: "category",
              foreignField: "_id",
              as: "categoryDetails"
            }
          },
          {
            $unwind: "$categoryDetails"
          },
          {
            $addFields: {
              minVariantPrice: { $min: "$variants.price" }
            }
          },
          {
            $skip: skip
          },
          {
            $limit: limit
          }
        ])
      
      const totalProducts = await Product.countDocuments({
        isBlocked: false,
        category: { $exists: true, $ne: null },
      });
      const totalPages = Math.ceil(totalProducts / limit);
  
      res.render("shop", {
        user:userData,     
        category,      
        products,      
        currentPage: page, 
        totalPages,    
      });
  
    } catch (error) {
      console.error("Error loading shop page:", error);
      res.redirect("/pageError");
    }
  };

  const filterProduct = async (req,res)=>{
    try {
      const user = req.session.user;
      
      const category = req.query.category;
      // console.log("category:",category);
      const findCategory= category ? await Category.findOne({_id:category}):null;
      const query = {
        isBlocked:false,
       
      }

      if(findCategory){
        query.category = findCategory._id;
      }
     
      let findProducts = await Product.aggregate([
        {
            $lookup: {
                from: "variants",
                localField: "_id",
                foreignField: "productId",
                as: "variants"
            }
        },
        {
            $match: {
                isBlocked: false,
                
                "variants.stock": { $gt: 0 },
                ...query
            }
        },
        {
          $addFields: {
            minVariantPrice: { $min: "$variants.price" }
          }
        }
      ])

      console.log("Filtered based on category: ",findProducts);
  
      findProducts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      const categories = await Category.find({isListed:true})
      let itemsPerPage = 6;
      let currentPage = parseInt(req.query.page) || 1;
      let startIndex = (currentPage-1) * itemsPerPage;
      let endIndex = startIndex + itemsPerPage;
      let totalPages = Math.ceil(findProducts.length/itemsPerPage);
      const currentProduct = findProducts.slice(startIndex,endIndex)
      let userData = null;
      if(user){
        userData = await User.findOne({_id:user});
        if(userData){
          const searchEntry = {
            category : findCategory ? findCategory._id:null,
            searchedOn : new Date(), 
          }
          userData.searchHistory.push(searchEntry);
          await userData.save();
        }
      }
      

      req.session.filteredProducts = currentProduct;
      res.render("shop",{
        user : userData,
        products :currentProduct,
        category:categories,
        totalPages,
        currentPage,
        selectedCategory:category || null,

      })
    } catch (error) {
      res.redirect("'/pageNotFound'")
    }
  }


  const filterByPrice = async (req, res) => {
    try {
      const user = req.session.user;
  
      
      const gt = parseInt(req.query.gt) || 0; 
      const lt = req.query.lt ? parseInt(req.query.lt) : null; 
  
    
      const priceFilter = { $gt: gt };
      if (lt !== null) {
        priceFilter.$lt = lt;
      }
  
      
      const userData = user ? await User.findOne({ _id: user }).lean() : null;
  
      
      const categories = await Category.find({ isListed: true }).lean();
  
      // const findProducts = await Product.find({
      //   salePrice: priceFilter,
      //   isBlocked: false,
      //   quantity: { $gt: 0 },
      // })
      //   .sort({ createdOn: -1 })
      //   .lean();
      console.log(priceFilter);
        const findProducts = await Product.aggregate([
          {
            $lookup: {
              from: "variants",
              localField: "_id",
              foreignField: "productId",
              as: "variants"
            }
          },
          {
            $unwind: "$variants" 
          },
          {
            $match: {
              isBlocked: false,
              category: { $in: categories.map(category => category._id) },
              "variants.price": priceFilter 
            }
          },
          {
            $group: {
              _id: "$_id",
              productName: { $first: "$productName" },
              productImage: { $first: "$productImage"},
              category: { $first: "$category" },
              isBlocked: { $first: "$isBlocked" },
              createdAt: { $first: "$createdAt" },
              variants: { $push: "$variants" } 
            }
          },
          {
            $sort: {
              createdAt: -1
            }
          }
        ]);

        console.log("Price filterd product: ", findProducts);
  
      const itemsPerPage = 6;
      const currentPage = parseInt(req.query.page) || 1;
      const totalProducts = findProducts.length;
      const totalPages = Math.ceil(totalProducts / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
  
      const currentProduct = findProducts.slice(startIndex, startIndex + itemsPerPage);
  
      res.render("shop", {
        user: userData,
        products: currentProduct,
        category: categories,
        totalPages,
        currentPage,
        totalProducts,
      });
    } catch (error) {
      console.error("Error in filterByPrice:", error);
      res.redirect("/pageError");
    }
  };

  const searchProducts= async (req,res)=>{
    try {
      const user =req.session.user;
      const userData= await User.findOne({_id:user})
      let search = req.body.query;

      const categories = await Category.find({isListed:true}).lean();
      const categoryIds = categories.map(category=>category._id);
      console.log("category id's", categoryIds);

      let searchResult = [];
      if(req.session.filteredProducts && req.session.filteredProducts.length>0){
        searchResult =req.session.filteredProducts.filter(product=>product.productName.toLowerCase().includes(search.toLowerCase()))
      }else{
        // searchResult = await Product.find({
        //   productName:{$regex:".*"+search+".*",$options:"i"},
        //   isBlocked:false,
        //   quantity:{$gt:0},
        //   category:{$in:categoryIds}
        // })
        console.log(searchResult);
        searchResult = await Product.aggregate([
          {
              $lookup: {
                  from: "variants",
                  localField: "_id",
                  foreignField: "productId",
                  as: "variants"
              }
          },
          {
              $match: {
                  isBlocked: false,
                  "variants.stock": { $gt: 0 }, 
                  category: { $in: categoryIds },
                  productName: { $regex: ".*" + search + ".*", $options: "i" } 
              }
          },
          {
            $addFields: {
              minVariantPrice: { $min: "$variants.price" }
            }
          },
      ]);
      
      }
      searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
      let itemsPerPage = 6;
      let currentPage = parseInt(req.query.page) || 1;
      let startIndex = (currentPage-1)*itemsPerPage;
      let endIndex = startIndex + itemsPerPage;
      let totalPages= Math.ceil(searchResult.length/itemsPerPage);
      const currentProduct = searchResult.slice(startIndex,endIndex);

      req.session.filteredProducts = currentProduct;
      res.render("shop",{
        user:userData,
        products:currentProduct,
        category:categories,
        totalPages,
        currentPage,
        count:searchResult.length,
      });
      
    } catch (error) {
      console.log("Error:",error);
      res.redirect("/pageError");

    }
  };

  const sortProducts = async (req, res) => {
    try {
      const user = req.session.user;
      const userData = await User.findOne({ _id: user });
      const categories = await Category.find({ isListed: true }).lean();
      const categoryIds = categories.map((category) => category._id.toString());
  
      const { sort } = req.query;
      

      let sortCriteria = {};
      switch (sort) {
        case "popularity":
          sortCriteria = { popularity: -1 };
          break;
        case "low-to-high":
          sortCriteria = { "minVariantPrice": 1 };
          break;
        case "high-to-low":
          sortCriteria = { "minVariantPrice": -1 };
          break;
        case "averageRating":
          sortCriteria = { averageRating: -1 };
          break;
        case "featured":
          sortCriteria = { isFeatured: -1, createdAt: -1 };
          break;
        case "newArrivals":
          sortCriteria = { createdAt: -1 };
          break;
        case "aToZ":
          sortCriteria = { productName: 1 };
          break;
        case "zToA":
          sortCriteria = { productName: -1 };
          break;
        default:
          sortCriteria = { createdAt: -1 };
      }
      console.log(sortCriteria);
      let products = [];
      
      if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
        products = [...req.session.filteredProducts]; 
        console.log("Using session filtered products: ", products);
  
        
        products.sort((a, b) => {
          if (sortCriteria.minVariantPrice) {
            return sortCriteria.minVariantPrice * (a.minVariantPrice - b.minVariantPrice);
          }
          if (sortCriteria.productName) {
            return sortCriteria.productName * a.productName.localeCompare(b.productName);
          }
          if (sortCriteria.createdAt) {
            return sortCriteria.createdAt * (new Date(b.createdAt) - new Date(a.createdAt));
          }
          return 0;
        });
  
      } else {
        console.log("Fetching products from DB"); 
        // products = await Product.find({
        //   isBlocked: false,
        //   category: { $in: categoryIds },
        // }).sort(sortCriteria).lean();

        products = await Product.aggregate([
          {
              $lookup: {
                  from: "variants",
                  localField: "_id",
                  foreignField: "productId",
                  as: "variants"
              }
          },
          {
              $match: {
                  isBlocked: false,
                  category: { $in: categories.map((category) => category._id) },
                  "variants.stock": { $gt: 0 }
              }
          },
          {
            $addFields: {
              minVariantPrice: { $min: "$variants.price" }
            }
          },
          {
            $sort: sortCriteria
          }
        ]);
      }
      let itemsPerPage = 6;
      let currentPage = parseInt(req.query.page) || 1;
      let startIndex = (currentPage - 1) * itemsPerPage;
      let endIndex = startIndex + itemsPerPage;
      let totalPages = Math.ceil(products.length / itemsPerPage);
  
      const currentProduct = products.slice(startIndex, endIndex);
      console.log("sorted Products: ", products);
  
      res.render("shop", {
        user: userData,
        products: currentProduct,
        category: categories,
        totalPages,
        currentPage,
        count: products.length,
      });
    } catch (error) {
      console.error("Error sorting products:", error);
      res.redirect("/pageError");
    }
  };
  
  const clearSearchData = async (req,res)=>{
    delete req.session.filteredProducts;
    res.redirect('/shop');
  }
  

module.exports = {
    productDetails,
    loadShopPage,
    filterProduct,
    filterByPrice,
    searchProducts,
    sortProducts,
    clearSearchData,
}