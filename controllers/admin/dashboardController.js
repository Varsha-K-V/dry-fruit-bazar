const Order = require("../../models/orderSchema.js");
const moment = require('moment')


const loadDashboard = async (req, res) => {
    try {
      
        // Top selling products and categories
        const topProducts = await Order.aggregate([
          { $unwind: "$products" },
          {
            $group: {
              _id: "$products.productId",
              totalSold: { $sum: "$products.quantity" }
            }
          },
          { $sort: { totalSold: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "products",
              localField: "_id",
              foreignField: "_id",
              as: "productDetails"
            }
          },
          {
            $project: {
              name: { $arrayElemAt: ["$productDetails.productName", 0] },
              sales: "$totalSold"
            }
          }
        ]);
        
        const topCategories = await Order.aggregate([
          { $unwind: "$products" },
          {
            $lookup: {
              from: "products",
              localField: "products.productId",
              foreignField: "_id",
              as: "product"
            }
          },
          { $unwind: "$product" },
          {
            $group: {
              _id: "$product.category",
              totalSold: { $sum: "$products.quantity" }
            }
          },
          { $sort: { totalSold: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "categories",
              localField: "_id",
              foreignField: "_id",
              as: "categoryDetails"
            }
          },
          {
            $project: {
              name: { $arrayElemAt: ["$categoryDetails.name", 0] },
              sales: "$totalSold"
            }
          }
        ]);
  
      
        const currentDate = new Date();
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const startOfWeek = new Date(currentDate.getTime() - (currentDate.getDay() * 24 * 60 * 60 * 1000));
  
  
        const salesData = {
          yearly: await getSalesData(startOfYear, 'year'),
          monthly: await getSalesData(startOfMonth, 'month'),
          weekly: await getSalesData(startOfWeek, 'week')
        };

        
  
        return res.render("dashboard", {
            salesData,
          topProducts,
          topCategories,
          salesData: JSON.stringify(salesData)
        });
      
    } catch (error) {
      console.log("dashboard cannot load", error);
      res.redirect("/admin/pageerror");
    }
  };

  async function getSalesData(startDate, period) {
    try {
      const match = { createdAt: { $gte: startDate } };
      let groupBy = {};
      let labels = [];
  
      if (period === 'year') {
        groupBy = { year: { $year: "$createdAt" } };
        
        const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
        labels = years.map(year => year.toString());
      } else if (period === 'month') {
        groupBy = { month: { $month: "$createdAt" } };
        labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      } else if (period === 'week') {
        groupBy = { dayOfWeek: { $dayOfWeek: "$createdAt" } };
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      }
  
      const salesData = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: groupBy,
            totalSales: { $sum: 1 } 
          }
        },
        { $sort: { "_id": 1 } }
      ]);
  
      return {
        labels,
        data: labels.map(label => {
          const sale = salesData.find(s => {
            if (period === 'year') return s._id.year.toString() === label;
            if (period === 'month') return labels[s._id.month - 1] === label;
            if (period === 'week') return `Week ${Math.ceil(s._id.dayOfWeek / 7)}` === label;
          });
          return sale ? sale.totalSales : 0;
        })
      };

      


    } catch (error) {
      console.error('Error getting sales data:', error);
      return { labels: [], data: [] };
    }
  }
  
  
  const getChartData = async (req, res) => {
    try {
        const timeFilter = req.query.timeFilter || 'daily';
        const currentDate = moment();
        let chartData = {};

        if (timeFilter === 'daily') {
            
            const days = [];
            const dailyData = [];

            for (let i = 0; i < 7; i++) {
                const startOfDay = moment().subtract(i, 'days').startOf('day');
                const endOfDay = moment().subtract(i, 'days').endOf('day');

                const daySales = await Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: startOfDay.toDate(),
                                $lte: endOfDay.toDate()
                            },
                            status: 'Delivered'
                        }
                    },
                
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: 1 }
                        }
                    }
                ]);

                days.unshift(startOfDay.format('DD MMM'));
                dailyData.unshift(daySales[0]?.totalSales || 0);
            }

            chartData = {
                labels: days,
                data: dailyData
            };
        } else if (timeFilter === 'weekly') {
            
            const weeks = [];
            const weeklyData = [];

            for (let i = 0; i < 4; i++) {
                const startOfWeek = moment().subtract(i, 'weeks').startOf('week');
                const endOfWeek = moment().subtract(i, 'weeks').endOf('week');

                console.log(`Week ${4 - i}: Start: ${startOfWeek.toISOString()}, End: ${endOfWeek.toISOString()}`);

                const weekSales = await Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: startOfWeek.toDate(),
                                $lte: endOfWeek.toDate()
                            },
                            status: 'Delivered'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: 1 }
                        }
                    }
                ]);

                console.log('weekSales',weekSales)

                weeks.unshift(`Week ${4 - i}`);
                weeklyData.unshift(weekSales[0]?.totalSales || 0);
            }

            chartData = {
                labels: weeks,
                data: weeklyData
            };
        } else if (timeFilter === 'monthly') {
            
            const months = [];
            const monthlyData = [];

            for (let i = 0; i < 12; i++) {
                const startOfMonth = moment().subtract(i, 'months').startOf('month');
                const endOfMonth = moment().subtract(i, 'months').endOf('month');


                const monthSales = await Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: startOfMonth.toDate(),
                                $lte: endOfMonth.toDate()
                            },
                            status: 'Delivered'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: 1 }
                        }
                    }
                ]);

                months.unshift(startOfMonth.format('MMM'));
                monthlyData.unshift(monthSales[0]?.totalSales || 0);
            }

            chartData = {
                labels: months,
                data: monthlyData
            };
        }

        res.json(chartData);
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

  



module.exports = {
     loadDashboard,
    getChartData
};