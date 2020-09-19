var mongoose = require("mongoose");

var toySchema = new mongoose.Schema({
  name: String,
  rentPrice: String,
  salePrice: String,
  imageSrc: String,
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    username: String,
  },

  created: { type: Date, default: Date.now },
});

var Toy = mongoose.model("Toy", toySchema);

module.exports = Toy;
