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
| API 写法        |说明                |
|-------------|------------------- |
|axios(config)|传入相关配置来创建请求|
|axios(url[, config])|可以只传url，但会默认发送 GET 请求|
|axios.request(config)|config中url是必须的|
|axios[method](url[, config])<br>axios[method](url[, data[, config]])|为了方便，给所有支持的请求方法提供了别名<br>这种情况下，不用再config中指定url、method、data|

## 如何实现多种写法

### 从入口文件入手

我们先看入口文件 axios.js，看看 `axios` 到底是什么

```js
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);
  utils.extend(instance, Axios.prototype, context);
  utils.extend(instance, context);
  return instance;
}
var axios = createInstance(defaults); // 将要被导出的axios对象
```

你可以看到 _axios_ 是 _createInstance_ 函数的返回值，在 _createInstance_ 中可以看到函数返回的是 _bind_ 函数的执行结果，传入 _bind_ 执行的是 _Axios.prototype.request_ 方法和 _context_ ，一个 _Axios_ 实例。

到底 _bind_ 函数执行返回了什么，我们先看看作为工具函数的 _bind_ 做了什么事：

```js
function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};
```

我们结合这句代码来看：
`var instance = bind(Axios.prototype.request, context)`

_bind_ 函数接收 _request_ 方法和 _context_ ，执行返回一个函数 _wrap_ ，_wrap_ 函数返回 _request_ 函数的调用结果， _request_ 调用时 this 改成了 context ，并传入了 _wrap_ 函数接收的参数数组 args 。

可见这里的 bind 函数实现的效果和原生的 _bind_ 相同，即相当于：`Axios.prototype.request.bind(context)`

因此 _instance_ ，即 _axios_ 指向了 _wrap_ 函数， _axios_ 执行即 _wrap_ 执行，返回的是 _Axios.prototype.request_ 的执行结果，执行时 this 指向一个 Axios 的实例。因此可以理解为：axios 指向了改变了 this 的 `Axios.prototype.request` 函数。

```js
utils.extend(instance, Axios.prototype, context);
utils.extend(instance, context);
```

继续看到上面的 createInstance 函数的代码， extend 函数我们就不具体细看了，它的作用就是把对象b的属性扩展到对象a上，同时考虑了属性是函数时，this的指向问题。

上两句代码就是，将 _Axios_ 原型对象上的属性拷贝到 _instance_ 对象上，将 Axios 实例上的属性拷贝到 _instance_ 对象上。因此 _instance_ ，即 _axios_ 最后挂载了 _Axios_ 原型上所有属性，和 _Axios_ 实例的所有属性，其中的方法中的 this ，都指向同一个 Axios 实例。

## 探究Axios构造函数

 _axios_ 实际上指向 Axios.prototype.request 方法，因此 Axios 的原型方法 request 是整个 axios 库的核心函数，进入 Axios.js 文件，我们先看看 Axios 构造函数本身：

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(), // 拦截器管理器实例
    response: new InterceptorManager()
  };
}
Axios.prototype.request = function request(config) {
  // ....
};
```

Axios 的实例挂载了两个属性，一个是 defaults 属性，属性值为 Axios 接收的 instanceConfig ，另一个是 interceptors 属性，属性值为一个拦截器对象，包含 request 和 response 两个属性，属性值都为 InterceptorManager 实例。

在 Axios.js 文件中，接下来还会往 Axios 的原型对象挂载一些方法：

```js
utils.forEach(['delete', 'get', 'head', 'options'], function(method) {
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});
utils.forEach(['post', 'put', 'patch'], function(method) {
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});
```

前面提到 Axios.prototype 上的属性已经拷贝了给 axios 对象，所以 axios 对象可以直接调用 get , post , head 等这些挂载到 Axios 原型上的方法，当然也包括 request 方法。

我们注意到 get / post / head 等这些方法的执行，都是返回 this.request 即 Axios.prototype.request 的执行结果， 加上 axios 本身也实际指向 Axios.prototype.request 方法，它可以直接作为 request 方法调用。

因此我们可以得出，发起请求的调用写法有多种，比如 axios(config) 、 axios.request(config) 、 axios[method](url[, config]) 等，实际最后都调用了 Axios.prototype.request 方法。

## 配置对象config怎么起作用

我们使用 axios 怎么写传入的配置对象是很重要的部分，我们已经到用户传入的 config 对象经过了很多层的传递，它在源码里面经历了什么，怎么一步步传到需要它的地方，是我们希望了解的。

axios 文档告诉我们，我们可以定义这些配置项：

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

### axios的默认config

回到 /axios.js 文件中，我们看看 aixos 中默认的 config 对象是怎么被使用的。

```js
var defaults = require('./defaults');
var axios = createInstance(defaults);
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  // ....省略
  return instance;
}
```

我们看到 ./defaults 文件导出一个默认的 config 对象，赋给了变量 defaults ，再传入 createInstance 函数执行，在 createInstance 函数中，传入 new Axios 执行，前面提到 Axios 构造函数会把接收的 config 对象挂载到创建的 Axios 实例上的 defaults 属性：

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  // 省略...
}
```

那开发者自己传入的配置对象 config ，是怎么处理的，我们知道作为真正的入口函数， Axios.prototype.request 函数会接收开发者传入的 config，我们来看看它的具体实现：

```js
Axios.prototype.request = function request(config) {
  // ....
  config = mergeConfig(this.defaults, config) // 默认的config和request传入的config合并
  // ....
};
```

在 request 方法中，this 指向 Axios 实例，因此 this.defaults 就是 Axios 实例上的 defaults 属性值，即默认的配置对象。 request 函数中，调用了 mergeConfig 函数，将传入的默认配置对象和开发者传入的 config 对象合并，具体的合并细节我们看看 mergeConfig 的实现：

```js
function mergeConfig(config1, config2 = {}) {
  var config = {}; // 结果对象

  utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') { // 如果config2中这四个设置项有定义
      config[prop] = config2[prop]; // 就將其加入到config对象中
    }
  });

  utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties(prop) {
    if (utils.isObject(config2[prop])) {
      // 如果config2中该属性值是对象，就把config1和config2的该属性值深度合并，赋给config
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);
    } else if (typeof config2[prop] !== 'undefined') {
      // config2中該屬性值有定义，但不是对象，就直接加入到config
      config[prop] = config2[prop];
    } else if (utils.isObject(config1[prop])) {
      // config2中该属性未定义，但config1中有定义并且是对象，把config1的该属性值进行内部的深度合并，即去掉重复的属性
      config[prop] = utils.deepMerge(config1[prop]);
    } else if (typeof config1[prop] !== 'undefined') {
      // 如果config2中該属性未定义，config1该属性有定义，但不是對象，直接加入到config中
      config[prop] = config1[prop];
    }
  });
  utils.forEach(['baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer', 'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName', 'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength', 'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken', 'socketPath'], function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop]; // 如果config2中該属性有定义，将其拷贝到config中
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop]; // config2上該属性未定义，但config1中有定义，则加入config对象中
    }
  });
  return config;
};
```

从调用的方式可知， config1 接收的是 axios 的默认配置对象， config2 接收的是用户定义的配置对象。具体的合并细节见注释。

我们知道 Axios实例的属性（defaults）被添加到了 axios 对象上了，用户可以通过 `axios.defaults` 直接修改默认配置中的配置项，像下面这样伪代码所示：

`axios.defaults[configName] = value;`

除了这种修改默认配置的方式之外， axios 对象还对外暴露了一个 create 方法，供开发者传入自定义的通用配置对象，同时返回出一个新的 axios 对象。像下面这样使用：

```js
let newAxiosInstance = axios.create({
  [配置项名称]: [配置项的值]
  // ...
})
```

 axios.create 函数的实现只有简单的一句：

```js
axios.create = function(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

axios.create 方法返回 createInstance 函数的执行结果，前面我们知道 createInstance 函数的返回值赋给了 axios ，所以这里 axios.create 返回的一个新的 axios 对象，传入的是什么，是 mergeConfig 函数的返回值， mergeConfig 函数将默认配置对象和 axios.create 传入的配置对象合并，返回出一个整合好的对象给 createInstance 函数执行。

可见 axios.create 就是自立一个 axios 对象，由用户配置出一套自定义的通用配置。

总结一下，改动配置对象一共有三种方式

1. _axios(config)_ 等通过 Axios.prototype.request 的调用传入配置对象
2. `axios.defaults[name] = value` 直接修改默认的配置对象
3. `axios.create(config)` 另创建一个 axios 对象，配置对象是自定义合并过的

这三种方式叠加使用的话，最后 config 肯定要整合成一个，必然涉及到覆盖，因此存在优先级的问题。

由于 2 和 3 都是针对默认配置进行改动，所以 1 的优先级最高，3 axios.create 接收的配置会合并到默认配置，所以优先级排第 2 ：

  1. request方法的的参数config
  2. Axios实例属性defaults
  3. 默认配置对象defaults（来自/lib/defaults.js)

## 探究 Axios.prototype.request

前面我们看了 Axios 构造函数，也看了 config 是怎么传递和合并的，现在来看 request 这个核心方法：

```js
Axios.prototype.request = function(config) {
  // 省略....
  config = mergeConfig(this.defaults, config);
  var chain = [dispatchRequest, undefined]; 
  var promise = Promise.resolve(config);
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });
  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift())
  }
  return promise;
};
```

前面讲过 _config_ 整合了默认配置和传入的配置。然后定义一个数组 _chain_ ，先放入用于发送请求的 _dispatchRequest_ 函数和一个 _undefined_ 。

接着 Promise.resolve(config) 创建一个以 _config_ 为实现的 _Promise_ 实例，赋给 promise ，它调用 _then_ 的话，在成功回调中可以接收到 _config_ 对象。

接下来是这几行代码：

```js
this.interceptors.request.forEach(interceptor => {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
});
this.interceptors.response.forEach(interceptor => {
  chain.push(interceptor.fulfilled, interceptor.rejected);
});
```

我们前面提到过， _this.interceptors.request_ 和 _this.interceptors.response_ 是 Axios 实例的 _interceptors_ 属性（是一个对象）的属性，属性值都为 `new InterceptorManager()`

new InterceptorManager() 具体是什么呢？我们看看 InterceptorManager 这个构造函数和它的 forEach 方法：

```js
function InterceptorManager() {
  this.handlers = [];
}
InterceptorManager.prototype.forEach = function (fn) {
  utils.forEach(this.handlers, function (h) {
    if (h !== null) {
      fn(h);
    }
  });
};
```

可见 _InterceptorManager_ 的实例有 _handlers_ 属性，属性值为一个数组，它其实是用来存放拦截器的。

_InterceptorManager_ 的原型方法 _forEach_ 就是遍历实例的 _handlers_ 数组，跳过为 null 的项，将每一项拦截器传入 _fn_ 执行。 _fn_ 是 _forEach_ 的回调函数，即：

```js
function (interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
}
function (interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
}
```

因此 _this.interceptors.request_ 的 _handlers_ 数组中的每个 interceptor 请求拦截器，它的 _fulfilled_ 属性值和 _rejected_ 属性值被添加到 chain 数组的开头。

_this.interceptors.response_ 的 _handlers_ 数组中的每个 interceptor 响应拦截器，它的 _fulfilled_ 属性值和 _rejected_ 属性值被添加到 chain 数组的末尾。

而且它们都是被成对成对地加入到 chain 数组中。问题来了， handlers 数组是怎么存了这些 interceptor 对象的？其实是通过用户调用 use 方法注册的：

```js
InterceptorManager.prototype.use = function (fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};
```

可见 use 是 InterceptorManager 的原型方法， _axios.interceptors.request_ 和_axios.interceptors.response_ 都是 InterceptorManager 的实例。用户可以通过调用  _axios.interceptors.request.use_ 添加请求拦截器方法，用于发起请求前的准备工作，比如修改请求的 data 和 header ，下面是用户使用 use 的方式：

```js
axios.interceptors.request.use(
  config => {
  // 在发送http请求之前做一些事情
    return config; // 有且必须有一个config对象被返回
  }, error => {
    // 请求出错时做一些事情
    return Promise.reject(error);
  }
);
```

use 的参数 fulfilled 接收用户定义的发送请求前的成功回调， rejected 接收请求错误的失败回调，然后将它们分别赋给一个对象中的 fulfilled 和 rejected 的属性，再将对象推入 handlers 数组中。注意：成功的回调必须返回 config 对象。

如此一来， axios.interceptors.request 这个 InterceptorManager 实例的 handler 数组，就存放着用户通过 use 注册的成功回调和失败回调。

同样的，用户调用 axios.interceptors.response.use 添加响应拦截器方法，用于响应数据返回之后的处理工作：

```js
axios.interceptors.response.use(
  response => {
      // 针对响应数据做一些事情
    return response;
  }, error => {
      // 对于响应出错做一些事情
    return Promise.reject(error);
  }
);
```

同样的， axios.interceptors.response 这个 InterceptorManager 实例的 handler 数组，就存放着用户通过 use 注册的成功回调和失败回调。

现在我们知道了 handler 数组中的拦截器对象以及它的两个方法是怎么来的了。

回调 chain 数组，如果用户通过 use 添加了拦截器方法， chain 数组就会存放了拦截器方法和 dispatchRequest 方法，接下来开启一个 while 循环：

```js
while (chain.length) {
  promise = promise.then(chain.shift(), chain.shift());
}
```

已知进入while循环之前， promise 是 resolved 状态的 promise 实例，它调用 then ，接收两个从 chain 数组成对 unshift 出来的函数，作为 then 的成功回调和失败回调。我们知道，拦截器方法中我们并没有调用过 resolve 或 reject ，因此 then 返回的新的 promise 实例的状态是 pending 。

同时，promise.then 的执行将成功和失败的回调都推入异步执行的微任务队列中

在 while 循环中， then 返回的promise实例覆盖了promise变量，promise继续调用then，这是一种链式调用，直到chain数组为空，循环结束，在这个循环的过程中，chain数组中的函数双双的被推入到异步执行的微任务队列中，等待执行。

注意，在异步请求有了结果之前，经过了while循环后的promise是一个状态为pending的promise实例，并且request方法会将这个promise实例返回。

当同步代码执行完，就开始执行异步的微任务队列了，首先执行请求拦截器方法，我们在其中做一些请求前的处理，并return出config。执行完请求拦截器方法，就该执行dispatchRequest方法了，它接收返回的config

接下来看看 dispatchRequest 函数，顾名思义，它是真正发起请求的 API ：

## dispatchrequest 做了什么

```js
function dispatchRequest(config) {
  // ...省略
  var adapter = config.adapter || defaults.adapter;
  return adapter(config).then( /*代码省略*/ );
};
  ```

我们只需关注后面两句，如果用户在 config 对象中定义了 adapter 就赋给变量 adapter ，如果用户没有定义，则使用默认的 defaults.adapter 。然后执行 adapter(config) 并调用了 then  ，最后dispatchRequest将then返回的promise实例返回。

因为用户一般不会自定义 adaptor ，那默认的 defaults.adapter 怎么实现的：

### 适配器 adapter 的实现

```js
var defaults = {
  adapter: getDefaultAdapter(),
  // ....
};
function getDefaultAdapter() {
  var adapter;
  if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    adapter = require('./adapters/http');
  } else if (typeof XMLHttpRequest !== 'undefined') {
    adapter = require('./adapters/xhr');
  }
  return adapter;
}
```

我们看到， defaults.adaptor 的属性值是 getDefaultAdapter() 的返回值。在 getDefaultAdapter 函数中，根据宿主环境引入不同的 adapter 函数： Node.js 环境下，引入 http.js 模块；浏览器环境下，引入 xhr.js 模块。

http.js 文件中使用 Node.js 内置的 http 模块来实现请求的发送，这里不作具体分析。

xhr.js 文件中导出了 xhrAdapter 函数，也就是我们的 defaults.adapter ，我们看看它的实现:

### xhrAdapter 的实现

```js
function xhrAdapter(config) {
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest(); // 创建 XMLHttpRequest 实例
    // 调用request的实例方法open，发起xhr请求
    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);
    // ...
    // 监听 readyState，设置对应的处理回调函数
    request.onreadystatechange = function() {
      // ...
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
    // 发送请求
    request.send(requestData);
  });
};
```

我们对 xhrAdapter 函数做了一些删减， xhrAdapter 函数返回出一个 promise 实例，是对 XMLHTTPRequest 发起 AJAX 请求的流程的封装，这是我们熟悉的。

请求成功后，根据返回的响应数据整合出了 _response_ 对象，并传入 _settle_ 方法执行，根据 response 决定是调用 resolve 还是 reject ，我们看看 settle 方法的实现：

```js
function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};
```

settle 函数中，首先用 validateStatus 函数对 response 的 status 值判断，在 mergeConfig 函数中我们知道，默认配置对象中有 validateStatus 函数，但如果用户配置了自己的 validateStatus ，会优先采用用户的配置。

我们默认用户没有进行配置，所以我们看看默认的 defaults.validateStatus 函数：

```js
var defaults = {
  validateStatus (status) { // HTTP状态码必须满足200-300
    return status >= 200 && status < 300;
  }
};
```

 validateStatus 函数会对 response.status ，即响应的 HTTP 状态码进行验证，如果满足状态码在 200 - 300 之间，则返回 true ，将调用 resolve 将 promise 实例 resolve ，否则将 promise reject 。注意这里的 promise 是指 xhrAdapter 函数返回的 promise 实例。

 因此在 dispatchRequest 函数中， adapter 函数接收 config 执行返回的 promise 实例，继续调用 then 。如下所示：

```js
function dispatchRequest(config) {
  // ...省略
  var adapter = config.adapter || defaults.adapter;
  return adapter(config).then((response) => {
    throwIfCancellationRequested(config);
    response.data = transformData(// 转换 response data
      response.data,
      response.headers,
      config.transformResponse
    );
    return response;
  }, (reason) => {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);
      if (reason && reason.response) { // 转换 response data
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }
    return Promise.reject(reason);
  });
};
```

可以看到， adapter(config).then 中传入了成功回调和失败回调，它们会对 adapter 返回的 promise 实例的成功或失败结果，做再次加工。

如果 HTTP请求成功（HTTP状态码在200-300之间）， adapter 函数返回的是成功的 promise 实例，调用 transformData 函数对 response.data 做处理，将处理后的 response 返回。如果 adapter 返回的是失败了的 promise 实例的话，则返回一个状态为 rejected 的 promise 对象。

到目前为止，整个 axios 调用流程就讲完了。核心方法是：Axios.prototype.request 。它做的事情是：如果用户设置了拦截器方法，就将它们推入一个叫 chain 的数组中，chain 数组形成了：[请求拦截器方法 + dispathRequest + 响应拦截器方法] 这样的队列，然后通过链式调用 promise 实例的 then 方法，将 chain 数组中的方法注册为 成功和失败的回调，即都放入微任务队列中等待异步执行。

config 对象在这条 then 调用链中的前半部分传递，到了核心的 dispatchRequest 方法，它调用合适的 adapter 方法，对于浏览器而已就是 xhrAdapter 方法，而 xhrAdapter 方法就是发起 XMLHttpRequest 请求的一套流程的用一层 promise 封装，会根据响应的状态决定将 promise resolve 或 reject 掉。

然后 dispatchRequest 针对 adapter 的执行 promise 实例再调用 then ，对响应的数据做最后的处理，再把 response 对象 return 出来。所以在 then 调用链的后半部分，响应拦截器方法接收的是 response ，做的是对 response 对象的处理，response 在 then 的调用链中传递。

最后 Axios.prototype.request 把经过 then 链式调用的 promise 返回出来，也就是你调用 axios 的返回值，你用它调用 then 就能在成功的回调中拿到 response 对象。

ok，完整的流程就叙述完毕。

下面是一些 axios 库的一些补充功能：

## 取消请求

这部分我们用得比较少，先看看是怎么使用的：

```js
const CancelToken = axios.CancelToken;
const source = CancelToken.source();

axios.get('/user/12345', {
  cancelToken: source.token
}).catch(function(thrown) { // 失败，先看是不是Cancel对象
  if (axios.isCancel(thrown)) {
    console.log('请求取消', thrown.message);
  } else {
     // 处理错误
  }
});

axios.post('/user/12345', {
  name: 'new name'
}, {
  cancelToken: source.token
})

// 取消请求（message 参数是可选的）
source.cancel('Operation canceled by the user.');
```

我们发现 要先引用 axios.CancelToken ，然后调用 CancelToken 的 source 方法，返回出一个对象，里面有 cancel 和 token 属性。我们先从 axios.js 中看到

```js
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');
```

axios 对象挂载了 CancelToken 方法，我们看到它的具体实现：

```js
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }
    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}
```

CancelToken 构造函数在调用时，传入一个执行器方法 executor ，会在函数内执行 executor 。CancelToken 会给它的实例挂载一个 promise 属性，属性值是一个 promise 对象，值得注意的是， promise 的 resolve 赋给了构造函数内定义的 resolvePromise 变量，resolvePromise 方法在 executor 方法里面调用。

这意味着什么，先看一个简单的例子：

```js
let resolveHandle;
new Promise((resolve, reject) => {
  resolveHandle = resolve;
  // resolve('ok')
}).then(res => {
  console.log(res);
});
resolveHandle('ok'); // "ok"
```

我不像正常那样在传入 new Promise 的 执行器函数中调用 resolve 。

而是拿到 resolve 的引用，在外部调用，因为，promise 实例管控的操作，不管是异步还是同步的，都不能从外部决定 promise 实例是成功还是失败的，现在就相当于把控制权交给外部的 resolveHandle ，可以在外部控制这个 promise 成功与否。

```js
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token,
    cancel
  };
};
```

CancelToken 函数挂载了一个 source 方法，它返回一个包含 token 和 cancel 的对象，token 的属性值是 CancelToken 的实例。
