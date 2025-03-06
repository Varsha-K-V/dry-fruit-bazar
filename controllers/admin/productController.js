const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema.js");
const User = require("../../models/userSchema");
const Variant = require("../../models/variantSchema.js");
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: 'public/uploads/productImage' });
const path = require("path");
const sharp = require("sharp");
const { name } = require("ejs");
const { error } = require("console");
const mongoose = require("mongoose");







const getProductAddPage = async (req,res)=>{
    try {
        const category = await Category.find({isListed:true});
        res.render("productAdd",{
            cat:category,
        });


    } catch (error) {
        
        res.redirect("/pageError")
    }

};




const addProducts = async (req, res) => {
    try {
        
        const products = req.body;


        const productExists = await Product.findOne({ productName: products.productName });
        if (productExists) {
            return res.status(400).json({ message: "Product already exists, please try with another name." });
        }
        

        const images = [];
        if (req.files && req.files.length > 0) {
            
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;

                
                const resizedImagePath = path.join(__dirname, '../../public/uploads/productImages');

                
                await sharp(originalImagePath)
                    .resize({ width: 400, height: 500 })
                    .toFile(resizedImagePath);

                images.push(req.files[i].filename); 

            }
        }


        
        const category = await Category.findOne({ name: products.category });
        if (!category) {
            return res.status(400).json({ message: "Invalid category name." });
        }

        
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            category: category._id,
            // regularPrice: products.regularPrice,
            // salePrice: products.salePrice,
            createdOn: new Date(),
            // quantity: products.quantity,
            productImage: images,
            status: 'Available',
        });

        await newProduct.save();
        
        return res.status(200).json({success:true,message:'Product added successfully'})

    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).json({ error: error.message });
    }
};

const getAllProducts = async (req,res)=>{
    
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const productData = await Product.find({
            productName: { $regex: new RegExp(".*" + search + ".*", "i") }
        }).limit(limit)
          .skip((page-1)*limit)
          .populate("category")
          .exec()
            
        const count = await Product.countDocuments({
            productName: { $regex: new RegExp(".*" + search + ".*", "i") }
    });

    const totalPages = Math.ceil(count / limit);

    const category = await Category.find({isListed:true});

    if(category){
        res.render("products",{
            data:productData,
            currentPage:page,
            totalPages:totalPages,
            category,

        })
    }else{
        res.render("page-404");
    }



    } catch (error) {
        res.redirect("pageError")
    }
};



const blockProduct = async (req,res)=>{
    try {
    
  const id= req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/pageError");
    }
}

const unblockProduct = async (req,res)=>{
    try {
        const id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/pageError");
    }
}

const getEditProduct = async(req,res)=>{
    try {
        
        const id= req.query.id;
        
        const product = await Product.findOne({_id:id});
        const category = await Category.find({isListed:true});

        res.render("editProduct",{
            product:product,
            cat:category,
        })


    } catch (error) {
        res.redirect("/pageError");
    }
};







const editProduct = async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      console.log("Editing product:", id, data);
  
      // Find category by name
      const categoryDoc = await Category.findOne({ name: data.category });
      if (!categoryDoc) {
        return res.status(400).json({ success: false, message: "Invalid category" });
      }
  
      // Check for duplicate product name
      const existingProduct = await Product.findOne({
        productName: data.productName,
        _id: { $ne: id }
      });
      if (existingProduct) {
        return res.status(400).json({ success: false, message: "Product name already exists" });
      }
  
      // Prepare images array
      const images = [];
      if (req.files) {
        if (req.files.images) {
          req.files.images.forEach(file => images.push(file.filename));
        }
        if (req.files.newImage && !data.croppedImageData_new) {
          req.files.newImage.forEach(file => images.push(file.filename));
        }
      }
  
      // Process cropped image if available
      if (data.croppedImageData_new) {
        const base64Data = data.croppedImageData_new.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = Date.now() + "-cropped_new.jpg";
        const filePath = path.join(__dirname, "../../public/uploads/productImage", filename);
        fs.writeFileSync(filePath, buffer);
        images.push(filename);
      }
  
      // Build a single update query
      let updateQuery = {
        $set: {
          productName: data.productName,
          description: data.descriptionData,
          category: categoryDoc._id
        }
      };
  
      if (images.length > 0) {
        updateQuery.$push = { productImage: { $each: images } };
      }
  
      // Execute update and log the result for debugging
      const updatedProduct = await Product.findByIdAndUpdate(id, updateQuery, { new: true });
      console.log("Updated product:", updatedProduct);
      
      if (!updatedProduct) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      res.json({ success: true, message: "Product updated successfully" });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  };
  




  const deleteSingleImage = async (req,res)=>{
    console.log("controlleril ethi")
    try {
        const {imageNameToServer,productIdToServer} = req.body;
        console.log(imageNameToServer,productIdToServer)
        console.log("productIdToSever",productIdToServer)
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
        const imagePath = path.join("public","uploads","re-image",imageNameToServer);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        }else{
            console.log(`Image ${imageNameToServer} not found`);
        }
        res.send({status:true});

    } catch (error) {
        res.redirect("/pageError");
    }
}

  

const viewVariants = async (req,res)=>{
  
    try {
        const id = req.query.id;
        const product = await Product.findById(id);
        

        if(!product){
            return res.status(404).send("Product not found");
        }

        const variants = await Variant.find({productId:id})

        
        return res.render("viewVariants",{
            product,
            variants,

        });
    } catch (error) {
        console.log("Error fetching product:",error);
        res.status(500).send('Server error');
    }
}


const getAddVariant = async (req,res)=>{
    try {
        const id = req.query.productId;
        const product = await Product.findById(id);

        let variant = null;
        

        res.render("addVariant",{
            product,
            variant
        })


    } catch (error) {
        console.log("Error fetching product:",error);
        res.status(500).send('Server error');
    }
}


const postAddVariant = async (req, res) => {
    try {
        const { productId, variantId, weight, price, stock } = req.body;
        const product = await Product.findById(productId);

        if (!product) {
            console.log("Product not found for ID:", productId);
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        
        if (variantId) {
            const variant = await Variant.findById(variantId);
            if (!variant) {
                return res.status(404).json({ success: false, message: "Variant not found" });
            }

            
            if (weight && weight !== variant.weight) {
                const variantExists = await Variant.findOne({ productId, weight });
                if (variantExists) {
                    return res.status(400).json({ success: false, message: "A variant with this weight already exists." });
                }
            }

            variant.weight = weight;
            variant.price = price;
            variant.stock = stock;

            await variant.save();
            return res.status(200).json({ success: true, message: "Variant updated successfully!", productId });
        }

        if (!weight || (!weight.includes("kg") && !weight.includes("gm"))) {
            return res.status(400).json({ success: false, message: "Invalid weight. Use 'kg' or 'gm'." });
        }

        
        const variantExists = await Variant.findOne({ productId, weight });
        if (variantExists) {
            return res.status(400).json({ success: false, message: "A variant with this weight already exists." });
        }

        const newVariant = new Variant({
            productId,
            weight,
            price,
            stock,
        });

        await newVariant.save();
        return res.status(200).json({ success: true, message: "Variant added successfully!", productId });
    } catch (error) {
        console.log("Error adding or updating variant:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


const getEditVariant = async (req,res)=>{
    try {
        const {variantId,productId} = req.query;

        const product = await Product.findById(productId);
        if(!product){
            return res.status(404).send("Product not found");
        }

        const variant = await Variant.findById(variantId);
        if(!variant){
            return res.status(404).send("Variant not found");
        }

        res.render("addVariant",{
            product,
            variant,
        });

    } catch (error) {
        console.log("Error fetching variant:", error);
        res.status(500).send("Server error");
    }
};

const postEditVariant = async (req, res) => {
    try {
        const { productId, variantId, weight, price, stock } = req.body;

        
        const product = await Product.findById(productId);
        const variant = await Variant.findById(variantId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        if (!variant) {
            return res.status(404).send("Variant not found");
        }

        
        const variantExists = await Variant.findOne({
            productId,
            weight,
            _id: { $ne: variantId }, 
        });

        if (variantExists) {
            return res.status(400).send("A variant with this weight already exists.");
        }

        
        const updatedVariant = await Variant.findByIdAndUpdate(
            variantId, 
            { weight, price, stock }, 
            { new: true } 
        );

        if (!updatedVariant) {
            return res.status(404).send("Variant not found");
        }

        res.redirect(`/admin/viewVariants?id=${productId}`);
    } catch (error) {
        console.error("Error updating variant:", error);
        res.status(500).send("Server error");
    }
};

const deleteVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.query;  

        const variant = await Variant.findByIdAndDelete(variantId);

        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found" });
        }

        return res.status(200).json({ success: true, message: "Variant deleted successfully!", productId });
    } catch (error) {
        console.error("Error deleting variant:", error);
        req.flash('error', 'Failed to delete variant');  
        return res.status(500).json({ success: false, message: "Server error" });
    }
}


const addProductOffer = async(req,res)=>{
    try {
        const {percentage,productId} = req.body;

        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            return res.status(400).json({
              status: false,
              message: "Please enter a valid percentage between 0 and 100."
            });
          }

          await Product.findByIdAndUpdate(productId, { productOffer: percentage });

          return res.json({
            status: true,
            message: "Product offer added successfully!"
          });
    } catch (error) {
        console.error("Error in addProductOffer:", error);
        return res.status(500).json({
            status: false,
      message: "An error occurred while adding the product offer."
    });
    }
}

const removeProductOffer = async(req,res)=>{
    try {
        const { productId } = req.body;

        await Product.findByIdAndUpdate(productId, { productOffer: 0 });

        return res.json({
            status: true,
            message: "Product offer removed successfully!"
          });
    } catch (error) {
        console.error("Error in removeProductOffer:", error);
        return res.status(500).json({
            status: false,
      message: "An error occurred while removing the product offer."
    });
    }
}





module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    viewVariants,
    getAddVariant,
    postAddVariant,
    getEditVariant,
    postEditVariant,
    deleteVariant,
    addProductOffer,
    removeProductOffer,
    
}