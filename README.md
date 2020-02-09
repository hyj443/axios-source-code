# 深入浅出Axios源码

## Axios是什么

Axios 不是一种新的技术，本质上是对原生 XHR 的封装，只不过它是基于 Promise 实现的版本。

有以下特点：

- 在浏览器中创建 XMLHttpRequest 对象获取数据
- 在 node.js 创建 HTTP 请求
- 支持 Promise
- 拦截请求和响应
- 转换请求数据和响应数据
- 取消请求
- 自动转换 JSON 数据
- 客户端支持防御 XSRF

它的流程大致如下：

![](/pics/process.png)

## **axios** 到底是什么

从 webpack.config.js 文件中，我们可以看到入口文件是 index.js

```js
function generateConfig(name) {
  var config = {
    entry: './index.js',
  };
  // ...
  return config;
}
```

index.js 文件中只有一句：

```js
module.exports = require('./lib/axios');
```

打开 lib\axios.js 文件，我们看到模块导出就是一个axios：

```js
module.exports = axios;
```

`axios`是整个 Axios 库对外暴露的 API，它是怎么定义的：

```js
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);
  utils.extend(instance, Axios.prototype, context);
  utils.extend(instance, context);

  return instance;
}
var axios = createInstance(defaults);
```
createInstance 函数的返回值，赋给axios变量

在 createInstance 函数中，首先创建了一个 Axios 的实例，赋给 context，再执行 bind 函数，返回值赋给 instance，然后两次调用 utils.extend 函数对 instance 做进行扩展，最后 createInstance 函数返回 instance。

可见，axios 实际指向 bind 函数的执行结果。我们看看 bind 函数的实现：

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

结合`var instance = bind(Axios.prototype.request, context)`来看：

bind 函数执行，接收 Axios.prototype.request 方法，和 context 这个 Axios 实例，bind 执行返回一个新的函数 wrap，赋给了 instance，所以 instance 指向 wrap 函数，又因为 axios 指向 bind 函数的执行结果，所以 axios 也指向 wrap 函数。

如果 wrap 函数执行，则会返回 Axios.prototype.request.apply(context, args) 的执行结果，即执行 Axios.prototype.request 但 函数中的 this 指向了 context，接收 wrap 执行时接收的参数数组。可见这里的 bind 和原生 _bind_ 实现效果一样，`bind(Axios.prototype.request, context)` 相当于 `Axios.prototype.request.bind(context)`

```js
utils.extend(instance, Axios.prototype, context);
utils.extend(instance, context);
```

接下来两次调用 utils.extend 函数，extend 函数如下所示：
```js
function extend(a, b, thisArg) {
  forEach(b, function (val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}
```
extend 函数中的 forEach 函数也是辅助函数之一：
```js
function forEach(obj, fn) {
  if (obj === null || typeof obj === 'undefined') return;
  if (typeof obj !== 'object') {
    obj = [obj];
  }
  if (isArray(obj)) {
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}
```

forEach 函数中，如果接收的 obj 是 null 或 undefined，则直接返回，因为它不能被遍历。如果 obj 不是对象，则将它放入一个数组中包裹起来，然后判断如果 obj 是数组的话，遍历数组，调用传入的回调函数fn，传入当前遍历项和索引和被遍历的数组。如果 obj 是对象，则遍历 obj 的自有属性，调用 fn ，传入当前遍历的属性值和属性和被遍历的对象。

因此在 extend 函数中，是调用 forEach 函数遍历对象 b 的自有属性：如果是方法，就调用 bind 函数将该方法的 this 指定为 thisArg，再将改绑 this 后的方法添加到对象 a 中，如果是普通属性，直接将它添加到对象 a

所以两次调用 extend 是将 Axios 原型上的属性/方法，和 Axios 实例上的属性/方法都拷贝到 instance 对象上，如果拷贝的是方法，它里面的 this ，统一指向 Axios 实例 context 。由于 instance 指向 wrap 函数，所以实际是给 wrap 函数添加了这些属性和方法。

通过在源码中打断点验证了我的分析：

![avatar](/pics/axios的指向.png)

因为 axios 实际指向了 wrap 函数。实际执行并返回 Axios.prototype.request.apply(context, args) 。因此可以理解为 axios 指向指定了 this 的 Axios.prototype.request 函数。

## 探究Axios构造函数

我们知道 axios 指向的 wrap 函数，axios 执行即 wrap 函数执行，实际执行 Axios.prototype.request ，并且 wrap 函数被添加的方法中的 this 指向了一个 Axios 的实例。我们现在要来考察 Axios 构造函数：

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  }
}
Axios.prototype.request = function (config) {
  // ....
};
```

Axios 的实例挂载了两个属性：

defaults 属性，属性值为 Axios 接收的参数 instanceConfig。

interceptors 属性，属性值为一个包含 request 和 response 两个属性的对象，属性值都为 InterceptorManager 实例。

![avatar](/pics/Axios实例的属性.png)

接下来还会往 Axios.prototype 上添加 delete、get、head、options、post、put、patch 方法：

```js
utils.forEach(['delete', 'get', 'head', 'options'], function (method) {
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});
utils.forEach(['post', 'put', 'patch'], function (method) {
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});
```
前面提到 Axios.prototype 上的属性和方法已经拷贝了给 axios ，即 wrap 函数，所以 axios 可以直接调用 get, post, head 等这些方法，当然也包括 Axios.prototype.request 方法。

可以看到，新挂载的这些方法，都实际执行 Axios.prototype.request 方法。即，axios[method] 执行接收的参数，会通过 utils.merge 函数合并为一个配置对象，传入 Axios.prototype.request 方法执行。

看看 merge 函数的实现：

```js
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }
  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}
```
merge 函数将多个对象的属性合并到一个对象中，如果合并的属性值为对象，就递归调用merge进行合并。

前面提到，axios 可以理解为改绑了this的 Axios.prototype.request 方法，所以 axios 可以直接传入配置对象执行。

axios(config) 这么调用，wrap 函数接收 config 对象执行，实际是执行 Axios.prototype.request，axios.request(config)，是Axios.prototype.request 直接接收 config 执行，axios[method](url[, config])，转而都调用 Axios.prototype.request 方法。

| API 写法        |说明                |
|-------------|------------------- |
|axios(config)|传入相关配置来创建请求|
|axios(url[, config])|可以只传url，但会默认发送 GET 请求|
|axios.request(config)|config中url是必须的|
|axios[method](url[, config])<br>axios[method](url[, data[, config]])|为了方便，给所有支持的请求方法提供了别名<br>这种情况下，不用再config中指定url、method、data|

## 配置对象config怎么起作用

我们看到 config 配置对象在 Axios 库内部经历了很多层的传递，它是怎么一步步传到需要它的地方，是我们希望了解的。

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

回到 /axios.js 文件，我们看看 aixos 中默认的 config 对象是怎么被使用的。

```js
var defaults = require('./defaults');

function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);
  // ...
  return instance;
}

var axios = createInstance(defaults);
```

![a](/pics/默认config.png)

上面我们看到了 ./defaults 文件导出的默认配置对象，传入了 createInstance 函数执行。

在 createInstance 函数中，它传入 new Axios 执行，前面提到 Axios 构造函数会把接收的 config 对象赋给实例的 defaults 属性，即 Axios 实例的 defaults 属性值为默认配置对象。

我们前面说了，axios 发起请求的调用，都会实际调用 Axios.prototype.request 函数，它内部怎么处理传入的参数，我们仔细看看这个函数的实现：

```js
Axios.prototype.request = function request(config) {
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);

  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }
  // ....
};
```
如果传入 request 的第一个参数是字符串，就认为第二个参数传的是配置对象，将它赋给 config ，如果没传第二个参数，则 config 为一个空对象，接着把第一个参数接收的字符串赋给 config.url 。

如果第一个参数不是字符串，则默认它传的是配置对象，直接把它赋给 config ，如果什么都没传，赋给 config 一个空对象。

然后调用 mergeConfig ，将默认的配置对象和 config 合并，合并的结果覆盖 config ，如果 config.method 存在，则将它转为小写，如果不存在，config.method 默认为 'get'

因此，用户的不同方式的传参，在 request 中都会归一化为一个 config 对象。

我们看看 mergeConfig 的实现：

```js
function mergeConfig(config1, config2 = {}) {
  var config = {}; // 结果对象
  utils.forEach(['url', 'method', 'params', 'data'], function(prop) {
    if (typeof config2[prop] !== 'undefined') { 
      config[prop] = config2[prop]
    }
  });
  utils.forEach(['headers', 'auth', 'proxy'], function(prop) {
    if (utils.isObject(config2[prop])) {
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);
    } else if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (utils.isObject(config1[prop])) {
      config[prop] = utils.deepMerge(config1[prop]);
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });
  utils.forEach(['baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer', 'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName', 'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength', 'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken', 'socketPath'], function(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop]; 
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop]; 
    }
  });
  return config;
};
```

可以看到，不同的配置项有不同的合并方式：

对于'url', 'method', 'params', 'data'属性的合并，config2 中有就用 config2 中的，config2 没有也不用 config1 的。

对于'headers', 'auth', 'proxy'属性，属性值的合并需要深度合并，如果 config2 中的属性值为对象，就将 config1 和 config2 的该属性值深度合并。如果 config2 中属性值存在，但不是对象，则取 config2 的属性值。如果 config2 中该属性不存在，但 config1 中存在，并且是对象，把 config1 的该属性值内部进行深度合并，去除重复的属性。如果 config2 中该属性不存在，config1 中存在，但不是对象，就用 config1 的

对于'baseURL', 'transformRequest'等属性，如果 config2 中该属性存在，就用 config2 的，如果 config2 中该属性不存在，但 config1 中存在，则用 config1 的。

## 修改默认config的方式

我们知道 Axios 实例的属性已经被添加到了 axios 所指向的 wrap 函数上了，用户可以通过 `axios.defaults` 访问到 Axios 实例上的 defaults。

因此用户可以通过类似：`axios.defaults[configName] = value;`，直接修改或添加默认配置对象中的配置项

除了这种修改默认配置的方式之外， axios 还挂载了 create 方法，供用户传入自定义的配置对象：

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
}
```

axios.create 是对 createInstance 函数的封装，我们知道 createInstance 函数返回 wrap 函数。

axios.create 接收用户传入的配置对象 instanceConfig ，调用 mergeConfig 将默认配置对象和 instanceConfig 合并，合并的结果传入 createInstance 函数执行。 createInstance 返回一个新的 wrap 函数，即新的 axios。

可见 axios.create 就是新建一个 axios ，它所带的默认配置对象是由用户参与配置的。

总结一下，改动配置对象一共有三种方式

1. _axios(config)_ 等通过 Axios.prototype.request 的调用传入配置对象，这种方式不改动原本的默认配置对象，由内部完成默认配置对象和传入配置的合并。

2. `axios.defaults[name] = value` 直接修改默认的配置对象

3. `axios.create(config)` 另创建一个 axios 对象，它的默认配置对象是用户参与自定义的。

这三种方式叠加使用的话，最后 config 肯定要整合成一个，必然涉及到覆盖，因此存在优先级的问题。

由于 2 和 3 都是针对默认配置进行改动，所以 1 的优先级最高，axios.create 接收的配置会合并到默认配置，所以优先级排第 2 ：

  1. request方法的的参数config
  2. Axios实例属性defaults
  3. 默认配置对象defaults（来自/lib/defaults.js)

## 探究 Axios.prototype.request

前面了解了 Axios 构造函数，也知道了 config 是怎么传递和合并的，继续看 request 这个核心方法：

```js
Axios.prototype.request = function(config) {
  // ....
  var chain = [dispatchRequest, undefined];
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

现在 config 是整合好的配置对象。接着定义数组 chain ，里面有 dispatchRequest 函数和 undefined 。接着创建一个以 config 为实现的 Promise 实例，赋给变量 promise。

接下来是这几行代码：

```js
this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
});

this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
});
```

this.interceptors.request 和 this.interceptors.response 是 Axios 实例的 interceptors 对象的属性，属性值都为 new InterceptorManager()，我们看看 InterceptorManager 这个构造函数和它的 forEach 方法：

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

可见 InterceptorManager 实例有自己的 handlers 属性，属性值为一个数组。

InterceptorManager 的原型方法 forEach 做的事：遍历实例的 handlers 数组，将数组的每一个不为 null 的项传入 fn 执行。对于 this.interceptors.request 和 this.interceptors.response 调用 forEach 来说，fn 分别是 unshiftRequestInterceptors 函数和 pushResponseInterceptors 函数：

```js
function unshiftRequestInterceptors(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
}
function pushResponseInterceptors(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
}
```
unshiftRequestInterceptors 函数每次执行，都把 this.interceptors.request 的 handlers 数组里的每个 interceptor 对象的 fulfilled 属性值和 rejected 属性值，成对地推入 chain 数组的开头

![a](/pics/req-cb.png)

pushResponseInterceptors 函数每次执行，都把 this.interceptors.response 的 handlers 数组里的每个 interceptor 对象的 fulfilled 属性值和 rejected 属性值，成对地推入 chain 数组的末尾

![a](/pics/res.cb.png)

问题来了，handlers 数组怎么存了这些 interceptor 对象的？其实是用户调用 use 方法注册的：

```js
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
}
```

use 是 InterceptorManager 的原型方法，用户可以通过 axios.interceptors.request.use 传入成功的回调和失败的回调，它们分会别赋给一个对象里的 fulfilled 和 rejected 属性，然后整个对象被 push 进实例的 handlers 数组里，下面是用户使用 use 的方式：

```js
axios.interceptors.request.use(
  config => {
    // ...
    return config;
  }, error => {
    // ...
    return Promise.reject(error);
  }
);
```

![a](/pics/use.png)

在请求拦截器的成功回调中，我们会做一些发送 HTTP 请求之前的修改请求的 data 或 header 的工作，并且必须返回 config 。失败回调中，在请求出错时做一些事情。

这样 axios.interceptors.request.handler 数组，就存放着用户通过 use 注册的，包含请求拦截器的成功回调和失败回调的对象。

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

这样 axios.interceptors.response.handler 数组，存放着用户通过 use 注册的，包含响应拦截器的成功回调和失败回调的对象

如果用户添加了拦截器方法，chain 数组就会存放成对的拦截器回调和 dispatchRequest 方法，请求拦截器回调在 dispatchRequest 之前，响应拦截器方法在 dispatchRequest 之后，接下来开启一个 while 循环：

```js
while (chain.length) {
  promise = promise.then(chain.shift(), chain.shift());
}
```

![a](/pics/then1.png)

进入 while 循环之前， promise 实例的状态是 resolved 的，它调用 then ，接收两个从 chain 数组 shift 出来的函数，作为 then 的成功回调和失败回调，将它们注册为异步执行的微任务，推入微任务队列中，then 返回的 promise 实例的状态是 pending ，覆盖给 promise 变量

![a](/pics/then2.png)

在 while 循环中，promise 继续调用 then ，形成了链式调用，chain 数组中的回调被不断地成对shift出来，被推入微任务队列中，直到 chain 数组到空，循环结束。

注意，经过 while 循环后的 promise 是一个状态为 pending 的 promise 实例，因为这都在执行同步代码，异步操作还没执行(还没有调用resolve或reject)，最后 Axios.prototype.request 函数返回出这个 promise 实例。

![a](/pics/then.png)

当同步代码执行完，就开始执行异步的微任务队列，按 chain 中的回调被推入微任务队列的先后循序，首先依次执行所有请求拦截器方法，执行完如果没出现错误，就执行 dispatchRequest 方法。

因为规定请求拦截的成功回调必须返回 config ，而下一个请求拦截的成功回调的形参能接收这个 config ，处理之后再返回 config ，config 对象就像在这个微任务队列中的前半部分传递，到了 dispatchRequest 方法，它接收它上一个请求拦截器方法的成功回调返回的 config 。

接下来看看 dispatchRequest 函数：

## dispatchrequest 做了什么

```js
function dispatchRequest(config) {
  throwIfCancellationRequested(config);
  config.headers = config.headers || {};// 确保config中headers对象存在
  config.data = transformData(// 对请求的config.data进行转换
    config.data,
    config.headers,
    config.transformRequest
  );
  config.headers = utils.merge(// 将config.headers的属性展平
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );
  utils.forEach(// config.headers中关于请求方法的属性删掉
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );
  var adapter = config.adapter || defaults.adapter;
  return adapter(config).then( /*代码省略*/ );
};
  ```
dispatchRequest 函数对 config.headers 和 config.data 做了一些处理

将config.data, config.headers, config.transformRequest 传入 transformData 函数执行，返回值赋给 config.data 。我们看看 transformData 的实现：

```js
module.exports = function transformData(data, headers, fns) {
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });
  return data;
};
```

transformData 遍历 config.transformRequest 数组，执行它里面的每个回调函数，传入 config.data, config.headers 执行，返回值再覆盖 config.data ，循环结束后返回 config.data

我们看看默认的 config.transformRequest 数组：

```js
var defaults = {
  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }]
  // 
};
```
默认的 config.transformRequest 是一个只有 transformRequest 函数的数组。transformRequest 函数首先将 headers 对象中的 'Accept' 和 'Content-Type' 的属性名规范化。

判断如果 config.data 是 FormData 或 ArrayBuffer 或 Buffer 或 Stream 或 File 或 Blob 格式，直接返回 config.data 。如果是 ArrayBufferView ，返回它的 buffer 属性值。

```js
function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}
```

如果 config.data 是 URLSearchParams 对象，调用 setContentTypeIfUnset 函数：

如果 config.headers 存在，但不存在 'Content-Type' 这个字段，就给 config.headers 添加 'Content-Type' 这个首部字段，属性值为 'application/x-www-form-urlencoded;charset=utf-8'，最后函数返回 data.toString()，将 URLSearchParams 对象转为 URL 查詢字符串。

如果 config.data 是普通对象，调用 setContentTypeIfUnset 函数：

如果 config.headers 存在，但不存在 'Content-Type' 这个字段，就给 config.headers 添加 'Content-Type' 这个首部字段，属性值为 'application/json;charset=utf-8'，最后函数返回 JSON.stringify(data)，将 data 对象转为 JSON 字符串。

以上可能都不是，直接返回 config.data

```js
config.headers = utils.merge(// 将config.headers的属性展平
  config.headers.common || {},
  config.headers[config.method] || {},
  config.headers || {}
);
```

如果没有特别配置config.headers.common，那它是由下面这个默认配置项合并而来的：

```js
defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};
```
config.headers[config.method] 是这么来的，如果没有特别地去配置头部该字段的话：

```js
utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge({
  'Content-Type': 'application/x-www-form-urlencoded'
});
```

最后 config.headers 是传入dispatchRequest的config的headers对象，经过utils.merge函数合并，config.headers的属性被展平了。

```js
utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
  function cleanHeaderConfig(method) {
    delete config.headers[method];
  }
);
```

删除掉 config.headers 中关于各个 method 的属性

重点来到后两句。

```js
var adapter = config.adapter || defaults.adapter;
return adapter(config).then( /*代码省略*/ );
```

如果用户配置了 adapter 方法，就将它赋给变量 adapter，如果没有，则使用 defaults.adapter 。然后执行 adapter ，传入已经处理好的 config。执行结果继续调用 then ，最后 dispatchRequest 返回 then 返回的 promise 实例。

用户很少自己定义 adaptor ，我们看看默认的 defaults.adapter 的实现：

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

defaults.adaptor 的值是 getDefaultAdapter() 的返回值。在 getDefaultAdapter 函数中，根据宿主环境是 Node.js 还是浏览器环境，引入不同的文件导出的函数。

http.js 文件中使用 Node.js 内置的 http 模块来实现请求的发送，这里不作具体分析。xhr.js 文件中导出了浏览器中使用的 xhrAdapter 函数，我们看看它的实现:

### xhrAdapter 的实现

```js
function xhrAdapter(config) {
  return new Promise(function(resolve, reject) {
    var request = new XMLHttpRequest(); // 创建 XMLHttpRequest 实例
    // 调用request的实例方法open，发起xhr请求
    request.open(
      config.method.toUpperCase(), 
      buildURL(config.url, config.params, config.paramsSerializer),
      true
    );
    // ...
    // 监听 readyState，设置对应的处理回调函数
    request.onreadystatechange = function() {
      if (!request || request.readyState !== 4) return // request对象为空或readyState不为4(它会从0变到4)，直接返回
      // XMLHttpRequest.status表示服务器响应的HTTP状态码，如果通信成功，为200。发出请求之前，它默认为0。
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0))
        return;
      // 准备 response 对象
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config,
        request
      };
      settle(resolve, reject, response);
      request = null;// 清除request对象
    };
    request.send(requestData); // 发送请求
  });
};
```

为了方便阅读，对 xhrAdapter 函数做了一些删减，函数返回一个 promise 实例，它管控了一套 XMLHTTPRequest 发起 AJAX 请求的流程。

异步请求成功后，根据返回的响应数据整合出 response 对象，response会传入 _settle_ 方法执行，_settle_ 会根据响应的数据决定是调用 resolve 还是 reject ，我们看看 settle 方法的实现：

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

settle 函数首先获取 validateStatus 函数，如果用户配置了自己的 validateStatus 函数，则优先使用，否则采用默认的 validateStatus，如下：

```js
var defaults = {
  validateStatus (status) {
    return status >= 200 && status < 300;
  }
};
```
validateStatus 判断 response.status 值，即 HTTP 响应状态码，如果满足在 [200,300) 内，则返回 true ，将调用 resolve(response) 将 xhrAdapter 函数返回的 promise 实例的状态变为 resolved ，如果不满足在 [200,300) 内，则返回false，调用 reject 将 promise 实例状态改为 rejected。

在 dispatchRequest 函数中，adapter 函数返回的promise继续调用 then，传入的成功回调和失败回调，对 adapter 返回的 promise 实例的成功或失败结果，即 response 和 reason ，做再次加工。如下：

```js
function dispatchRequest(config) {
  // ...
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

可见，成功的回调最后返回处理后的response对象，失败的回调返回处理过的Promise.reject(reason)

意味着，如果 HTTP 请求成功，dispatchRequest 函数返回的是以 response 对象为实现的，状态为 resolved 的 promise 实例。

dispatchRequest 执行完，接着执行微任务队列中剩下的响应拦截器方法，它们接收 response 对象，对 response 对象做一些处理，再返回出 response ，response 对象就像在微任务队列的后半部分传递，异步微任务队列执行完后， promise 的状态已经变为 resolved 或 rejected。

即 Axios.prototype.request 返回 promise 实例的状态取决于异步任务的结果。用户可以用返回出的这个 promise 实例继续调用 then ，在 then 的回调中拿到 response 对象 或 reason 对象。response 对象就包含了HTTP请求响应的data。

## 总结

到目前为止，整个 axios 调用流程就讲完了。核心方法是：Axios.prototype.request 。

如果用户设置了拦截器方法，就将它们推入 chain 的数组中，chain 数组形成了：[请求拦截器方法(成功回调+失败回调)... + dispathRequest + 响应拦截器方法(成功回调+失败回调)...] 这样的队列，然后通过链式调用 promise 实例的 then 方法，传入 chain 数组中的方法作为 then 的成功和失败的回调，即推入微任务队列中，等待异步执行。

config 对象在这个微任务队列中的前半部分传递，到了 dispatchRequest 方法，它执行 adapter 方法（对于浏览器就是 xhrAdapter 方法），xhrAdapter 方法就是发起 XHR 请求的流程的 promise 封装，会根据响应的状态决定将返回的 promise 转为 resolved 或 rejected 状态。

在 dispatchRequest 中，adapter 的返回值再调用 then ，传入成功和失败的回调，对响应的数据做再次处理，再把 response 对象 return 出来。所以在接下来的微任务队列的后半部分，响应拦截器方法接收的是 response ，对 response 对象做处理，response 相当于在队列中传递。

最后 Axios.prototype.request 经过 then 链式调用的 promise 的状态，随着微任务队列执行的结束而被确定下来。

意味着，你使用 axios 提供给你的 API 的返回值，再调用 then 就能在回调中拿到 response/reason 对象。

ok，完整的流程就叙述完毕。

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
