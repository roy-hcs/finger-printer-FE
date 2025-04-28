module.exports = {
  pwa: {
    name: 'Vue WebAuthn PWA',
    themeColor: '#4DBA87',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',
    workboxOptions: {
      skipWaiting: true
    },
    manifestOptions: {
      short_name: "WebAuthn PWA",
      background_color: "#000000",
      display: "standalone",
      scope: "/",
      start_url: "/",
      icons: [
        {
          src: "img/icons/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "img/icons/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ]
    }
  },
  transpileDependencies: [
    '@simplewebauthn/browser'
  ],
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.js$/,
          include: /node_modules\/@simplewebauthn\/browser/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: [
                '@babel/plugin-proposal-optional-chaining',
                '@babel/plugin-proposal-nullish-coalescing-operator'
              ]
            }
          }
        }
      ]
    }
  },
  chainWebpack: config => {
    config.module
      .rule('eslint')
      .use('eslint-loader')
      .options({
        fix: true
      })
  }
}
