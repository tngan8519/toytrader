var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var Toy = require("./models/toy");
var User = require("./models/user");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var methodOverride = require("method-override");
var multer = require("multer");
var path = require("path");
var fs = require("fs");
var flash = require("connect-flash");

var storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, callback) {
    callback(null, Date.now() + path.extname(file.originalname));
  },
});

var imageFilter = function (req, file, callback) {
  var filetypes = /jpeg|jpg|png|gif/;
  var extcheck = filetypes.test(path.extname(file.originalname).toLowerCase());
  var mimecheck = filetypes.test(file.mimetype);

  if (extcheck && mimecheck) {
    callback(null, true);
  } else {
    callback("Error: Upload Image Only");
  }
};

var upload = multer({
  storage: storage,
  limit: { fileSize: 10000000 },
  fileFilter: imageFilter,
});

mongoose.connect("mongodb://localhost:27017/toy_trader", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));

// PASSPORT CONFIGURATION
app.use(
  require("express-session")({
    secret: "toytrader",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
  res.locals.tkdalogin = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/registerT", function (req, res) {
  res.render("register");
});

app.post("/registerT", function (req, res) {
  User.register(
    new User({ username: req.body.username }),
    req.body.password,
    function (err, user) {
      if (err) {
        req.flash("error", err.message);
        res.render("register");
      } else {
        passport.authenticate("local")(req, res, function () {
          req.flash(
            "success",
            "Congratulation, you are signed up successfully as " +
              req.body.username
          );
          res.redirect("/");
        });
      }
    }
  );
});

app.get("/loginT", function (req, res) {
  res.render("login");
});

app.post(
  "/loginT",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/loginT",
  }),
  function (req, res) {}
);

app.get("/logoutT", isLoggedIn, function (req, res) {
  req.logOut();
  req.flash("success", "You are logged out successfully!");
  res.redirect("/");
});

app.get("/postT", isLoggedIn, function (req, res) {
  res.render("post");
});

app.post("/postT", isLoggedIn, function (req, res) {
  upload.single("myImage")(req, res, function (err) {
    if (err) {
      res.render("post");
    } else {
      if (req.file == undefined) {
        res.render("post");
      } else {
        var newToy = {
          name: req.body.toyname,
          rentPrice: req.body.rentprice,
          salePrice: req.body.saleprice,
          imageSrc: `uploads/${req.file.filename}`,
          author: { id: req.user._id, username: req.user.username },
        };

        Toy.create(newToy, function (err, newlyCreated) {
          if (err) {
            res.redirect("back");
          } else {
            res.redirect("/browseT");
          }
        });
      }
    }
  });
});

app.get("/browseT", function (req, res) {
  Toy.find({}, function (err, allToys) {
    if (err) {
      res.redirect("back");
    } else {
      res.render("browse", { toys: allToys });
    }
  });
});

app.get("/toyT/:id", function (req, res) {
  Toy.findById(req.params.id, function (err, foundToy) {
    if (err) {
      console.log(err);
    } else {
      res.render("detail", { toy: foundToy });
    }
  });
});
app.get("/toyT/:id/editT", checkToyAuthor, function (req, res) {
  Toy.findById(req.params.id, function (err, foundToy) {
    if (err) {
      console.log(err);
    } else {
      res.render("edit", { toy: foundToy });
    }
  });
});

app.put("/toyT/:id", checkToyAuthor, upload.single("myImage"), function (
  req,
  res
) {
  Toy.findById(req.params.id, function (err, foundToy) {
    if (err) {
      req.flash("error", err.message);
      res.redirect("back");
    } else {
      if (req.file) {
        fs.unlinkSync(`${__dirname}/public/${foundToy.imageSrc}`, function (
          err
        ) {
          if (err) {
            req.flash("error", err.message);
            res.redirect("back");
            console.log(err);
          }
        });
        foundToy.imageSrc = `uploads/${req.file.filename}`;
      }
      foundToy.name = req.body.toyname;
      foundToy.rentPrice = req.body.rentprice;
      foundToy.salePrice = req.body.saleprice;
      foundToy.save();
      res.redirect("/toyT/" + req.params.id);
    }
  });
});

app.delete("/toyT/:id", checkToyAuthor, function (req, res) {
  Toy.findById(req.params.id, function (err, foundToy) {
    if (err) {
      req.flash("error", err.message);
      res.redirect("back");
    } else {
      fs.unlinkSync(`${__dirname}/public/${foundToy.imageSrc}`, function (err) {
        if (err) {
          console.log(err);
          req.flash("error", err.message);
          res.redirect("back");
        }
      });
      foundToy.remove();
      req.flash("success", "Toy is deleted successfully!");
      res.redirect("/browseT");
    }
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash("error", "You must sign in to do that!");
    res.redirect("/loginT");
  }
}

function checkToyAuthor(req, res, next) {
  if (req.isAuthenticated()) {
    Toy.findById(req.params.id, function (err, foundToy) {
      if (err) {
        console.log(err);
        req.flash("error", "You do not have permission to do that!");
        res.redirect("/toyT/" + req.params.id);
      } else {
        if (!foundToy) {
          console.log(err);
          req.flash("error", "You do not have permission to do that!");
          res.redirect("/toyT/" + req.params.id);
        }
        if (foundToy.author.id.equals(req.user._id)) {
          next();
        } else {
          console.log(err);
          req.flash("error", "You do not have permission to do that!");
          res.redirect("/toyT/" + req.params.id);
        }
      }
    });
  }
}

app.listen(3000, function () {
  console.log("Toy trader website has started");
});
