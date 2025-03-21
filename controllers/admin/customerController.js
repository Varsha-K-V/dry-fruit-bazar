const { query } = require("express");
const User=require("../../models/userSchema");



const customerInfo = async (req,res)=>{
   try {
      
    let search="";
    if(req.query.search){
        search=req.query.search;
    }
    let page=1;
    if(req.query.page){
        page=req.query.page
    }
    const limit = 3
    const userData = await User.find({
        is_admin:false,
        $or: [      
            {name: {$regex: ".*" + search + ".*"} },
            {email: {$regex: ".*" + search + ".*"} },
        ],
    })
    .limit(limit*1)
    .skip((page-1)*limit)
    .exec();

    

    const count = await User.find({
        is_admin:false,
        $or: [      
            {name: {$regex: ".*" + search + ".*"} },
            {email: {$regex: ".*" + search + ".*"} },
        ],
    }).countDocuments();

    const totalPages = Math.ceil(count / limit);


    res.render('customers',{
        data: userData,
            totalPages,
            currentPage: page,
            searchTerm: search,
    })


   } catch (error) {
    console.error("Error in customerInfo:", error);
    res.redirect("/pageError");
}
};

const customerBlocked = async (req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{is_Blocked:true}});
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/pageError");
    }
};


const customerunBlocked = async (req,res)=>{
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{is_Blocked:false}})
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/pageError")
    }
}




module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked,
};