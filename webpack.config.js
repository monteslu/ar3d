'use strict';

var path = require('path');

module.exports = {
  entry: {
    main: path.join(__dirname, './src/main.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.join(__dirname, './')
  },
  resolveLoader: {
    root: path.join(__dirname, 'node_modules')
  },
  module: {
    loaders: [
      {
        test: /\.json$/,
        loader: "json"
      }
    ]
  },
  bail: false
};
