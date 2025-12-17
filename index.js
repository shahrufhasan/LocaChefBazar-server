const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json());

// -------------------- MongoDB --------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cnv9fix.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("LocalChefBazarDB");

    // -------------------- Collections --------------------
    const mealsCollection = db.collection("meals");
    const usersCollection = db.collection("users");
    const ordersCollection = db.collection("orders");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const requestsCollection = db.collection("requests");

    // ====================================================
    // ===================== USERS ========================
    // ====================================================

    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({
        email: user.email,
      });

      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      user.role = "user";
      user.status = "active";

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.get("/users/:email", async (req, res) => {
      const user = await usersCollection.findOne({
        email: req.params.email,
      });
      res.send(user);
    });

    app.patch("/users/:email/role", async (req, res) => {
      const { role, status, chefId } = req.body;

      const updateDoc = {
        $set: {
          role,
          status,
        },
      };

      if (chefId) updateDoc.$set.chefId = chefId;

      const result = await usersCollection.updateOne(
        { email: req.params.email },
        updateDoc
      );

      res.send(result);
    });

    // ====================================================
    // ===================== MEALS ========================
    // ====================================================

    app.get("/meals", async (req, res) => {
      const meals = await mealsCollection.find().toArray();
      res.send(meals);
    });

    app.get("/meals/:id", async (req, res) => {
      const meal = await mealsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(meal);
    });

    app.post("/meals", async (req, res) => {
      const meal = req.body;
      meal.price = Number(meal.price); // IMPORTANT FIX
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });

    // ====================================================
    // ===================== ORDERS =======================
    // ====================================================

    app.post("/orders", async (req, res) => {
      const order = req.body;
      order.orderTime = new Date().toISOString();
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders", async (req, res) => {
      const { userEmail } = req.query;
      const query = userEmail ? { userEmail } : {};
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });

    // ====================================================
    // ===================== REVIEWS ======================
    // ====================================================

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      review.createdAt = new Date().toISOString();
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const { foodId, reviewerEmail } = req.query;
      const query = {};
      if (foodId) query.foodId = foodId;
      if (reviewerEmail) query.reviewerEmail = reviewerEmail;

      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    // ====================================================
    // ===================== FAVORITES ====================
    // ====================================================

    app.post("/favorites", async (req, res) => {
      const favorite = req.body;

      const exists = await favoritesCollection.findOne({
        userEmail: favorite.userEmail,
        mealId: favorite.mealId,
      });

      if (exists) {
        return res.status(409).send({ message: "Already in favorites" });
      }

      const result = await favoritesCollection.insertOne(favorite);
      res.send(result);
    });

    app.get("/favorites", async (req, res) => {
      const { userEmail } = req.query;
      const favorites = await favoritesCollection.find({ userEmail }).toArray();
      res.send(favorites);
    });

    // ====================================================
    // ===================== REQUESTS =====================
    // ====================================================

    app.post("/requests", async (req, res) => {
      const request = req.body;

      request.requestStatus = "pending";
      request.requestTime = new Date().toISOString();

      const result = await requestsCollection.insertOne(request);
      res.send(result);
    });

    app.get("/requests", async (req, res) => {
      const requests = await requestsCollection.find().toArray();
      res.send(requests);
    });

    // Approve / Reject request
    app.patch("/requests/:id", async (req, res) => {
      const { requestStatus } = req.body;
      const id = req.params.id;

      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!request) {
        return res.status(404).send({ message: "Request not found" });
      }

      // Update request status
      await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus } }
      );

      // If approved → update user role
      if (requestStatus === "approved") {
        const updateData = {
          role: request.requestType,
          status: "active",
        };

        if (request.requestType === "chef") {
          updateData.chefId = `CHEF-${Date.now()}`;
        }

        await usersCollection.updateOne(
          { email: request.userEmail },
          { $set: updateData }
        );
      }

      res.send({ modifiedCount: 1 });
    });

    // ====================================================
    console.log("MongoDB connected successfully!");
  } finally {
  }
}

run().catch(console.dir);

// -------------------- Root Route --------------------
app.get("/", (req, res) => {
  res.send("LocalChefBazar API is running ");
});

// -------------------- Server --------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
