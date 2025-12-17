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

// Create MongoClient
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

    // ===== Collections =====
    const mealsCollection = db.collection("meals");
    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("orders");
    const requestsCollection = db.collection("requests");
    // =======================

    // -------------------- Meals API --------------------
    app.get("/meals", async (req, res) => {
      try {
        const meals = await mealsCollection.find().toArray();
        res.send(meals);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/meals", async (req, res) => {
      try {
        const meal = req.body;
        const result = await mealsCollection.insertOne(meal);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // -------------------- Users API --------------------
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        const existingUser = await usersCollection.findOne({
          email: user.email,
        });
        if (existingUser) {
          return res.status(409).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne(user);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Get all users (admin dashboard)
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Update user role/status
    app.patch("/users/:email/role", async (req, res) => {
      try {
        const { email } = req.params;
        const { role, status, chefId } = req.body;

        const updateFields = { role, status };
        if (chefId) updateFields.chefId = chefId;

        const result = await usersCollection.updateOne(
          { email },
          { $set: updateFields }
        );

        if (result.modifiedCount === 1) {
          res.send({ message: "User role updated successfully" });
        } else {
          res
            .status(404)
            .send({ message: "User not found or already updated" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // -------------------- Reviews API --------------------
    app.get("/reviews", async (req, res) => {
      try {
        const { foodId, reviewerEmail } = req.query;
        const query = {};
        if (foodId) query.foodId = foodId;
        if (reviewerEmail) query.reviewerEmail = reviewerEmail;
        const reviews = await reviewsCollection.find(query).toArray();
        res.send(reviews);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;
        const result = await reviewsCollection.insertOne(review);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // -------------------- Favorites API --------------------
    app.get("/favorites", async (req, res) => {
      try {
        const { userEmail } = req.query;
        const favorites = await favoritesCollection
          .find({ userEmail })
          .toArray();
        res.send(favorites);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/favorites", async (req, res) => {
      try {
        const favorite = req.body;
        const exists = await favoritesCollection.findOne({
          userEmail: favorite.userEmail,
          mealId: favorite.mealId,
        });

        if (exists)
          return res.status(409).send({ message: "Meal already in favorites" });

        const result = await favoritesCollection.insertOne(favorite);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // -------------------- Orders API --------------------
    app.get("/orders", async (req, res) => {
      try {
        const { userEmail } = req.query;
        const orders = await ordersCollection.find({ userEmail }).toArray();
        res.send(orders);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;
        const result = await ordersCollection.insertOne(order);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // -------------------- Requests API --------------------
    app.get("/requests", async (req, res) => {
      try {
        const requests = await requestsCollection.find().toArray();
        res.send(requests);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/requests", async (req, res) => {
      try {
        const request = req.body;
        request.requestStatus = "pending";
        request.requestTime = new Date().toISOString();
        const result = await requestsCollection.insertOne(request);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Ping MongoDB
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } finally {
    // Keep server running
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  res.send("Hello LocalChefBazar!");
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
