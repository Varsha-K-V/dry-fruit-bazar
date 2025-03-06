const Order = require("../../models/orderSchema.js");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit-table");
const fs = require("fs");



function getDateFilter(reportType, startDate, endDate) {
  let dateFilter = {};

  if (reportType === "custom" && startDate && endDate) {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);
    dateFilter = {
      createdAt: { $gte: new Date(start), $lte: new Date(end) },
    };
  }

  if (reportType === "daily") {
    dateFilter = {
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0)),
        $lt: new Date(),
      },
    };
  } else if (reportType === "weekly") {
    dateFilter = {
      createdAt: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
        $lt: new Date(),
      },
    };
  } else if (reportType === "monthly") {
    dateFilter = {
      createdAt: {
        $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        $lt: new Date(),
      },
    };
  } else if (reportType === "yearly") {
    dateFilter = {
      createdAt: {
        $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        $lt: new Date(),
      },
    };
  }

  return dateFilter;
}


const getSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      reportType = "daily",
      page = 1,
      limit = 10,
    } = req.query;

    const dateFilter = getDateFilter(reportType, startDate, endDate);

    

   

    
    const currentPage = parseInt(page) || 1;
    const itemPerPage = parseInt(limit) || 10;

    

    const orders = await Order.find({ ...dateFilter, status: 'Delivered' })
      .populate("products.productId")
      .skip((currentPage - 1) * itemPerPage)
      .limit(itemPerPage);

    
    let totalOrdersCount = await Order.countDocuments({ ...dateFilter, status: 'Delivered' });
    let totalAmount = 0;
    let totalDiscount = 0;

    orders.forEach((order) => {
      totalAmount += order.totalAmount;

      totalDiscount += order.coupon.discount || 0;
    });

    const totalAmountAfterDiscount = totalAmount - totalDiscount;

    const totalPages = Math.ceil(totalOrdersCount / itemPerPage);

    res.render("salesReport", {
      orders,
      totalOrders: totalOrdersCount,
      totalAmount,
      totalDiscount,
      totalAmountAfterDiscount,
      totalPages,
      currentPage,
      startDate,
      endDate,
      reportType: reportType || "daily",
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(500).send("Error generating sales report");
  }
};

// Generate Excel report
const downloadExcel = async (req, res) => {
  try {
    const { startDate, endDate, reportType } = req.query;
    
    const dateRange = getDateFilter(reportType, startDate, endDate);
    const orders = await Order.find(dateRange).populate("products.productId");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.addRow([
      "Order ID",
      "Date",
      "Customer",
      "Products",
      "Amount",
      "Discount",
      "Final Amount",
    ]).font = { bold: true };

    let totalAmount = 0,
      totalDiscount = 0;
    orders.forEach((order) => {
      const finalAmount = order.totalAmount - (order.coupon?.discount || 0);
      totalAmount += order.totalAmount;
      totalDiscount += order.coupon?.discount || 0;

      worksheet.addRow([
        order._id,
        order.createdAt.toLocaleDateString(),
        order.shippingAddress?.name || "N/A",
        order.products
          .map((p) => `${p.productId.productName} (${p.quantity})`)
          .join(", "),
        order.totalAmount,
        order.coupon?.discount || 0,
        finalAmount,
      ]);
    });

    worksheet.addRow([]);
    worksheet.addRow(["Total Sales", totalAmount]);
    worksheet.addRow(["Total Discounts", totalDiscount]);
    worksheet.addRow(["Total Final Amount", totalAmount - totalDiscount]).font =
      { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error generating Excel report:", error);
    res.status(500).send("Error generating Excel report");
  }
};


const downloadPDF = async (req, res) => {
  try {
    const { startDate, endDate, reportType } = req.query;
    
    const dateRange = getDateFilter(reportType, startDate, endDate);
    const orders = await Order.find(dateRange).populate("products.productId");

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report.pdf`
    );
    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("Sales Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
        { align: "center" }
      );
    doc.moveDown();

    let totalAmount = 0,
      totalDiscount = 0;
    orders.forEach((order) => {
      totalAmount += order.totalAmount;
      totalDiscount += order.coupon?.discount || 0;
    });

    const summaryTable = {
      title: "Summary",
      headers: ["Total Orders", "Total Amount", "Total Discount", "Net Amount"],
      rows: [
        [
          orders.length,
          `₹${totalAmount.toFixed(2)}`,
          `₹${totalDiscount.toFixed(2)}`,
          `₹${(totalAmount - totalDiscount).toFixed(2)}`,
        ],
      ],
    };

    await doc.table(summaryTable, { width: 500 });
    doc.moveDown();

    const orderTable = {
      title: "Order Details",
      headers: [
        "Order ID",
        "Date",
        "Customer",
        "Products",
        "Amount",
        "Discount",
        "Final Amount",
      ],
      rows: orders.map((order) => [
        order._id,
        order.createdAt.toLocaleDateString(),
        order.shippingAddress?.name || "N/A",
        order.products
          .map((p) => `${p.productId.productName} (${p.quantity})`)
          .join(", "),
        `₹${order.totalAmount.toFixed(2)}`,
        `₹${(order.coupon?.discount || 0).toFixed(2)}`,
        `₹${(order.totalAmount - (order.coupon?.discount || 0)).toFixed(2)}`,
      ]),
    };

    await doc.table(orderTable, { width: 500 });
    doc.moveDown();
    doc
      .fontSize(8)
      .text("Generated on: " + new Date().toLocaleString(), { align: "right" });
    doc.end();
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res.status(500).send("Error generating PDF report");
  }
};

module.exports = {
  getSalesReport,
  downloadExcel,
  downloadPDF,
};
