const path = require('path');

module.exports = {
  entry: {
    widget: './src/components/WeatherWidget.jsx',
    page: './src/components/WeatherPage.jsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react'],
          },
        },
      },
    ],
  },
  externals: {
    react: 'react',
    'react-dom': 'react-dom',
    '@mui/material': '@mui/material',
    '@mui/icons-material': '@mui/icons-material',
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  mode: 'production',
};

