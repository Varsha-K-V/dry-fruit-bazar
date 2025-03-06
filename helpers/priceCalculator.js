function calculateFinalPrice(product,variant){
    
        let originalPrice = variant.price;
        let discountedPrice = originalPrice;

        if (product.category && product.category.categoryOffer && product.category.categoryOffer > 0) {
            discountedPrice = originalPrice - (originalPrice * product.category.categoryOffer) / 100;
        }

        if (product.productOffer && product.productOffer > 0) {
            let productOfferPrice = originalPrice - (originalPrice * product.productOffer) / 100;
            discountedPrice = Math.min(discountedPrice, productOfferPrice); 
        }

        return {
            originalPrice: originalPrice.toFixed(2),
            finalPrice: discountedPrice.toFixed(2),
            isDiscounted: discountedPrice < originalPrice,
        };

       
   
}
module.exports = calculateFinalPrice ;