[
  {
    $match: {
      items: { $exists: true, $ne: [] }
    }
  },
  {
    $project: {
      invoiceNumber: 1,
      odooId: 1,
      projectId: 1,
      projectCode: 1,
      vendor: "$vendor.name",
      date: 1,
      type: 1,
      items: 1
    }
  },
  {
    $unwind: "$items"
  },
  {
    $group: {
      _id: {
        docId: "$_id",
        invoiceNumber: "$invoiceNumber",
        projectId: "$items.projectId",
        projectCode: "$items.projectCode",
        productId: "$items.productId",
        subtotal: "$items.subtotal"
      },
      count: { $sum: 1 },
      items: {
        $push: {
          title: "$items.title",
          quantity: "$items.quantity",
          priceUnit: "$items.priceUnit",
          subtotal: "$items.subtotal",
          sourceDocument: "$items.sourceDocument"
        }
      },
      vendor: { $first: "$vendor" },
      date: { $first: "$date" },
      type: { $first: "$type" },
      odooId: { $first: "$odooId" }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      docId: "$_id.docId",
      invoiceNumber: "$_id.invoiceNumber",
      odooId: 1,
      vendor: 1,
      date: 1,
      type: 1,
      projectId: "$_id.projectId",
      projectCode: "$_id.projectCode",
      productId: "$_id.productId",
      subtotal: "$_id.subtotal",
      duplicateCount: "$count",
      items: 1
    }
  },
  {
    $sort: {
      projectCode: 1,
      invoiceNumber: 1,
      productId: 1,
      subtotal: 1
    }
  }
]