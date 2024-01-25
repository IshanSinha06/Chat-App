const mongoose = require("mongoose");

// Connect the node to the mongodb database with the name "Chatbot".

mongoose
  .connect("mongodb+srv://ishansinha1990:Impossible1234@cluster0.pclav4r.mongodb.net/?retryWrites=true&w=majority")

  // When it is connected
  .then(() => {
    console.log("mongodb connected");
  })

  // When it is not connected.
  .catch(() => {
    console.log("Connection failed!");
  });

// Create a schema.
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  is_online: {
    type: String,
    default: 0,
  },
});

const collection = new mongoose.model("User", userSchema);

module.exports = collection;
