require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-sdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://localchefbazar-5d073.web.app"],
    credentials: true,
  })
);
app.use(express.json());

// Firebase Token

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    req.decoded_uid = decoded.uid;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

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
    // await client.connect();
    const db = client.db("LocalChefBazarDB");

    // collectons of db

    const mealsCollection = db.collection("meals");
    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("orders");
    const requestsCollection = db.collection("requests");

    //  meals api

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

    app.post("/meals", verifyFBToken, async (req, res) => {
      const meal = req.body;
      meal.price = Number(meal.price);
      const result = await mealsCollection.insertOne(meal);
      res.send({ insertedId: result.insertedId });
    });

    app.delete("/meals/:id", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const result = await mealsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ deletedCount: result.deletedCount });
    });

    app.patch("/meals/:id", verifyFBToken, async (req, res) => {
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

    // users api is here

    app.post("/users", async (req, res) => {
      const user = req.body;

      const existing = await usersCollection.findOne({ email: user.email });
      if (existing) return res.send(existing);

      user.role = "user";
      user.status = "active";

      const result = await usersCollection.insertOne(user);
      res.send({ insertedId: result.insertedId });
    });

    app.get("/users", async (req, res) => {
      const { email } = req.query;
      const query = email ? { email } : {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.patch("/users/:email", verifyFBToken, async (req, res) => {
      const { email } = req.params;
      const { name, photoURL, address } = req.body;

      const updateData = {};
      if (name) updateData.name = name;
      if (photoURL) updateData.photoURL = photoURL;
      if (address) updateData.address = address;

      const result = await usersCollection.updateOne(
        { email },
        { $set: updateData }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    app.patch("/users/:email/status", verifyFBToken, async (req, res) => {
      const { email } = req.params;
      const { status } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        { $set: { status } }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    // reviews all iapi is herre

    app.get("/reviews", async (req, res) => {
      const { foodId, reviewerEmail } = req.query;
      const query = {};
      if (foodId) query.foodId = foodId;
      if (reviewerEmail) query.reviewerEmail = reviewerEmail;

      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    app.post("/reviews", verifyFBToken, async (req, res) => {
      try {
        const review = req.body;

        const result = await reviewsCollection.insertOne(review);

        const foodId = review.foodId;
        const allReviews = await reviewsCollection.find({ foodId }).toArray();

        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = (totalRating / allReviews.length).toFixed(1);

        await mealsCollection.updateOne(
          { _id: new ObjectId(foodId) },
          { $set: { rating: parseFloat(averageRating) } }
        );

        res.send({ insertedId: result.insertedId, newRating: averageRating });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add review" });
      }
    });

    app.delete("/reviews/:id", verifyFBToken, async (req, res) => {
      try {
        const { id } = req.params;

        const review = await reviewsCollection.findOne({
          _id: new ObjectId(id),
        });
        const foodId = review?.foodId;

        const result = await reviewsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (foodId) {
          const allReviews = await reviewsCollection.find({ foodId }).toArray();

          if (allReviews.length > 0) {
            const totalRating = allReviews.reduce(
              (sum, r) => sum + r.rating,
              0
            );
            const averageRating = (totalRating / allReviews.length).toFixed(1);

            await mealsCollection.updateOne(
              { _id: new ObjectId(foodId) },
              { $set: { rating: parseFloat(averageRating) } }
            );
          } else {
            await mealsCollection.updateOne(
              { _id: new ObjectId(foodId) },
              { $set: { rating: 0 } }
            );
          }
        }

        res.send({ deletedCount: result.deletedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to delete review" });
      }
    });

    app.patch("/reviews/:id", verifyFBToken, async (req, res) => {
      try {
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

        const review = await reviewsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (review?.foodId) {
          const allReviews = await reviewsCollection
            .find({ foodId: review.foodId })
            .toArray();

          const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
          const averageRating = (totalRating / allReviews.length).toFixed(1);

          await mealsCollection.updateOne(
            { _id: new ObjectId(review.foodId) },
            { $set: { rating: parseFloat(averageRating) } }
          );
        }

        res.send({ modifiedCount: result.modifiedCount });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to update review" });
      }
    });

    // favoruites apis is here

    app.get("/favorites", verifyFBToken, async (req, res) => {
      const { userEmail } = req.query;
      const favorites = await favoritesCollection.find({ userEmail }).toArray();
      res.send(favorites);
    });

    app.post("/favorites", verifyFBToken, async (req, res) => {
      const favorite = req.body;

      const exists = await favoritesCollection.findOne({
        userEmail: favorite.userEmail,
        mealId: favorite.mealId,
      });

      if (exists) return res.status(409).send({ message: "Already exists" });

      const result = await favoritesCollection.insertOne(favorite);
      res.send({ insertedId: result.insertedId });
    });

    app.delete("/favorites/:id", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ deletedCount: result.deletedCount });
    });

    // all order apis
    app.get("/orders", verifyFBToken, async (req, res) => {
      const { userEmail } = req.query;
      const query = userEmail ? { userEmail } : {};
      const orders = await ordersCollection.find(query).toArray();
      res.send(orders);
    });

    app.post("/orders", verifyFBToken, async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send({ insertedId: result.insertedId });
    });

    app.patch("/orders/:id", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const { orderStatus } = req.body;

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { orderStatus } }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    app.patch("/orders/:id/payment", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const { paymentStatus } = req.body;

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus } }
      );
      res.send({ modifiedCount: result.modifiedCount });
    });

    //  request apis

    app.get("/requests", async (req, res) => {
      const requests = await requestsCollection.find().toArray();
      res.send(requests);
    });

    app.post("/requests", verifyFBToken, async (req, res) => {
      const request = req.body;

      request.requestStatus = "pending";
      request.requestTime = new Date().toISOString();

      const result = await requestsCollection.insertOne(request);
      res.send({ insertedId: result.insertedId });
    });
    app.patch("/requests/:id", verifyFBToken, async (req, res) => {
      const { id } = req.params;
      const { requestStatus } = req.body;

      try {
        const request = await requestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).send({ message: "Request not found" });
        }

        await requestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { requestStatus } }
        );

        if (requestStatus === "approved") {
          const updateData = {
            role: request.requestType,
          };

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

    // strip payment related api

    app.post("/create-payment-intent", verifyFBToken, async (req, res) => {
      const { amount } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("Payment intent error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    app.post("/payment-history", verifyFBToken, async (req, res) => {
      const paymentData = req.body;

      try {
        const paymentHistoryCollection = db.collection("payment_history");
        const result = await paymentHistoryCollection.insertOne(paymentData);
        res.send({ insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected");
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello LocalChefBazar!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
