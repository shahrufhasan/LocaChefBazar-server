// index.js
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
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

    // Collections
    const mealsCollection = db.collection("meals");
    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("orders");
    const requestsCollection = db.collection("requests");

    // ---------- Meals API ----------
    app.get("/meals", async (req, res) => {
      const meals = await mealsCollection.find().toArray();
      res.send(meals);
    });

    app.post("/meals", async (req, res) => {
      const meal = req.body;
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });

    // ---------- Users API ----------
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) return res.status(409).send({ message: "User exists" });
      const result = await usersCollection.insertOne(user);
      res.send({ insertedId: result.insertedId });
    });

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Update user role/status
    app.patch("/users/:email/role", async (req, res) => {
      const { email } = req.params;
      const { role, status, chefId } = req.body;
      const updateFields = {};
      if (role) updateFields.role = role;
      if (status) updateFields.status = status;
      if (chefId) updateFields.chefId = chefId;

      const result = await usersCollection.updateOne(
        { email },
        { $set: updateFields }
      );
      if (result.modifiedCount === 1) res.send({ message: "User updated" });
      else res.status(404).send({ message: "User not found" });
    });

    // ---------- Reviews API ----------
    app.get("/reviews", async (req, res) => {
      const { foodId, reviewerEmail } = req.query;
      const query = {};
      if (foodId) query.foodId = foodId;
      if (reviewerEmail) query.reviewerEmail = reviewerEmail;
      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send({ insertedId: result.insertedId });
    });

    // ---------- Favorites API ----------
    app.get("/favorites", async (req, res) => {
      const { userEmail } = req.query;
      const favorites = await favoritesCollection.find({ userEmail }).toArray();
      res.send(favorites);
    });

    app.post("/favorites", async (req, res) => {
      const favorite = req.body;
      const exists = await favoritesCollection.findOne({
        userEmail: favorite.userEmail,
        mealId: favorite.mealId,
      });
      if (exists) return res.status(409).send({ message: "Already favorite" });
      const result = await favoritesCollection.insertOne(favorite);
      res.send({ insertedId: result.insertedId });
    });

    // ---------- Orders API ----------
    app.get("/orders", async (req, res) => {
      const { userEmail } = req.query;
      const orders = await ordersCollection.find({ userEmail }).toArray();
      res.send(orders);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send({ insertedId: result.insertedId });
    });

    // ---------- Requests API ----------
    app.get("/requests", async (req, res) => {
      const requests = await requestsCollection.find().toArray();
      res.send(requests);
    });

    app.post("/requests", async (req, res) => {
      const request = req.body;
      request.requestStatus = "pending";
      request.requestTime = new Date().toISOString();
      const result = await requestsCollection.insertOne(request);
      res.send({ insertedId: result.insertedId });
    });

    // Update request status (approve/reject)
    app.patch("/requests/:id", async (req, res) => {
      const { id } = req.params;
      const { requestStatus } = req.body;

      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!request)
        return res.status(404).send({ message: "Request not found" });

      // Update request
      const result = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus } }
      );

      // If approved, update user role
      if (requestStatus === "approved") {
        await usersCollection.updateOne(
          { email: request.userEmail },
          { $set: { role: request.requestType } }
        );
      }

      res.send({ modifiedCount: result.modifiedCount });
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } finally {
    // keep running
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  res.send("Hello LocalChefBazar!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
