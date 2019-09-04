# 深入浅出Axios源码

## Axios是什么

Axios 是一个基于promise的HTTP库
主要特性有：

- 在浏览器中创建`XMLHttpRequest`对象获取数据
- 在 node.js 创建 HTTP 请求
- 支持 Promise
- 拦截请求和响应
- 转换请求数据和响应数据
- 取消请求
- 自动转换JSON数据
- 客户端支持防御 XSRF

## 多种请求写法

Axios有多种请求的写法，但其实核心是执行的是同一个方法，后面将阐述
| API         |说明                |
|-------------|------------------- |
|axios(config)|传入相关配置来创建请求|
|axios(url[, config])|可以只传url，但会默认发送 GET 请求|
|axios.request(config)|config中url是必须的|
|axios[method](url[, config])<br>axios[method](url[, data[, config]])|为了方便，给所有支持的请求方法提供了别名<br>这种情况下，不用再config中指定url、method、data|

## 如何实现多种写法

### 从入口文件入手

我们先看入口文件 axios.js，看看 `axios` 到底是什么

```js
var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig); // 创建Axios的实例context
  var instance = bind(Axios.prototype.request, context);
  // 相当于Axios.prototype.request.bind(context)
  utils.extend(instance, Axios.prototype, context);
  // 将 Axios 原型上的方法（request,getUri,get,post,put...）拷贝到 instance
  utils.extend(instance, context);
  // 将 Axios 的实例 context 上的属性（defaults、interceptors）拷贝到 instance
  return instance;
}
var axios = createInstance(defaults); // 将要被导出的axios对象
```

先看一下作为工具函数的 bind 和 extend 具体是怎么实现。

```js
module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};
```

bind 方法执行返回一个包裹函数wrap，wrap 执行时返回 fn 函数改变了this的执行结果，fn执行时传入wrap的参数数组。

`var instance = bind(Axios.prototype.request, context)`

所以 `instance` 指向 wrap 方法，instance 执行 即 wrap 执行，返回 `Axios.prototype.request.apply` 的执行结果，执行时this指向context，即Axios的实例。

```js
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) { // 遍历b的属性。执行回调 assignValue
    if (thisArg && typeof val === 'function') { // 遍历到的属性值是函数，要复制改绑this的方法
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}
```

可见，extend就是把对象b的属性扩展到对象a上，同时考虑了属性是方法时，this的指向问题。

`var axios = createInstance(defaults);`

所以 axios 是 createInstance 返回出的 instance。指向 wrap 函数。由于wrap函数的实现，可以理解为 axios 指向了改变了执行上下文的 `Axios.prototype.request` 函数，`axios` 本身又挂载了Axios原型上所有属性和Axios实例的所有属性，而且这些方法执行时的this都指向同一个Axios实例。

## 探究Axios构造函数

既然我们知道 axios 指向 Axios.prototype.request，这是Axios构造器的核心方法，我们就先看看Axios构造函数本身。

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}
// 发送请求的方法
Axios.prototype.request = function request(config) {
  // 代码省略，稍后分析
};

// ....

// 往Axios的原型上挂载 delete,get 等方法，方法返回request的执行结果
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, { // 合并config，后者的权重高
      method: method,
      url: url
    }));
  };
});
// 往Axios的原型上挂载 post 等方法，都是可以传请求主体的，也是返回request的执行结果
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

所以，这些get post put等方法，往Axios原型上挂载后，连同原型方法requset拷贝到axios作为自有属性，就能直接axios.get调用

所以多种API的调用写法，实际最后都调用了Axios.prototype.request方法。

## 配置对象config怎么起作用

在探究Axios.prototype.request之前，我们先看看用户传入的config，它在源码里面经历了什么，怎么一步步传到需要的位置。

axios文档告诉我们可以定义这些配置项：

|配置项|说明|
|---|---|
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

### axios的默认config

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

createInstance 接收 ./defaults 文件导出的defaults对象，再传给Axios构造函数，我们看看Axios

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  // 省略...
}
```

默认配置对象 defaults 作为属性挂载到 Axios 的实例上。

默认的config我们知道挂到哪了，用户自己传的config，是怎么处理的，要看Axios.prototype.request。

```js
Axios.prototype.request = function request(config) {
  // ....
  config = mergeConfig(this.defaults, config) // 默认的config和request传入的config合并
  // ....
};
```

所以，axios(config)，相当于Axios.prototype.request执行，传入的config会和默认的defaults合并。

又可知，Axios实例的属性被添加到 instance 上，即axios上，成为自有属性。

所以用户可以通过 `axios.defaults` 直接修改默认配置中的配置项

```js
axios.defaults[configName] = value;
```

除此之外，axios对象还暴露了一个create方法，供用户传通用的配置对象

axios.js文件中：

```js
axios.create = function create(instanceConfig) {
  // 把传入的config和默认配置对象合并，createInstance 接收整合好的config
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

所以用户可以像下面这样，自己创建一个Axios实例，传入自定义的通用配置。

```js
let newAxiosInstance = axios.create({
  configName: value,
})
```

总结一下，用户一共有三种传配置的方式

- axios(config)
- axios.defaults[name] = value
- axios.create(config)

因为config最后要整合成一个，所以涉及到覆盖合并，存在优先级的问题。

优先级从高到低：

  1. request方法的的参数config
  2. Axios实例属性defaults
  3. 默认配置对象defaults（/lib/defaults.js)

## 考察 Axios.prototype.request

```js
Axios.prototype.request = function request(config) {
  // 省略....
  config = mergeConfig(this.defaults, config);

  var chain = [dispatchRequest, undefined]; // chain数组：存放拦截器方法和dispatchRequest方法
  
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};
```

chain数组，发送请求的dispatchRequest函数位于“中间位置”，前面是请求拦截器方法，后面是响应拦截器方法，这些方法都是成对加入数组的，将分别作为成功的回调，和失败的回调。不管有没有拦截器，dispatchRequest 都会默认执行

`var promise = Promise.resolve(config)`

promise是一个以config为实现的promise对象，它继续调用then，会走then的成功回调，回调里返回一个新的promise，resolve出修改后的config，这样下次then的时候就能拿到config再做修改，并再次resolve出来。

while循环，遍历了一遍chain数组，实现了链式调用then，chain数组里的回调成对地从数组中出列，每次then都返回出新的promise对象，config实现了在then调用链中的传递

大致像这样：

```js
var promise = Promise.resolve(config)
return promise.then(interceptor.request.fulfilled, interceptor.request.rejected)
              .then(dispatchRequest, undefined)
              .then(interceptor.response.fulfilled, interceptor.response.rejected)
```

request.interceptor用于发起请求前的准备工作，比如修改data和header，response.interceptor用于返回数据之后的处理工作，整个请求过程的发起过程是通过 dispatchRequest实现。

## dispatchrequest做了什么

```js
module.exports = function dispatchRequest(config) {

  // 如果设置了中断请求，中断请求抛出原因

  // 整合 config.url

  // 确保有config.headers

  // 调用transformData转换请求的 data，赋给config.data

  // 对 headers 进行合并处理

  // 删除header属性里的无用属性delete,get,head,post等

  // adapter 是HTTP请求适配器，优先使用自定义的适配器，不然就用默认的
  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(/**/);
};
  ```

可见dispatchRequest做了三件事：

1. 在传给请求适配器adapter之前对config做最后处理
2. 执行 adapter ，发起请求
3. 请求完成后，如果成功，则将header,data,config.transformResponse整合到response并返回，代码稍后展示

所以我们知道，调用Axios.prototype.request方法会调用chain数组里的dispatchRequest方法，dispatchRequest会调用adapter方法，接下来看 adapter 的实现

### adapter的实现

通过之前分析可知，如果不在config里自定义adaptor，就会取defaults.adaptor，我们看看默认adaptor是怎么实现的

```js
function getDefaultAdapter() {
  var adapter;
  if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // 对于 node 环境使用 HTTP adapter
    adapter = require('./adapters/http');
  } else if (typeof XMLHttpRequest !== 'undefined') {
    // 对于浏览器环境使用 XHR adapter
    adapter = require('./adapters/xhr');
  }
  return adapter;
}

var defaults = {
  adapter: getDefaultAdapter(),
  // ....
};
```

可以看到获取 adapter 的时候做了环境的判断，不同环境引入不同的adapter函数

我们来看看 xhr.js 文件中，浏览器发起请求的 xhrAdapter 函数

### xhrAdapter的实现

xhrAdapter函数返回出一个promise实例，是对 XMLHTTPRequest 一套流程的封装

```js
module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    // 把config中的data和headers拿到
    var requestData = config.data;
    var requestHeaders = config.headers;
    // ...
    var request = new XMLHttpRequest(); // 创建XMLHttpRequest实例
    // ...
    // 调用request的实例方法open，发起xhr请求，参数对应：方法，URL，是否异步请求
    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);
    // ...
    // 监听 readyState，设置对应的回调处理函数
    request.onreadystatechange = function handleLoad() {
      if (!request || request.readyState !== 4) {
        return;
      }
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }
      // 准备 response 对象
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };
      settle(resolve, reject, response);
      // 清除request对象
      request = null;
    };

    // 处理浏览器请求取消，和手动取消相反
    request.onabort = function handleAbort() {...};

    // 处理低层次网络错误
    request.onerror = function handleError() {...};

    // 处理超时
    request.ontimeout = function handleTimeout() {...};

    // 发送请求
    request.send(requestData);
  });
};
```

## 整个流程的回顾
