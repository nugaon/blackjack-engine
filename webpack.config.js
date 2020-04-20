const path = require('path');

module.exports = {
  entry: "./src/index.ts",
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: "index.js"
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".json"]
  },
  mode: process.env.NODE_ENV,
  module: {
    rules: [
      // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
      {
        test: /\.tsx?$/,
        use: ["ts-loader"],
        exclude: /node_modules/
      }
    ]
  }
};
