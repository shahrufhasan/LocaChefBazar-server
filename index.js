const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

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
    // Connect client
    await client.connect();

    const db = client.db("LocalChefBazarDB");

    // ===== Collections =====
    const mealsCollection = db.collection("meals");
    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("order_collection");
    // =======================

    // Meals API
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

    // Users API
    app.post("/users", async (req, res) => {
      try {
        const user = req.body; // { name, email, photoURL, address, role }

        // Check if user already exists
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

    // Reviews API
    app.get("/reviews", async (req, res) => {
      try {
        const { foodId } = req.query;
        const reviews = await reviewsCollection.find({ foodId }).toArray();
        res.send(reviews);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body; // foodId, reviewerName, reviewerImage, rating, comment, date
        const result = await reviewsCollection.insertOne(review);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Favorites API
    app.post("/favorites", async (req, res) => {
      try {
        const favorite = req.body; // userEmail, mealId, mealName, chefId, chefName, price, addedTime

        // check if already exists
        const exists = await favoritesCollection.findOne({
          userEmail: favorite.userEmail,
          mealId: favorite.mealId,
        });

        if (exists) {
          return res.status(409).send({ message: "Meal already in favorites" });
        }

        const result = await favoritesCollection.insertOne(favorite);
        res.send({ insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Orders Api
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body; // full order data
        const result = await ordersCollection.insertOne(order);
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
    // Do not close client to keep server running
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
