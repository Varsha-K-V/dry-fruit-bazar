const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");

const bcrypt = require('bcrypt');
const env=require("dotenv").config();

const loadAddress =  async (req,res)=>{
    try {
        const userId = req.session.user;
        const addresses = await Address.find({userId});

      

        res.render('addressManagement', {
            addresses, 
        });

    } catch (error) {
        console.error('Error loading address management page:', error);
        res.status(500).send('An error occurred while loading the address management page.');
}
}

const addAddress = async (req, res) => {
    
    try {
        const { name, addresstype, city, state, pincode, landmark, alternativeNo } = req.body;

        
        if (!name || !pincode || !city || !state || !landmark) {
            return res.status(400).json({ success: false, message: 'All fields are required!' });
            
        }

        
        const newAddress = new Address({
            userId: req.user._id,
            name,  
            pincode,
            city,
            state,
            landmark,
            alternativeNo,
            addresstype: addresstype ? addresstype.charAt(0).toUpperCase() + addresstype.slice(1).toLowerCase() : 'Home',  
        });

        console.log(newAddress)

        
        await newAddress.save();

        res.json({ success: true, message: 'Address added successfully!' });

    } catch (error) {
        console.error('Error adding address:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again later!' });

    }
};


const updateAddress = async (req, res) => {
    try {
        const { address_id, name, addresstype, city, state, pincode, landmark, alternativeNo } = req.body;

        
        const updatedAddress = await Address.findByIdAndUpdate(
            address_id,
            {
                name, 
                addresstype,
                city,
                state,
                pincode,
                landmark,
                alternativeNo,
            },
            { new: true, runValidators: true } 
        );

        
        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found!' });

        }

        
        res.json({ success: true, message: 'Address updated successfully!' });


    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again later!' });
    }

};


const deleteAddress = async (req,res)=>{
    const {id} = req.params;
    try {
        
      const deleteAddress = await Address.findByIdAndDelete(id);
      if(!deleteAddress){
        return res.status(404).json({success:false,message:"Addres not found"})

      }
      return res.json({ success: true, message: 'Address deleted successfully!' });


    } catch (error) {
        console.error("deleting error",error.message);

    }
}


const changePassword = async(req,res)=>{
    try {
        const userId = req.session.user._id;
        const user = await User.findById(req.session.user._id);

        if (!user) return res.json({ success: false, message: "User not found!" });

        res.render('changePassword', { user });


        
    } catch (error) {
        console.error('Error loading change password page:', error);
    }
}


const updatePassword = async(req,res)=>{
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.session.user._id);

        if (!user) return res.json({ success: false, message: "User not found!" });
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) return res.json({ success: false, message: "Incorrect current password!" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: "Password updated successfully!" });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Server error, please try again." });
    }
}

 
module.exports ={
    loadAddress,
    addAddress,
    updateAddress,
    deleteAddress,
    changePassword,
    updatePassword,
}