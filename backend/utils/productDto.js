function toProductDto(product) {
  return {
    id: String(product._id),
    sellerId: String(product.sellerId),
    title: product.title,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

module.exports = { toProductDto };
