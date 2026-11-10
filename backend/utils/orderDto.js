function toOrderDto(order) {
  return {
    id: String(order._id), buyerId: String(order.buyerId), sellerId: String(order.sellerId), productId: String(order.productId),
    productTitle: order.productTitle, unitPriceCents: order.unitPriceCents, quantity: order.quantity,
    totalCents: order.totalCents, status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}
module.exports = { toOrderDto };
