const lab = db.getSiblingDB("gimmejob_lab");
lab.dropDatabase();

const regions = ["EU", "US", "APAC", "LATAM"];
const tiers = ["free", "plus", "pro"];
const categories = ["keyboards", "mice", "audio", "monitors", "storage", "networking"];
const statuses = ["new", "paid", "shipped", "cancelled"];
const channels = ["web", "mobile", "partner"];

const users = [];
for (let id = 1; id <= 1000; id += 1) {
  users.push({
    userId: id,
    email: `user${id}@example.com`,
    region: regions[id % regions.length],
    profile: {
      tier: tiers[id % tiers.length],
      active: id % 11 !== 0,
    },
    tags: id % 5 === 0 ? ["beta", "newsletter"] : ["newsletter"],
    createdAt: new Date(Date.UTC(2025, id % 12, (id % 27) + 1)),
  });
}
lab.users.insertMany(users);

const products = [];
for (let id = 1; id <= 120; id += 1) {
  products.push({
    productId: id,
    sku: `SKU-${String(id).padStart(4, "0")}`,
    name: `Demo product ${id}`,
    category: categories[id % categories.length],
    price: Number((14.5 + (id % 37) * 3.25).toFixed(2)),
    stock: 20 + (id * 17) % 300,
    attributes: {
      wireless: id % 2 === 0,
      rating: Number((3.5 + (id % 15) / 10).toFixed(1)),
    },
  });
}
lab.products.insertMany(products);

const orders = [];
for (let id = 1; id <= 8000; id += 1) {
  const user = users[(id * 7) % users.length];
  const itemCount = 1 + (id % 3);
  const items = [];
  let totalAmount = 0;
  for (let index = 0; index < itemCount; index += 1) {
    const product = products[(id * 11 + index * 13) % products.length];
    const quantity = 1 + ((id + index) % 3);
    totalAmount += product.price * quantity;
    items.push({
      productId: product.productId,
      sku: product.sku,
      category: product.category,
      quantity,
      unitPrice: product.price,
    });
  }
  orders.push({
    orderId: id,
    status: statuses[id % statuses.length],
    channel: channels[id % channels.length],
    user: {
      userId: user.userId,
      email: user.email,
      region: user.region,
      tier: user.profile.tier,
    },
    items,
    totalAmount: Number(totalAmount.toFixed(2)),
    shipping: {
      country: user.region === "US" ? "US" : user.region === "EU" ? "DE" : user.region === "APAC" ? "JP" : "BR",
      expedited: id % 9 === 0,
    },
    createdAt: new Date(Date.UTC(2026, id % 9, (id % 27) + 1, id % 24, id % 60)),
  });
  if (orders.length === 1000) {
    lab.orders.insertMany(orders);
    orders.length = 0;
  }
}
if (orders.length) lab.orders.insertMany(orders);

lab.users.createIndex({ email: 1 }, { unique: true });
lab.users.createIndex({ region: 1, "profile.tier": 1 });
lab.products.createIndex({ sku: 1 }, { unique: true });
lab.products.createIndex({ category: 1 });
lab.orders.createIndex({ orderId: 1 }, { unique: true });
lab.orders.createIndex({ status: 1, createdAt: -1 });
lab.orders.createIndex({ "user.userId": 1 });
lab.orders.createIndex({ "items.sku": 1 });

lab.getCollection("__gimmejob_meta").insertOne({ fixtureVersion: 1, createdAt: new Date() });
