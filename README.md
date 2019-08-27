# 深入浅出Axios源码
### 1.Axios是什么
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
### 2.Axios的多种请求写法
|API|说明|
|-|- |
|axios(config)|传入相关配置来创建请求|
|axios(url[, config])|只传url的话默认发送 GET 请求|
|axios.request(config)|config中url是必须的|
|axios[method](url[, config])<br>axios[method](url[, data[, config]])|为了方便，给所有支持的请求方法提供了别名<br>这种情况下，不用再config中再指定url、method、data|
 ### 3.实现多种写法的原因
   #### 3.1.从入口文件入手
  我们先看入口文件 axios.js，看看 `axios` 到底是什么
  ```js
  // 函数执行返回 instance， instance 其实指向 Axios.prototype.request 函数
  // instanceg 本身挂载了 Axios.prototype 上的属性和 Axios 实例的属性

function createInstance(defaultConfig) {

    var context = new Axios(defaultConfig); // 创建Axios的实例context

    var instance = bind(Axios.prototype.request, context);
    // instance 相当于Axios.prototype.request.bind(context)，待会我们看看bind的实现
    
    utils.extend(instance, Axios.prototype, context);
    // 将 Axios 原型上的方法（request,getUri,get,post,put...）拷贝到 instance 上
    
    utils.extend(instance, context);
    // 将 Axios 的实例 context 上的属性（defaults、interceptors）拷贝到 instance

    return instance; // 返回出 instance
}

var axios = createInstance(defaults); // 创建一个将要被导出的axios对象


  ```

  所以axios就是bind函数的执行返回值，它身上绑上了Axios原型上的属性方法，所以可以axios.request这么调用



  #### 3.2 bind 函数做了什么
  我们来看看`bind`函数做了什么，其实是将传入的`fn`改变它执行时的`this`指向
  ```js
  module.exports = function bind(fn, thisArg) {
  // bind执行返回一个包裹函数wrap，wrap 执行返回 fn 的执行结果，执行时this改成thisArg
    return function wrap() {
      var args = new Array(arguments.length);
      for (var i = 0; i < args.length; i++) {
        args[i] = arguments[i];
      }
      return fn.apply(thisArg, args);
    };
};

  ```
  ```js
  var instance = bind(Axios.prototype.request, context);
  ```
  `instance`指向一个包裹函数wrap，它的执行结果返回的是`request`执行结果，`request`执行时的this修改成指向Axios的实例。
```js
var axios = createInstance(defaults); 
```
  所以axios可以理解为指向了Axios原型上的request方法，它本身又挂载了Axios原型上所有属性和Axios实例的所有属性和方法，而且这些方法执行时的this都指向同一个Axios实例对象。

  #### 3.3 探究Axios构造函数

  Axios是axios库的核心，Axios构造器的核心方法是原型上的request方法，各种axios的调用方式最后都是通过request方法发起请求的，我们通过源码一探究竟吧！
  下面是core\Axios.js的源码：
  ```js
  // Axios类
function Axios(instanceConfig) {
    this.defaults = instanceConfig; 
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager()
    };
}

// 发送请求的方法，挂到Axios的原型上
Axios.prototype.request = function request(config) {
    // 代码省略，稍后分析
};
// Axios原型方法，返回出构建好的URL
Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// 给Axios的原型上挂载 delete get 等方法，传入URL和config，返回出request方法的执行结果
  utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
    Axios.prototype[method] = function(url, config) {
      // 传入的config 和 {method: method, url: url} 合并，后者的权重高
      return this.request(utils.merge(config || {}, { 
        method: method,
        url: url
      }));
    };
});
// 给Axios的原型上挂载 post 等方法，这些都可以传请求主体的，返回出request方法的执行结果
  utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
    Axios.prototype[method] = function(url, data, config) {
      return this.request(utils.merge(config || {}, {
        method: method,
        url: url,
        data: data
      }));
    };
});

  ```
  所以我们知道了axios.get()、axios.post等别名调用方式是这么来的，都往Axios.prototype上挂，调用这些方法都转成调用Axios.prototype.request方法

  ### 4 配置对象config如何起作用
  在探究Axios.prototype.request之前，我们先看看用户传入的config配置项，在源码里面是怎么起作用的。
  通过axios文档，我们可知我们可以定义这些配置项：
  |配置项|说明|
  |-|-|
  |`url` |请求的URL|
  |`method`|请求的方法|
 | `baseURL`|加在`url`前面，除非`url`是绝对URL|
  |`transformRequest`|在向服务器发请求前，修改请求数据|
 | `transformResponse`|在响应数据传递给then/catch前，修改响应数据|
 | `headers`|自定义请求头|
 | `params`|URL参数，必须是plain对象或URLSearchParams对象|
  |`paramsSerializer`|对params序列化的函数|
 | `data`|作为请求主体的数据|
 | `timeout`|指定请求超时的毫秒数，超过就请求中断|
 | `withCredentials`|跨域请求时是否需要使用凭证|
 | `adapter`|允许你自己写处理config的函数|
 | `responseType`|服务器响应的数据类型|
 | `auth` 等......|......|

 config这个对象是axios内部的沟通桥梁，也是用户跟axios内部的沟通桥梁

我们通过源码看一下config是怎么一步步传到需要的位置：
#### 4.1 axios.defaults设置
/axios.js 中
```js
var defaults = require('./defaults');

var axios = createInstance(defaults);

function createInstance(defaultConfig) {

  var context = new Axios(defaultConfig);
  
  // ....省略

  return instance;
}
```
createInstance的形参defaults接收'./defaults'导出的defaults，再传给Axios构造函数，然后我们进到Axios源码看看

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig; 
  // 省略...
}
```
可见把默认的配置defaults绑定到Axios的实例上，作为实例的属性。

```js
Axios.prototype.request = function request(config) {
  
  // 省略....

  config = mergeConfig(this.defaults, config); 
  // 合并配置项。把new Axios时传入的config（defaults.js导出的）和request传入的config合并

  // 省略....
};
```
