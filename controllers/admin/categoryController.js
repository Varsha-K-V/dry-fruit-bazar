const { query } = require("express");
const Category = require("../../models/categorySchema.js");
const { MongoCryptCreateDataKeyError } = require("mongodb");
const Product = require("../../models/productSchema");



const categoryInfo = async (req, res) => {
    try {
        let search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { description: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments({
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { description: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        });

        const totalPages = Math.ceil(totalCategories / limit);
        
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageError"); 
    }
};


const addCategory = async (req,res)=>{
    const {name,description} = req.body;
    try {
        const normalizedName = name.trim().toLowerCase();
        const existingCategory = await Category.findOne({name:normalizedName});
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})
        }
        const newCategory = new Category({
            name:normalizedName,
            description,
        })
        await newCategory.save();
        return res.json({message:"Category added successfully"})
    } catch (error) {
        return res.status(500).json({error:"Internal Server Error"})
    }
};

const getEditCategory= async (req,res)=>{
    try {
        const id = req.query.id;
        const category= await Category.findById({_id:id});
        
        res.render("editCategory",{category:category});

    } catch (error) {
        
        res.redirect("/pageError")
    }
};




const editCategory = async (req,res)=>{
    
    try {
        const id=req.params.id;
        const {categoryName,description}=req.body;

        const normalizedCategoryName = categoryName.trim().toLowerCase();

        const existingCategory = await Category.findOne({name:normalizedCategoryName,_id: { $ne: id } });


        if(existingCategory){
            return res.status(400).json({error:"Category exists, please choose another name"})
        }

        const updatedCategory = await Category.findByIdAndUpdate(id,{
            name:normalizedCategoryName,
            description:description,
        },{new:true,runValidators:true});

        if(!updatedCategory){
            return res.status(404).json({success:false,message:'Category not found'});
        }

        res.json({ success: true, message: 'Category updated successfully' });
  
    } catch (error) {
        res.status(500).json({error:"Internal server error"})
    }

}


const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.json({ success: true, message: "Category unlisted successfully" }); 
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.json({ success: true, message: "Category listed successfully" });  
    } catch (error) {
        console.error("Error listing category:", error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};


const addCategoryOffer = async (req,res)=>{
    try {
        const { percentage, categoryId } = req.body;
        
        
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            return res.status(400).json({
              status: false,
              message: "Please enter a valid percentage between 0 and 100."
            });
          }

          await Category.findByIdAndUpdate(categoryId, { categoryOffer: percentage });

          return res.json({
            status: true,
            message: "Offer added successfully!"
          });

    } catch (error) {
        console.error("Error in addCategoryOffer:", error);
        return res.status(500).json({
            status: false,
             message: "An error occurred while adding the offer."
            });
    }
}

const removeCategoryOffer = async(req,res)=>{
 
    try {
        const {categoryId} = req.body;

        await Category.findByIdAndUpdate(categoryId, { categoryOffer: 0 });

        return res.json({
            status: true,
            message: "Offer removed successfully!"
          });
    } catch (error) {
        console.error("Error in removeCategoryOffer:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while removing the offer."
    });
    }
}




module.exports ={
    categoryInfo,
    addCategory,
    getEditCategory,
    editCategory,
    getListCategory,
    getUnlistCategory,
    addCategoryOffer,
    removeCategoryOffer,
};