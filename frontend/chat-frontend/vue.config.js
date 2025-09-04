const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  
  // 환경변수 설정
  chainWebpack: config => {
    config.plugin('define').tap(args => {
      args[0]['process.env'].VUE_APP_API_URL = JSON.stringify('http://localhost:8000/api')
      args[0]['process.env'].VUE_APP_SOCKET_URL = JSON.stringify('ws://localhost:8000')
      return args
    })
  }
})
