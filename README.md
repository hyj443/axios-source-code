# 深入浅出Axios源码

## Axios是什么

Axios 不是一种新的技术，本质上是用 Promise 对原生 XHR 的封装，并提供一些高级特性。

它的流程大致如下：

![](/pics/process.png)

## axios 到底是什么

我们看入口文件 index.js，只有一句：

```js
module.exports = require('./lib/axios');
```

lib/axios.js 模块导出是 axios：

```js
module.exports = axios;
```

整个库对外暴露的的是 axios，看看它的定义：

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
axios 指向 createInstance 函数的返回值。createInstance 函数首先创建一个 Axios 的实例 context，再调用 bind 函数生成 instance，再两次调用 extend 函数对 instance 进行扩展，最后返回出 instance 赋给 axios。

可见，axios 实际指向 bind 函数的返回值。我们看看 bind 函数：

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

bind 函数接收 request 方法和 context，执行返回新的函数 wrap 赋给 instance。因为 axios 指向 bind 函数的返回值，所以 axios 指向 wrap 函数。

wrap 执行，实际执行 request，且执行时的 this 指向 context，并接收 wrap 执行时接收的参数。这和原生 bind 实现效果一样，`bind(Axios.prototype.request, context)` 相当于 `Axios.prototype.request.bind(context)`

```js
utils.extend(instance, Axios.prototype, context);
utils.extend(instance, context);
```

接下来两次调用 extend 函数，extend 函数如下：

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
extend 函数中的 forEach 函数的作用就是进行遍历，执行传入的回调函数：
```js
function forEach(obj, fn) {
  if (obj === null || typeof obj === 'undefined') {
    return;
  }
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
如果传入的 obj 有值但不是对象类型，则用一个数组包裹它。然后判断如果是数组，则遍历数组逐项调用回调 fn。如果 obj 是对象，则遍历对象的自有属性，调用 fn。

因此，extend 函数就是遍历对象 b 的自有属性，拷贝到对象 a，如果拷贝的是方法，则拷贝改绑了 this 为 thisArg 的方法。

两次 extend 将 Axios 原型上的属性/方法，和 Axios 实例上的属性/方法都拷贝到 instance 上。由于 instance 指向 wrap 函数，所以实际是添加到了 wrap 函数身上。

通过在源码中打断点验证了我的分析：

![avatar](/pics/axios的指向.png)

因为 axios 实际指向了 wrap 函数。所以 axios 执行并返回 Axios.prototype.request.apply(context, args)，可以理解为 axios 指向指定了 this 的 Axios.prototype.request 方法。

## 探究 Axios 构造函数

现在来考察一下 Axios 构造函数：

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}
Axios.prototype.request = function request(config) {
  // ...
};
Axios.prototype.getUri = function getUri(config) {
  // ...
};
```

Axios 实例的 defaults 属性保存接收的配置对象。实例的 interceptors 属性，值是一个拦截器对象，包含 request 和 response 两个属性，属性值均为 InterceptorManager 实例。

![avatar](/pics/Axios实例的属性.png)

并且 Axios 有两个原型方法：request 和 getUri。Axios 原型还会添加以下7种方法：

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
已知，Axios 原型上的属性和方法会拷贝给 axios，所以 axios 可以直接调用 Axios 原型上的这些方法，比如 axios.get() axios.post()...

这7种方法都实际调用 request 方法，接收的参数通过 merge 合并，传入 request 执行。不同的是：delete, get, head, options 方法调用时是不传 data 的，post, put, patch 调用时是传 data 的。

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

merge 函数首先创建一个空对象 result，逐个遍历所有传入的对象，将键值对拷贝到 result 中，如果有属性已经添加过，且已添加的属性值和新添加的属性值都是对象，则递归调用 merge 进行合并，返回值覆盖原来的属性值。

不满足都是对象的话，只需简单地将新的属性值覆盖上去就好。

已知，axios 直接调用实际调用 request，所以 axios 可以直接传入配置对象执行：axios(config)。

axios.request(config) 也是调用 Axios.prototype.request。axios[method](url[, config]) 都是实际调用 Axios.prototype.request。method 是上面7种请求方法。

| API 写法        |说明                |
|-------------|------------------- |
|axios(config)|传入相关配置来创建请求|
|axios(url[, config])|可以只传 url，但会默认发送 GET 请求|
|axios.request(config)|config 中 url 是必须的|
|axios[method](url[, config])<br>axios[method](url[, data[, config]])|不用在 config 中指定 url、method、data|

## 配置对象config怎么起作用

axios 文档告诉我们，我们可以定义这些配置项：

|配置项|说明|
|---|---|
|`url` |请求的 URL|
|`method`|请求的方法|
| `baseURL`|加在 `url` 前面，除非 `url` 是绝对 URL|
|`transformRequest`|发送请求前，修改 request 数据|
| `transformResponse`|修改响应的数据|
| `headers`|自定义请求头|
| `params`|URL 参数，必须是纯对象或 URLSearchParams 对象|
|`paramsSerializer`|序列化 params 的函数|
| `data`|作为请求主体的数据|
| `timeout`|指定请求超时的毫秒数，超过就请求中断|
| `withCredentials`|跨域请求时是否需要使用凭证|
| `adapter`|用户自定义的处理 config 的函数|
| `responseType`|服务器响应的数据类型|
| `auth` 等......|......|

config 对象在 Axios 库内部是怎么一步步传到需要它的地方？回到 axios.js 文件：

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

defaults 文件导出的默认配置对象，传入 createInstance 函数执行。然后传入 new Axios，Axios 实例的 defaults 属性保存了该默认配置对象。

那用户传的配置呢？axios[method] 接收的参数，经过 merge 合并为一个 config 对象，传入 request 执行，axios 和 axios.request 方式都是把接收的参数传给 request，我们看看 request 怎么处理它们：

```js
Axios.prototype.request = function (config) {
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
如果传入 request 的第一个参数是字符串，则把传的第二个参数作为 config，如果没传第二个参数，则赋给 config 一个空对象，第一个参数的字符串赋给 config.url。

如果第一个参数不是字符串，则把它赋给 config，如果什么都没传，赋给 config 一个空对象。

接着调用 mergeConfig 函数将默认配置对象和 config 合并，返回值赋给 config。

可见，用户不同方式的传参，在 request 函数中会被整合到一个 config 对象。合并后，如果 config.method 存在，则将它转为小写，如果不存在，则如果默认配置中配置了 method，将它小写化并赋给 config.method，如果也没有配置，则默认为 'get'

我们大致看看 mergeConfig 的实现：

```js
module.exports = function mergeConfig(config1, config2) {
  config2 = config2 || {};
  var config = {};
  var valueFromConfig2Keys = ['url', 'method', 'data'];
  var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
  var defaultToConfig2Keys = [
    'baseURL', 'url', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress',
    'maxContentLength', 'maxBodyLength', 'validateStatus', 'maxRedirects', 'httpAgent',
    'httpsAgent', 'cancelToken', 'socketPath', 'responseEncoding'
  ];
  utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });
  utils.forEach(mergeDeepPropertiesKeys, function mergeDeepProperties(prop) {
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
  utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });
  var axiosKeys = valueFromConfig2Keys
    .concat(mergeDeepPropertiesKeys)
    .concat(defaultToConfig2Keys);
  var otherKeys = Object
    .keys(config2)
    .filter(function filterAxiosKeys(key) {
      return axiosKeys.indexOf(key) === -1;
    });
  utils.forEach(otherKeys, function otherKeysDefaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });
  return config;
};
```

不同的配置项有不同的合并策略：

对于 url, method, data 属性的合并，config2 中有就用 config2 中的，config2 没有也不用 config1 的。

对于 headers, auth, proxy, params 属性需要深度合并，如果 config2 中的属性值为对象，就将 config1 和 config2 的该属性值深度合并。如果 config2 中属性值存在但不是对象，则取 config2 的属性值。如果 config2 中该属性不存在，但 config1 中存在且是对象，把 config1 的该属性值内部进行深度合并，去除重复的属性。如果 config2 中该属性不存在，config1 中存在但不是对象，就用 config1 的。

对于 baseURL , transformRequest 等属性和 config2 中出现的上面没有涉及的属性，如果 config2 中有就用 config2 的，config2 中没有但 config1 中有，就用 config1 的。

## 修改默认config的方式

我们知道 Axios 实例的属性已经被添加到了 axios 所指向的 wrap 函数上了，所以通过 axios.defaults 可以访问 Axios 实例的 defaults 属性。

因此 `axios.defaults[configName] = value` 可以直接修改或添加默认配置对象中的属性

除了这种方式修改默认配置外，还有 axios.create 方法供用户传入自定义的配置对象：

```js
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

axios.create 是对 createInstance 函数的封装，接收用户传入的配置对象，mergeConfig 会将它和默认配置对象合并，合并的结果传入 createInstance 函数执行，返回一个新的 wrap 函数，即新的 axios。

默认情况下 createInstance 函数接收默认配置对象而创建 axios，现在接收的默认配置对象是由用户参与配置的。

```js
let newAxiosInstance = axios.create({
    [配置项名称]: [配置项的值]
})
```

总结一下，改动配置对象一共有三种方式

1. `axios(config)` 等通过 Axios.prototype.request 的调用传入配置对象，这种方式不改动原本的默认配置对象，由内部完成默认配置对象和传入配置的合并。

2. `axios.defaults[name] = value` 直接修改默认的配置对象

3. `axios.create(config)` 另创建一个 axios 对象，它的默认配置对象是用户参与自定义的。

这三种方式叠加使用的话，最后 config 肯定要整合成一个，必然涉及到覆盖，因此存在优先级的问题。

由于 2 和 3 都是针对默认配置进行改动，所以 1 的优先级最高，axios.create 接收的配置会合并到默认配置，所以优先级排第 2 ：

  1. request方法的的参数config
  2. Axios实例属性defaults
  3. 默认配置对象defaults (来自/lib/defaults.js)

## 探究 Axios.prototype.request

前面知道了 request 方法怎么处理用户传入的参数的，继续看 request 方法：

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
    promise = promise.then(chain.shift(), chain.shift())
  }
  return promise;
};
```
此时 config 已经经过整合。接着，定义数组 chain，存放了 dispatchRequest 函数和 undefined。接着创建一个成功值是 config 的成功状态的 Promise 实例，赋给变量 promise。

接下来：

```js
this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
});

this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
});
```
this 指向 Axios 实例，this.interceptors.request 和 this.interceptors.response 均为 InterceptorManager 实例，并调用 forEach，我们看看 InterceptorManager 类和它的 forEach 原型方法：

```js
function InterceptorManager() {
  this.handlers = [];
}
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};
```

InterceptorManager 实例挂载了一个 handlers 数组。forEach 方法会遍历实例的 handlers 数组，将数组中不为空的项传入 fn 执行。对于上面两次调用 forEach 来说，fn 分别是 unshiftRequestInterceptors 和 pushResponseInterceptors ：

```js
function unshiftRequestInterceptors(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
}
function pushResponseInterceptors(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
}
```

unshiftRequestInterceptors 函数每次执行，会把 this.interceptors.request 的 handlers 数组里的每个对象的 fulfilled 方法和 rejected 方法，成对地推入 chain 数组的开头

![a](/pics/req-cb.png)

pushResponseInterceptors 函数每次执行，会把 this.interceptors.response 的 handlers 数组里的每个对象的 fulfilled 方法和 rejected 方法，成对地推入 chain 数组的末尾

![a](/pics/res.cb.png)

问题来了，handlers 数组中的项是从哪里来的？其实是用户调用 use 方法注册的：

```js
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
}
```

用户调用 axios.interceptors.request.use 传入成功回调和失败回调，它们会分别赋给一个对象里的 fulfilled 和 rejected 属性，然后该对象被推入实例的 handlers 数组里，use 大致使用方式：

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

这是用户添加请求拦截器方法的方式。请求拦截器的成功回调会做一些发送请求前修改请求的 data 或 header 的工作，并且必须返回 config。失败回调会在请求出错时做一些事情。

axios.interceptors.request.handler 数组就存放着包含请求拦截器的成功回调和失败回调的对象。

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

axios.interceptors.response.handler 数组存放着包含响应拦截器的成功回调和失败回调的对象

如果用户添加了拦截器方法，chain 数组就不止 dispatchRequest 和 undefinded，它的前面存放请求拦截器的回调，它的后面存放响应拦截器的回调，且它们是成对的，接着开始 while 循环：

```js
while (chain.length) {
  promise = promise.then(chain.shift(), chain.shift());
}
```

![a](/pics/then1.png)

while 循环之前，promise 状态是成功，它调用 then，接收两个从 chain 数组 shift 出来的函数作为 then 的成功回调和失败回调，将它们推入异步的微任务队列中，then 返回的新的 promise 的状态是 pending，覆盖给 promise 变量

![a](/pics/then2.png)

在 while 循环中，promise 继续调用 then，形成链式调用，chain 数组的项被不断成对地 shift 出来，推入微任务队列中，直到 chain 数组到空，循环结束。

循环结束后，promise 的状态依然是 pending，因为在执行同步代码，异步操作还没执行，还没有结果，Axios.prototype.request 方法返回出该 promise。

![a](/pics/then.png)

当同步代码执行完，就开始执行异步的微任务队列，按 chain 中的回调被推入微任务队列的先后顺序，首先依次执行所有请求拦截器方法，因为请求拦截的成功回调接收的是 config，也返回 config，所以下一个请求拦截的成功回调能接收上一个回调返回的 config，处理之后再返回出来。

执行完如果没有出现错误，就执行 dispatchRequest 方法，它也接收 config 对象。

## dispatchrequest 做了什么

```js
function dispatchRequest(config) {
  throwIfCancellationRequested(config);
  config.headers = config.headers || {};
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );
  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );
  var adapter = config.adapter || defaults.adapter;
  return adapter(config).then( /*代码省略*/ );
};
```

dispatchRequest 函数首先调用 transformData 函数对 config.data 进行转换。我们看看 transformData 的实现：

```js
function transformData(data, headers, fns) {
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });
  return data;
};
```

transformData 函数会遍历 config.transformRequest 数组，逐个执行每个转换函数，传入 config.data 和 config.headers，返回值覆盖给 config.data，遍历结束后 config.data 转换完毕，返回出来。

我们看看默认的 transformRequest 数组：

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
};
```
defaults.transformRequest 数组只有一个 transformRequest 函数。它首先将 headers 对象中的 'Accept' 和 'Content-Type' 这两个头部字段名规范化。

```js
function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};
```
normalizeHeaderName 函数遍历 headers 对象的属性，如果发现当前属性和传入的规范的头部字段名不同，但它们转大写后是一样的，则把规范化的头部名添加到 headers 对象中，再把原来的删掉。

回到 transformRequest，如果 config.data 是 FormData/ArrayBuffer/Buffer/Stream/File/Blob 类型，不用转换，返回它本身。如果是 ArrayBuffer 类型数据的一个 view，返回它的 buffer 属性值。如果是 URLSearchParams 对象，先调用 setContentTypeIfUnset 函数进行 headers 的设置：

```js
function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}
```

如果 config.headers 存在，但里面没有 'Content-Type'，就给它加上，值为 'application/x-www-form-urlencoded;charset=utf-8'，然后返回 data.toString()，即把 URLSearchParams 对象转成了 URL 查詢字符串。

如果 config.data 是普通对象，也是先修整 config.headers，如果它里面没有 'Content-Type'，就加上，值为 'application/json;charset=utf-8'，然后返回 JSON.stringify(data)，将 data 对象转成 JSON 字符串。

如果不是以上情况，config.data 则不做转换返回本身。

接下来处理 config.headers：

```js
config.headers = utils.merge(
  config.headers.common || {},
  config.headers[config.method] || {},
  config.headers || {}
);
```

如果没有特别配置 config.headers.common，那它是由下面这个通用的头部字段合并而来的：

```js
defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};
```
如果没有特别配置 config.headers[config.method]，它是从这么来的：

```js
utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge({
  'Content-Type': 'application/x-www-form-urlencoded'
});
```

config.headers 中存放了各个 method 和它对应的默认头部信息。

config.headers.common、config.headers[config.method]、config.headers 经过 merge 合并后，赋给 config.headers，即 common 和各个 method 对应的对象中的头部字段被拿出来放到 config.headers 中。

```js
utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
  function cleanHeaderConfig(method) {
    delete config.headers[method];
  }
);
```
config.headers[method] 对象中的字段被拿出来后就没有存在的意义了，所以删掉 config.headers 对象中关于 method 的属性。

接着，来到了重点：

```js
var adapter = config.adapter || defaults.adapter;
return adapter(config).then( /*代码省略*/ );
```
adapter 优先使用用户配置的 adapter 方法，否则使用默认的 adapter。调用 adapter，传入已处理好的 config。返回值继续调用 then，dispatchRequest 函数最后返回 then 返回的 promise 实例。

用户一般不会自己定义 adapter，我们看默认的 adapter：

```js
var defaults = {
  adapter: getDefaultAdapter(), // 获取默认的请求方法
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

getDefaultAdapter 函数会根据是 Node 环境还是浏览器环境，获取默认的 adapter 方法。

http.js 文件中使用 Node 的 http 模块来实现请求的发送，这里不分析。xhr.js 导出的 xhrAdapter 函数是 axios 在浏览器环境下使用的默认请求方法：

### xhrAdapter 的实现

```js
// 做了一些删减
function xhrAdapter(config) {
  return new Promise(function(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    // 如果请求的data是FormData对象，删除header的Content-Type字段，让浏览器自动设置Content-Type字段
    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type'];
    }
    var request = new XMLHttpRequest(); // 创建 XMLHttpRequest 实例
    // ...
    var fullPath = buildFullPath(config.baseURL, config.url);
    // 初始化请求，open方法的参数分别是：要使用的HTTP方法、要向其发送请求的URL、是否异步执行操作
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);
   
    request.timeout = config.timeout; // 设置超时时间
    // 监听readyState的变化，设置处理回调函数
    request.onreadystatechange = function() {
      if (!request || request.readyState !== 4) return // request不存在或readyState不为4(它会从0变到4)，直接返回。当readyState为4，说明"DONE"，可能拿到了数据也可能失败。

      // XMLHttpRequest.status是服务器响应的HTTP状态码，在请求完成前，值为0，如果XHR出错，返回的也是0。如果是200，代表是一个成功的请求
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) return;
      
      // 准备response对象
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null; // getAllResponseHeaders执行返回所有的响应头，是以CRLF分割的字符串，或者null。调用parseHeaders后返回响应头部组成的对象
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response; // 如果没有设置返回数据的类型，或者设置的响应数据类型为text，则将request.responseText作为responseData，否则将request.response作为responseData
      var response = { // 创建response对象
        data: responseData,
        status: request.status,
        statusText: request.statusText, // 响应状态的文本
        headers: responseHeaders,
        config,
        request
      };
      settle(resolve, reject, response); // 根据response响应数据决定resolve或者reject
      request = null;// 销毁request对象
    };
    // 当前请求终止时触发该函数，调用reject
    request.onabort = function handleAbort() {
      if (!request) return;
      reject(createError('Request aborted', config, 'ECONNABORTED', request));
      request = null;
    };
    // 当请求遇到错误时，触发该函数，调用reject
    request.onerror = function handleError() {
      reject(createError('Network Error', config, null, request));
      request = null;
    };

    // 当前请求超时 触发该函数
    request.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
        request));
      request = null;
    };

    // 如果当前是标准浏览器环境，添加xsrf头。xsrf头是用来防御CSRF攻击的。原理是在服务端生成一个XSRF-TOKEN，并保存到浏览器的cookie中，在每次请求中都会将XSRF-TOKEN设置到请求头中，这样服务器会比较cookie中的XSRF-TOKEN和请求头中的XSRF-TOKEN是否一致，根据同源策略，非同源的网站无法读取和修改本源的网站cookie，避免了伪造cookie
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined; // 读取cookie中的XSRF-TOKEN
      if (xsrfValue) { // 在请求头中设置XSRF-TOKEN
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // 如果request中有setRequestHeader方法，遍历requestHeaders对象
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') { // 如果requestData没有定义，则删掉Content-Type这个头部
          delete requestHeaders[key];
        } else { // 否则调用setRequestHeader方法设置请求头部
          request.setRequestHeader(key, val);
        }
      });
    }

    // 设置request的withCredentials属性，是否允许cookie进行跨域请求
    if (!utils.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }

    // 设置responseType属性，设置返回数据的类型
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }
    // request.upload是一个XMLHttpRequestUpload对象，用来表示上传的进度，但不是所有浏览器都支持
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // 处理请求取消
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) return;
        request.abort();
        reject(cancel);
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    request.send(requestData); // 发送请求
  });
};
```

xhrAdapter 函数返回一个 promise 实例，它管控了一套 XMLHTTPRequest 发起 AJAX 请求的流程，具体分析见注释。

异步请求成功后，根据返回的响应数据整合出 response 对象，response 传入 settle 执行，settle 会根据响应的数据决定是调用 resolve 还是 reject，我们看看 settle 函数：

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

settle 函数首先获取 validateStatus 函数，优先使用用户配置的 validateStatus 函数，否则采用默认的 validateStatus：

```js
var defaults = {
  validateStatus (status) {
    return status >= 200 && status < 300;
  }
};
```

默认的 validateStatus 函数会判断 response.status 值，即 HTTP 响应状态码，如果落在 [200,300)，则返回 true，然后调用 resolve(response) 将 xhrAdapter 函数返回的 promise 实例的状态变为 resolved，如果不在 [200,300)，则返回 false，调用 reject 将 promise 实例状态改为 rejected。

在 dispatchRequest 函数中，adapter 函数返回的 promise 继续调用 then，传入的成功回调和失败回调，对 adapter 返回的 promise 实例的成功值或失败值，即 response 或 reason，再次做加工：

```js
function dispatchRequest(config) {
  // ...
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
成功的回调中调用 transformData 对 response.data 进行转换，transformData 会遍历 config.transformResponse 数组，逐个执行每个转换函数，传入 response.data 和 response.headers，返回值覆盖给 response.data。遍历结束后 response.data 转换完毕，返回出来。

我们看看默认的 transformResponse 数组：

```js
var defaults = {
  transformResponse: [function transformResponse(data) {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { }
    }
    return data;
  }]
};
```
数组只有一个 transformResponse 函数。如果 response.data 是字符串，则将调用 JSON.parse 转成 JS 对象并返回。

成功的回调最后返回处理后的 response 对象，失败的回调返回处理过的 Promise.reject(reason)

这意味着，如果 HTTP 请求成功，dispatchRequest 函数返回的是成功值为 response 对象的成功状态的 promise 实例。

dispatchRequest 执行完，接着执行微任务队列中剩下的响应拦截器方法，它们接收 response 对象，对 response 对象做一些处理，再返回出 response，response 对象就像在微任务队列的后半部分传递，异步微任务队列执行完后，Axios.prototype.request 返回的 promise 的状态会变为 resolved 或 rejected。

request 方法返回的 promise 实例的状态取决于异步任务的结果。用户可以用这个 promise 实例继续调用 then，在 then 的回调中拿到 response 或 reason 对象。其中 response 包含了响应的 data。

## 核心源码的总结

到目前为止，整个 axios 调用流程就讲完了。核心方法是：Axios.prototype.request。

如果用户设置了拦截器方法，会被推入 chain 的数组中，chain 数组形如：[请求拦截器的成功回调, 请求拦截器的失败回调... + dispathRequest + 响应拦截器的成功回调, 响应拦截器的失败回调...]，然后通过 promise 链式调用 then，将 chain 数组中的方法推入微任务队列中，等待异步执行。

config 对象在这个微任务队列中的前半部分传递，到了 dispatchRequest 方法，它执行 adapter 方法（对于浏览器就是 xhrAdapter），xhrAdapter 是发起 XHR 请求的 promise 封装，会根据响应的状态决定将返回的 promise 转为 resolved 或 rejected 状态。

在 dispatchRequest 中，adapter 的返回值再调用 then，传入成功和失败的回调，对响应的数据做再次处理，再把 response 对象返回出来。接下来的微任务队列的后半部分，响应拦截器方法接收的是 response，对 response 对象做处理，response 相当于在队列中传递。

最后 Axios.prototype.request 经过 then 链式调用返回出来的 promise 的状态，会随着微任务队列执行结束而被确定下来。

用户使用 axios 提供的 API 的返回值，调用 then 就能在回调中拿到 response/reason 对象。

这就是完整的流程。

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
axios 的 config 中可以传 cancelToken 属性，值传一个 CancelToken 实例，可以在请求的任何阶段关闭请求。

axios.js 文件中可以看到：

```js
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');
```

axios 对象挂载了 CancelToken 构造函数，我们看到它的具体实现：

```js
function CancelToken(executor) {
  if (typeof executor !== 'function') { // 如果executor不是函数，抛出错误
    throw new TypeError('executor must be a function.');
  }
  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });
  var token = this; // 获取当前CancelToken实例
  executor(function cancel(message) {
    if (token.reason) return;
    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}
```

调用 CancelToken 函数时，传入 executor 方法。CancelToken 的实例会挂载 promise 属性，值是一个 promise 实例，注意到，resolve 方法赋给了 CancelToken 内定义的 resolvePromise 变量，resolve 方法因此在外部调用。

一般来说，resolve 是在传入 new Promise 的 executor 中调用。这里让 resolve 能在外部调用。promise 实例管控的是异步还是同步操作，都不能从外部决定 promise 实例的状态是成功还是失败，现在相当于把控制权交给外部的 resolveHandle 来控制这个 promise 成功与否。

```js
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};
```
CancelToken 函数上有静态方法 source，它的执行会创建一个 CancelToken 实例，传入一个 executor，new CancelToken 会将该 executor 执行并传入一个 cancel 函数，于是该 cancel 函数就赋给了 cancel 变量。最后 source 返回一个对象包含 token 和 cancel 属性，属性值分别是创建的 CancelToken 实例和 cancel 方法。

可见 cancel 取消方法就是 CancelToken 构造函数中的 cancel 方法，用户取消请求时直接调用它就可以。
```js
function CancelToken(executor) {
  // ...
  executor(function cancel(message) {
    if (token.reason) return;
    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}
```

用户调用 `source.cancel('用户取消了操作')` 即执行 cancel 函数会发生什么？

首先 token 指向 CancelToken 实例，如果 CancelToken 实例上已经存在 reason 属性，说明用户已经发起过取消操作，直接返回。否则把 Cancel 实例赋给当前 CancelToken 实例的 reason 属性，最后调用 resolvePromise 方法将当前 CancelToken 实例上的 promise 的状态改为成功。

我们看看 Cancel 构造函数：

```js
function Cancel(message) {
  this.message = message;
}
```

Cancel 实例会挂载 message 属性，值为用户传入的文本字符串。

我们看看 throwIfCancellationRequested 函数的定义：

```js
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}
```

函数会判断，如果 config 中配置了 cancelToken 实例，则调用实例的 throwIfRequested 方法。

```js
CancelToken.prototype.throwIfRequested = function () {
  if (this.reason) {
    throw this.reason;
  }
};
```
回顾 dispatchRequest 函数，里面有3处调用 throwIfCancellationRequested 函数

```js
function dispatchRequest(config) {
  throwIfCancellationRequested(config); 
  // ...
  var adapter = config.adapter || defaults.adapter;
  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);
    // ...
    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);
      // ...
    }
    return Promise.reject(reason);
  });
};
```
用户可能在发起 XHR 请求前取消，执行 throwIfCancellationRequested 函数，如果 config.cancelToken 实例存在 reason 值，说明用户调用了 cancel 方法发起取消的请求，则 throw 出 Cancel 实例的异常。如果用户添加了响应拦截器的失败回调，则该 Cancel 实例会被捕获到。如果用户没有配置响应拦截器的失败回调，则会在整个 axios API 调用的返回值继续 then 或 catch 时捕获到该 Cancel 实例

用户可能在发起 XHR 请求过程中取消，看看 xhrAdapter 函数：
```js
function xhrAdapter(config) {
	  return new Promise(function dispatchXhrRequest(resolve, reject) {
	    // ...
	    if (config.cancelToken) {
	      config.cancelToken.promise.then(function onCanceled(cancel) {
	        if (!request) return;
	        request.abort();
	        reject(cancel);
	        request = null;
	      });
	    }
      // ...
	  });
	};
```
