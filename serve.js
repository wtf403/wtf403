const express = require("express");
const app = express();

app.use(express.static("articles"));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
