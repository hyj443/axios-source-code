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

你可以看到 axios 是createInstance的执行返回的instance，而instance是bind函数的执行结果，传入的参数是：Axios.prototype.request 和 context，前者是Axios的原型方法request，后者是一个Axios的实例
所以，bind函数是我们理解的关键。
先看一下作为工具函数的 bind 和 extend 是怎么实现的。

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

你可以看到 bind 函数执行返回一个包裹函数 wrap ，wrap 执行返回 fn 函数的apply调用结果，传入了 wrap 函数接收的参数数组 args。

所以回到前面的这句：
`var instance = bind(Axios.prototype.request, context)`

 `instance` 指向 wrap 函数，instance 执行也就是 wrap 执行，返回的是 `Axios.prototype.request.apply` 的执行结果，执行时this指向context，即Axios的实例。

那我们再看看 extend 的实现：
```js
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) { // 遍历b的属性，对每个属性执行回调 assignValue
    if (thisArg && typeof val === 'function') { 
    // thisArg传了，并且当前遍历的属性值是函数，则改动函数中的this指向，并且拷贝给对象 a
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}
```

可见，extend 的作用就是：把对象b的属性 扩展到对象a上，同时考虑了属性是函数时，this的指向问题，你可以通过传第三个参数手动改变this。

我们再回到这句：

`var axios = createInstance(defaults);`

我们暂且把 defaults 看作一个默认配置对象，其实它确实是如此。
axios 是 createInstance 返回出的 instance。instance 指向 wrap 函数。因为 wrap 函数的实现，最后我们可以理解为：axios 指向了改变了 this 的 `Axios.prototype.request` 这个函数。

```js
 utils.extend(instance, Axios.prototype, context);
  // 将 Axios 原型对象上的属性拷贝到 instance 对象
  utils.extend(instance, context);
  // 将 context（Axios 实例）上的属性拷贝到 instance 对象
```

由上可知，`axios` 本身最后挂载了 Axios 原型上所有属性，和Axios 实例的所有属性，并且这些属性方法它的this，都指向了同一个个Axios实例。

## 探究Axios构造函数

既然我们知道 axios 指向 Axios.prototype.request，所以 Axios.prototype.request 是 Axios 构造函数的核心方法，我们先看看Axios构造函数本身。

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
// 往Axios原型上挂载delete,get等方法，这些方法返回request的执行结果
utils.forEach(['delete', 'get', 'head', 'options'], function(method) {
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});
// 往Axios的原型上挂载post等方法（都是可以传请求主体的），这些方法也是返回request方法的执行结果
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

所以，这些get post put等方法，往Axios.prototype上挂载后，就能直接通过 axios.get、axios.post、axios.put .... 调用

因为之前 Axios 原型方法 requset 也被拷贝到 axios 对象作为自有属性。所以，也可以 axios.request() 这么调用。

我们看到，发起请求的API的写法有多种，但实际上最后都调用了 Axios.prototype.request 方法。

## 配置对象config怎么起作用

探究完 Axios 构造函数后，在探究 Axios.prototype.request 之前，我们先看看开发者传入的 config ，它在源码里面经历了什么，怎么一步步传到需要它的地方。

axios 文档告诉我们，你可以定义这些配置项：

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

 config 是一个对象，是 axios 内部沟通的桥梁，也是开发者与 axios 内部的沟通桥梁。

### axios的默认config

在 /axios.js 文件中

```js
var defaults = require('./defaults');

var axios = createInstance(defaults);

function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  // ....省略
  return instance;
}
```

createInstance 函数接收 ./defaults 文件导出的 defaults 对象，再传给 new Axios 执行，我们看看 这个config 在 Axios 构造函数中怎么被处理：

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  // 省略...
}
```

你会看到，默认配置对象 defaults 作为属性挂载到 Axios 的实例上。

那开发者自己传的 config ，是怎么处理的，要看Axios.prototype.request 函数的实现：

```js
Axios.prototype.request = function request(config) {
  // ....
  config = mergeConfig(this.defaults, config) // 默认的config和request传入的config合并
  // ....
};
```

我们知道，axios(config)，相当于 Axios.prototype.request(config) 执行。由上面代码可知，传入的 config 对象会和默认的 defaults 对象合并，具体的合并细节请看源码。

我们知道，Axios实例的属性被添加到 axios 上了，成为自有属性了，所以 Axios实例的 defaults 属性添加到了 axios 上了。

所以开发者可以通过 `axios.defaults` 直接修改默认配置中的配置项，像下面这样：

```js
axios.defaults[configName] = value;
```

除了这种修改默认配置的方式之外，axios 对象还对外暴露了一个 create 方法，供开发者传入通用的配置对象

axios.js文件中：

```js
axios.create = function(instanceConfig) {
  // 传入的config和默认的合并，createInstance接收整合好的config
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

因此开发者可以像下面这样，自己创建一个 Axios 实例，传入自定义的通用配置。

```js
let newAxiosInstance = axios.create({
  configName: value,
})
```

总结一下，一共有三种传配置的方式

- axios(config)
- axios.defaults[name] = value
- axios.create(config)

因为 config 最后要整合成一个，这三种方式叠加使用的话，肯定涉及到覆盖，因此存在优先级的问题。

优先级从高到低：

  1. request方法的的参数config
  2. Axios实例属性defaults
  3. 默认配置对象defaults（/lib/defaults.js)

## 探究 Axios.prototype.request

前面我们看了 Axios 的实现，也看了 config 是怎么传递并使用的，现在来到了重头戏：request 这个核心方法：
```js
Axios.prototype.request = function(config) {
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

从上可知，在chain数组中，用于发送请求的 dispatchRequest 函数位于数组的“中间位置”，在它前面的是请求拦截器方法，它后面是响应拦截器方法，并且这些方法都是成对地加入数组的，分别作为成功的回调，和失败的回调。

并且我们可知，不管有没有拦截器方法加入到chain数组，chain数组中 dispatchRequest 函数是肯定存在的，它肯定会被执行。

`var promise = Promise.resolve(config)`

Promise.resolve() 返回一个以 config 为实现的 promise 对象，它继续调用 then ，会执行 then 的成功回调，如果我们在回调里返回一个新的 promise ，在这个promise 中 resolve 出修改后的 config ，这样下次 then 的时候就能拿到 config 再做修改，并再次 resolve 出来。

所以 while 循环实现的是，将 chain 数组里的回调成对地从数组中出列，遍历了一遍 chain 数组，实现了 then 链式调用，每次 then 都返回出新的promise对象，并 resolve(config) ，因此 config 实现了在then 调用链中的传递。

举个简单的例子，大致像这样：

```js
var p = Promise.resolve(config)
p.then(interceptor.request.fulfilled, interceptor.request.rejected)
       .then(dispatchRequest, undefined)
       .then(interceptor.response.fulfilled, interceptor.response.rejected)
```

我们知道，request.interceptor 请求拦截器，是用于发起请求前的准备工作，比如修改请求的data（请求主体）和 header。

response.interceptor 响应拦截器，是用于响应数据返回之后的处理工作。

整个请求的发起过程是通过 dispatchRequest 实现。dispatch 英文是派发分发的意思

## dispatchrequest 做了什么

我们知道，dispatchrequest 做的是真正发起请求的工作。

```js
function dispatchRequest(config) {
  // 如果设置了中断请求，中断请求抛出原因
  // 整合 config.url
  // 确保有config.headers
  // 调用transformData转换请求的 data，赋给config.data
  // 对 headers 进行合并处理
  // 删除header属性里的无用属性delete,get,head,post等

  // adapter 是HTTP请求适配器，优先使用自定义的适配器，不然就用默认的
  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then( /*代码省略*/ );
};
  ```

我们只关注后面两句关键的代码，如上。

可见 dispatchRequest 做了三件事：

1. 在 config 传给 adapter 执行之前，对 config 做最后的处理。
2. 执行 adapter(config) ，发起请求。
3. 请求完成后，如果成功，则将header,data,config.transformResponse整合到response并返回（代码未展示）

回顾一下，在 Axios.prototype.request 方法里会调用 chain 数组里的dispatchRequest 方法，而 dispatchRequest 又会调用 adapter 方法，接下来看看 adapter 的实现。

### 适配器 adapter 的实现

我们已知，如果开发者没有在 config 里自定义 adaptor ，就会取defaults.adaptor，我们看看默认的 adaptor 是怎么实现的。因为一般开发者都不会写 adaptor。

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

我们看到，defaults.adaptor 的属性值是 getDefaultAdapter() 的返回值。
在 getDefaultAdapter 函数中，可以看到在获取 adapter 时，做了对环境的判断，也就是，针对浏览器环境或node环境，引入不同的 adapter 函数。

我们axios常用的执行环境是浏览器，所以我们看看浏览器发起请求的 xhrAdapter 函数，在 xhr.js 文件中，

### xhrAdapter 的实现

xhrAdapter 函数返回出一个promise实例，是对 XMLHTTPRequest 一套流程的封装。

```js
function xhrAdapter(config) {
  return new Promise(function(resolve, reject) {
    // 把config中的data和headers拿到
    var requestData = config.data;
    var requestHeaders = config.headers;
    // ...代码省略
    var request = new XMLHttpRequest(); // 创建 XMLHttpRequest 实例
    // ...代码省略
    // 调用request的实例方法open，发起xhr请求，参数对应：方法，URL，是否异步请求（true为异步）
    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);
    // ...代码省略
    // 监听 readyState，设置对应的处理回调函数
    request.onreadystatechange = function() {
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

## 拦截器 InterceptorManager

还记得吗？Axios构造函数中，往Axios实例上挂载了 interceptors 对象，如下：

```js
var InterceptorManager = require('./InterceptorManager');
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}
```

interceptors 存放两个 InterceptorManager 的实例，一个是请求拦截器的管理者，一个是响应拦截器的管理者。看看 InterceptorManager 是什么样的。

```js
function InterceptorManager() { // 维护一个数组
  this.handlers = [];
}
// 往数组里添加一个新的拦截器对象，对象里存放处理成功的回调、处理失败的回调
InterceptorManager.prototype.use = function(fulfilled, rejected) {
  this.handlers.push({
    fulfilled,
    rejected
  });
  return this.handlers.length - 1; // 返回在数组中的索引作为拦截器的id
};
// 从数组里移除一个拦截器对象，让拦截器id对应的索引上的值为null
InterceptorManager.prototype.eject = function(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};
// 遍历所有注册过的拦截器，这个方法会跳过那些被移除了的拦截器
InterceptorManager.prototype.forEach = function(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) { // 如果遍历到的值不为null，才执行回调
      fn(h);
    }
  });
};
module.exports = InterceptorManager;
```

由此可见 new InterceptorManager() 返回的是一个对象，这个对象维护了一个 handlers 数组，它专门存放拦截器对象。

handlers 数组里的每一个拦截器对象，有两个属性，分别是成功的回调和失败的回调。

拿请求拦截器来说，开发者想编写拦截器方法，是像下面这样写的：

```js
axios.interceptors.request.use(function (config) {
  // 你想在发送请求之前，所做的操作
  return config;
}, function (error) {
  // 你对于请求错误，所做的一些操作
  return Promise.reject(error);
});
```
为什么我们可以直接 axios.interceptors.request.use，因为 interceptors 这个 Axios 实例的属性，已经被拷贝到 axios 身上，就能通过 axios 直接调用 InterceptorManager.prototype.use 原型方法，传入两个参数（函数），成功的回调，和失败的回调，他们俩会放到一个对象中，并 push 进数组 handler 中。

成功的回调，是对 config 进行处理，失败的回调，做的是接收错误对象的传入，并通过 Promise.reject(error)，把错误对象传递下去。

那么，开发者添加了拦截器方法，拦截器方法是如何被推入 chain 数组的呢，我们回到 Axios.prototype.request 方法中，有下面两句代码:

```js
this.interceptors.request.forEach(function(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
});

this.interceptors.response.forEach(function(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
});
```
```js
// Axios 构造函数中
this.interceptors = {
  request: new InterceptorManager(),
  response: new InterceptorManager()
};
```

我们知道，`this.interceptors.request` 也就是 new InterceptorManager() 的一个实例，它可以调用 InterceptorManager 原型方法：forEach。

```js
InterceptorManager.prototype.forEach = function(fn) {
  utils.forEach(this.handlers, function(h) {
    if (h !== null) { // 如果遍历到的值为null，不执行回调
      fn(h);
    }
  });
};
```

所以 forEach 会遍历 handlers 数组中所有的 注册过的 拦截器，调用回调函数
我们又知道，这个 forEach 是会遍历 handlers 数组中所有注册过的拦截器，调用回调函数:

```js
this.interceptors.request.forEach(function (interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
});
```

回调函数做的事情就是，把 handlers 数组中的对象的两个方法，先后地插入到数组 chain 中。

因此，chain 数组就形成了 拦截器方法 + dispathRequest + 拦截器方法 的队列，当然了，这是在你都编写了拦截器方法的情况下。chain 数组中的方法，随着 forEach 每次都被成对地 unshift 出列，充当了 then 的两个参数。

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

我们发现 要先引用 axios.CancelToken，然后调用 source 方法，返回出一个对象，里面有cancel 和 token，内部怎么实现的，目的是什么。

先看入口

```js
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');
```

先看看 CancelToken 构造函数的 constructor。

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

CancelToken 在初始化的时候要传入一个执行器方法，并且它会给它的实例挂载一个promise对象，最重要的是，它把 promise 的 resolve方法控制权放在了 executor 方法里面。

这是什么意思，看一个小例子：

```js
let resolveHandle;
new Promise((resolve, reject) => {
  resolveHandle = resolve;
}).then(res => {
  console.log('resolve', res);
});
resolveHandle('ok');
```

resolveHandle 获取了一个promise的 resolve方法的控制权，要知道，promise对象管控的程序是无法从外部决定它是成功的还是失败的，但这样做就可以在外部控制这个promise的成功了

