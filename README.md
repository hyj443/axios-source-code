# 深入浅出Axios源码
### Axios是什么
Axios 是一个基于promise的HTTP库
主要特性有：
- 从浏览器中创建 XMLHttpRequest
- 从 node.js 创建 HTTP 请求
- 支持 Promise
- 拦截请求和响应
- 转换请求数据和响应数据
- 取消请求
- 自动转换JSON数据
- 客户端支持防御 XSRF
### Axios的多种请求写法
|API|说明|
|-|- |
| axios(config)| 传入相关配置来创建请求 |
| axios(url[, config]) | 只传url的话默认发送 GET 请求 |
| axios.request(config) | config中url是必须的 |
| axios[method](url[, config])<br>axios[method](url[, data[, config]])  | 为了方便，给所有支持的请求方法提供了别名<br>这种情况下，不用再config中再指定url、method、data |
