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

// Mongo Client
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

    // ================= Collections =================
    const mealsCollection = db.collection("meals");
    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("orders");
    const requestsCollection = db.collection("requests");
    // ===============================================

    /* ===================== MEALS ===================== */
    app.get("/meals", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      try {
        const meals = await mealsCollection
          .find()
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalMeals = await mealsCollection.countDocuments();

        res.send({
          meals,
          totalMeals,
          currentPage: page,
          totalPages: Math.ceil(totalMeals / limit),
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch meals" });
      }
    });

    app.post("/meals", async (req, res) => {
      const meal = req.body;
      meal.price = Number(meal.price);
      const result = await mealsCollection.insertOne(meal);
      res.send({ insertedId: result.insertedId });
    });

    app.delete("/meals/:id", async (req, res) => {
      const { id } = req.params;
      const result = await mealsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ deletedCount: result.deletedCount });
    });

    app.patch("/meals/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      if (updateData.price) {
        updateData.price = Number(updateData.price);
      }

      delete updateData._id;

      const result = await mealsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      res.send({ modifiedCount: result.modifiedCount });
    });

    /* ===================== USERS ===================== */

    // Create user
    app.post("/users", async (req, res) => {
      const user = req.body;

      const existing = await usersCollection.findOne({ email: user.email });
      if (existing) return res.send(existing);

      user.role = "user";
      user.status = "active";

      const result = await usersCollection.insertOne(user);
      res.send({ insertedId: result.insertedId });
    });

    // Get users (or single user by email)
    app.get("/users", async (req, res) => {
      const { email } = req.query;
      const query = email ? { email } : {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.patch("/users/:email/status", async (req, res) => {
      const { email } = req.params;
      const { status } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $set: { status } }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    /* ===================== REVIEWS ===================== */
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

    app.delete("/reviews/:id", async (req, res) => {
      const { id } = req.params;
      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ deletedCount: result.deletedCount });
    });

    app.patch("/reviews/:id", async (req, res) => {
      const { id } = req.params;
      const { rating, comment } = req.body;

      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            rating: Number(rating),
            comment,
            date: new Date().toISOString(),
          },
        }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    /* ===================== FAVORITES ===================== */
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

      if (exists) return res.status(409).send({ message: "Already exists" });

      const result = await favoritesCollection.insertOne(favorite);
      res.send({ insertedId: result.insertedId });
    });

    app.delete("/favorites/:id", async (req, res) => {
      const { id } = req.params;
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ deletedCount: result.deletedCount });
    });

    /* ===================== ORDERS ===================== */
    app.get("/orders", async (req, res) => {
      const { userEmail } = req.query;
      const query = userEmail ? { userEmail } : {};
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send({ insertedId: result.insertedId });
    });

    app.patch("/orders/:id", async (req, res) => {
      const { id } = req.params;
      const { orderStatus } = req.body;

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { orderStatus } }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    app.patch("/orders/:id/payment", async (req, res) => {
      const { id } = req.params;
      const { paymentStatus } = req.body;

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus } }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    /* ===================== REQUESTS ===================== */

    // Get requests
    app.get("/requests", async (req, res) => {
      const requests = await requestsCollection.find().toArray();
      res.send(requests);
    });

    // Create request
    app.post("/requests", async (req, res) => {
      const request = req.body;

      request.requestStatus = "pending";
      request.requestTime = new Date().toISOString();

      const result = await requestsCollection.insertOne(request);
      res.send({ insertedId: result.insertedId });
    });

    app.patch("/requests/:id", async (req, res) => {
      const { id } = req.params;
      const { requestStatus } = req.body;

      try {
        const request = await requestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).send({ message: "Request not found" });
        }

        //  Update request status
        await requestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { requestStatus } }
        );

        // If approved → update user role
        if (requestStatus === "approved") {
          const updateData = {
            role: request.requestType,
          };

          // Generate ChefId if request type is chef
          if (request.requestType === "chef") {
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            updateData.chefId = `CHEF-${randomNum}`;
          }

          await usersCollection.updateOne(
            { email: request.userEmail },
            { $set: updateData }
          );
        }

        res.send({
          modifiedCount: 1,
          message: `Request ${requestStatus} successfully`,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update request" });
      }
    });

    // Ping DB
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected");
  } finally {
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
