# 深入浅出Axios源码

## Axios是什么

Axios 不是一种新的技术，本质上是对原生 XHR 的封装，只不过它是基于 Promise 实现的版本。

它的流程大致如下：

![](/pics/process.png)

## **axios** 到底是什么

我们看入口文件 index.js。index.js 文件中只有一句：

```js
module.exports = require('./lib/axios');
```

打开 lib/axios.js ，我们看到模块导出就是 axios：

```js
module.exports = axios;
```

可见 `axios` 是整个 Axios 库对外暴露的 API，看看它的定义：

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

createInstance 函数中，首先创建了一个 Axios 的实例 context，再调用 bind 函数，返回值赋给 instance，再两次调用 utils.extend 函数对 instance 进行扩展，最后返回出 instance，赋给了 axios。

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

bind 函数接收原型方法 request，和 context，执行返回一个新的函数 wrap，并赋给 instance，因此 instance 指向 wrap 函数。因为 axios 指向 bind 函数的返回值，所以 axios 也指向 wrap 函数。

wrap 函数执行的话，会返回 request 方法的执行结果，且 request 执行时的 this 指向 context，并接收 wrap 执行时接收的参数数组 args。可见该 bind 函数和原生 bind 实现效果一样，`bind(Axios.prototype.request, context)` 相当于 `Axios.prototype.request.bind(context)`

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
extend 函数中的 forEach 函数也是辅助函数之一，它的作用就是遍历对象或数组，执行传入的回调函数：
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

forEach 函数接收的 obj 如果是空值，直接返回。

如果 obj 有值但不是对象，则将它放入一个数组中。然后判断如果 obj 是数组，遍历数组，对每一项调用回调函数 fn。如果 obj 是对象，则遍历 obj 的自有属性，调用 fn。

因此，extend 函数就是通过调用 forEach 遍历对象 b 的自有属性，将键值对拷贝到对象 a 中，如果拷贝的是方法，则拷贝改绑了 this 为 thisArg 的方法。

两次 extend 将 Axios 原型上的属性/方法，和 Axios 实例上的属性/方法都拷贝到 instance 上。由于 instance 指向 wrap 函数，所以实际是给 wrap 函数添加这些属性和方法。

通过在源码中打断点验证了我的分析：

![avatar](/pics/axios的指向.png)

因为 axios 实际指向了 wrap 函数。所以 axios 执行并返回 Axios.prototype.request.apply(context, args) 。因此可以理解为 axios 指向指定了 this 的 Axios.prototype.request 方法。

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
Axios.prototype.request = function (config) {
  // ....
};
Axios.prototype.getUri = function (config) {
  // ...
};
```

Axios 的实例挂载了两个属性：defaults，保存 Axios 接收的配置对象；interceptors，属性值是一个包含 request 和 response 两个属性的对象，各自属性值均为 InterceptorManager 实例。

![avatar](/pics/Axios实例的属性.png)

接下来还会往 Axios.prototype 上添加 delete、get、head 等方法：

```js
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

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
前面提到过，Axios 原型上的属性和方法已经拷贝给 axios，所以 axios 可以直接调用 Axios 原型上的这些方法。

这些 Axios 原型方法接收的参数通过 utils.merge 函数做合并，传入 request 方法执行。

注意到 delete, get, head, options 这四个方法请求时是不传 data 的，post, put, patch 在请求时是带 data 的。

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
merge 函数首先创建一个空对象 result，然后逐个遍历所有接收的参数(对象)，将键值对添加到 result 中，如果发现有属性已经添加过，则判断，如果对应的属性值和新添加的属性值都是对象，则递归调用 merge 进行合并，返回值覆盖原来的属性值。

不满足都是对象的话，只需简单地将新的属性值覆盖上去就好。

前面提到，axios 可以理解为改绑了 this 的 request 方法，所以 axios 可以直接传入配置对象执行：即 axios(config)。

axios.request(config) 呢，是 Axios.prototype.request 接收 config 执行，axios[method](url[, config])，转而都调用 Axios.prototype.request 方法。

| API 写法        |说明                |
|-------------|------------------- |
|axios(config)|传入相关配置来创建请求|
|axios(url[, config])|可以只传url，但会默认发送 GET 请求|
|axios.request(config)|config中url是必须的|
|axios[method](url[, config])<br>axios[method](url[, data[, config]])|为了方便，给所有支持的请求方法提供了别名<br>这种情况下，不用再config中指定url、method、data|

## 配置对象config怎么起作用

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

config 配置对象在 Axios 库内部会经历了很多层的传递，它是怎么一步步传到需要它的地方，是我们希望了解的。

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

./defaults 文件导出的默认配置对象，传入 createInstance 函数执行。然后传入 new Axios 执行，前面提到 Axios 会把接收的配置对象赋给实例的 defaults 属性，即 Axios 实例的 defaults 保存默认配置对象。

那用户传的自定义配置呢？axios 各种调用方式接收用户传入的配置对象，实际调用 Axios.prototype.request，我们看看 request 方法是怎么处理的：

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
如果传入 request 的第一个参数是字符串，则默认第二个参数传的是配置对象，赋给 config，如果没传第二个参数，则赋给 config 一个空对象，把第一个参数的字符串赋给 config.url。

如果第一个参数不是字符串，则默它是配置对象，把它赋给 config，如果什么都没传，赋给 config 一个空对象。

接着调用 mergeConfig 函数将默认配置对象和 config 合并，返回值赋给 config。

可见，用户不同方式的传参，在 request 函数中会被整合到一个 config 对象

合并之后，如果 config.method 存在，则将它转为小写，如果不存在，则如果默认配置中配置了 method，则将它小写化并赋给 config.method，如果默认配置也没有配置 method，则默认为 'get'

我们大致看看 mergeConfig 的实现：

```js
module.exports = function mergeConfig(config1, config2) {
  config2 = config2 || {};
  var config = {};

  var valueFromConfig2Keys = ['url', 'method', 'params', 'data'];
  var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy'];
  var defaultToConfig2Keys = ['baseURL', 'url', 'transformRequest', 'transformResponse', 'paramsSerializer', 'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName', 'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength', 'validateStatus', 'maxRedirects', 'httpAgent','httpsAgent', 'cancelToken', 'socketPath'];

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

可以看到，不同的配置项有不同的合并策略：

对于'url', 'method', 'params', 'data'属性的合并，config2 中有就用 config2 中的，config2 没有也不用 config1 的。

对于'headers', 'auth', 'proxy'属性需要深度合并，如果 config2 中的属性值为对象，就将 config1 和 config2 的该属性值深度合并。如果 config2 中属性值存在，但不是对象，则取 config2 的属性值。如果 config2 中该属性不存在，但 config1 中存在，并且是对象，把 config1 的该属性值内部进行深度合并，去除重复的属性。如果 config2 中该属性不存在，config1 中存在，但不是对象，就用 config1 的

对于'baseURL', 'transformRequest'等属性，和 config2 中出现的上面没有提到的属性，如果 config2 中有就用 config2 的，config2 中没有，但 config1 中有，就用 config1 的。

我们看看 deepMerge 它和 merge 函数相似，但存在一点不同：

```js
function deepMerge( /* obj1, obj2, obj3, ... */ ) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = deepMerge(result[key], val);
    } else if (typeof val === 'object') {
      result[key] = deepMerge({}, val);
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
result 中 key 的属性值和当前遍历的 val 都是对象，则递归调用 deepMerge 将二者合并。如果只是当前遍历的 val 是对象，则递归调用 deepMerge 将自己和一个空对象合并，意义是合并掉自己的重复属性，如果两个都不是对象，则新的覆盖旧的

## 修改默认config的方式

我们知道 Axios 实例的属性已经被添加到了 axios 所指向的 wrap 函数上了，用户可以通过 `axios.defaults` 访问到 Axios 实例上的 defaults。

因此用户可以通过：`axios.defaults[configName] = value;`，直接修改或添加默认配置对象中的属性

除了这种修改默认配置的方式以外，axios 还挂载了 create 方法，供用户传入自定义的配置对象：

```js
let newAxiosInstance = axios.create({
  [配置项名称]: [配置项的值]
  // ...
})
```

axios.create 函数的实现只有简单的一句：

```js
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

axios.create 是对 createInstance 函数的封装。

axios.create 接收用户传入的配置对象，然后调用 mergeConfig 将它和默认配置对象合并，合并的结果传入 createInstance 函数执行，返回一个新的 wrap 函数，即新的 axios。

可见 axios.create 新建了一个 axios ，它所带的默认配置对象是由用户参与配置的。

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
config 经过整合合并后。接着，定义数组 chain ，里面放了 dispatchRequest 函数和 undefined。接着创建一个成功值为 config 的 Promise 实例，赋给变量 promise。

接下来：

```js
this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
});

this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
});
```
这里的 this 指向 Axios 实例，因此 this.interceptors.request 和 this.interceptors.response 对应的属性值均为 new InterceptorManager()，通过它调用 forEach，我们看看 InterceptorManager 构造函数和它的 forEach 原型方法：

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

InterceptorManager 实例挂载了一个 handlers 数组。

InterceptorManager 的原型方法 forEach 做的事：遍历实例的 handlers 数组，将数组的每个不为 null 的项传入 fn 执行。对于 this.interceptors.request 和 this.interceptors.response 调用 forEach 来说，fn 分别是 unshiftRequestInterceptors 函数和 pushResponseInterceptors 函数：

```js
function unshiftRequestInterceptors(interceptor) {
  chain.unshift(interceptor.fulfilled, interceptor.rejected);
}
function pushResponseInterceptors(interceptor) {
  chain.push(interceptor.fulfilled, interceptor.rejected);
}
```

unshiftRequestInterceptors 函数每次执行，会把 this.interceptors.request 的 handlers 数组里的每个 interceptor 对象的 fulfilled 属性值和 rejected 属性值，成对地推入 chain 数组的开头

![a](/pics/req-cb.png)

pushResponseInterceptors 函数每次执行，会把 this.interceptors.response 的 handlers 数组里的每个 interceptor 对象的 fulfilled 属性值和 rejected 属性值，成对地推入 chain 数组的末尾

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

use 是 InterceptorManager 的原型方法，用户可以通过 axios.interceptors.request.use 传入成功的回调和失败的回调，它们分会别赋给一个对象里的 fulfilled 和 rejected 属性，然后这个对象会被 push 进实例的 handlers 数组里，下面是用户使用 use 的方式：

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

这就是用户添加请求拦截器的方式，在请求拦截器的成功回调中，会做一些发送 HTTP 请求之前修改请求的 data 或 header 的工作，并且必须返回 config。失败回调中，在请求出错时做一些事情。

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

如果用户添加了拦截器方法，chain 数组就不止 dispatchRequest 方法和 undefinded，请求拦截器的回调在 dispatchRequest 之前，响应拦截器的回调在 dispatchRequest 之后，并且它们都是成对的，接下来开启一个 while 循环：

```js
while (chain.length) {
  promise = promise.then(chain.shift(), chain.shift());
}
```

![a](/pics/then1.png)

进入 while 循环之前， promise 状态是成功，它调用 then，接收两个从 chain 数组 shift 出来的函数，作为 then 的成功回调和失败回调，将它们注册为异步执行的微任务，推入微任务队列中，then 返回的新的 promise 实例的状态是 pending，覆盖给 promise 变量

![a](/pics/then2.png)

在 while 循环中，promise 继续调用 then，形成链式调用，chain 数组中的项被不断地成对 shift 出来，推入微任务队列中，直到 chain 数组到空，循环结束。

注意，结束 while 循环后的 promise 依然是一个状态为 pending 的 promise 实例，因为在执行同步代码，异步操作还没执行，还没有调用 resolve 或 reject 去更改 promise 的状态，最后 Axios.prototype.request 函数返回出该 promise。

![a](/pics/then.png)

当同步代码执行完，就开始执行异步的微任务队列，按 chain 中的回调被推入微任务队列的先后循序，首先依次执行所有请求拦截器方法，执行完如果没出现错误，就执行 dispatchRequest 方法。

因为请求拦截的成功回调接收的是 config，也必须返回 config，所以下一个请求拦截的成功回调的形参能接收上一个回调返回出的 config，处理之后再返回出来，config 就像在这个微任务队列中的前半部分传递，直到传到 dispatchRequest 方法。

接下来看看 dispatchRequest 函数：

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
dispatchRequest 函数接收 config 对象，首先对 config.headers 和 config.data 做一些处理

将 config.data, config.headers, config.transformRequest 传入 transformData 函数执行，返回值赋给 config.data。我们看看 transformData 的实现：

```js
module.exports = function transformData(data, headers, fns) {
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });
  return data;
};
```

transformData 函数会遍历 config.transformRequest 数组，执行它里面的每个函数，传入 config.data, config.headers，返回值再覆盖 config.data，循环结束后返回 config.data

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
默认的 config.transformRequest 数组只有一个 transformRequest 函数。它首先将 headers 对象中的 'Accept' 和 'Content-Type' 的属性名规范化。

```js
module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};
```
normalizeHeaderName 函数遍历 headers 对象的属性，如果发现当前遍历的属性和传入的规范的头部名不同，但它们转大写后是一样的，则把规范化的头部名添加到 headers 对象中，然后把原本的属性删掉。

回到 transformRequest，如果 config.data 是 FormData/ArrayBuffer/Buffer/Stream/File/Blob 类型，不作处理直接返回它本身。如果是 ArrayBuffer 类型数据的一个 view，返回它的 buffer 属性值。如果是 URLSearchParams 对象，先调用 setContentTypeIfUnset 函数进行头部的设置：

```js
function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}
```

如果 config.headers 存在，但不存在里面没有 'Content-Type' 属性，就给它加上，属性值为 'application/x-www-form-urlencoded;charset=utf-8'，然后 transformRequest 直接返回 data.toString()，即把 URLSearchParams 对象转成了 URL 查詢字符串。

如果 config.data 是普通对象，也先调用 setContentTypeIfUnset 函数：

同上，如果没有 'Content-Type' ，就加上，属性值为 'application/json;charset=utf-8'，然后直接返回 JSON.stringify(data)，将 data 对象转成 JSON 格式字符串。

不是以上的情况的话，直接返回 config.data 本身。

接下来，需要将 config.headers 做一下处理：

```js
config.headers = utils.merge(
  config.headers.common || {},
  config.headers[config.method] || {},
  config.headers || {}
);
```

如果没有特别配置config.headers.common，那它是由下面这个 defaults.headers.common 合并而来的：

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

即 config.headers 中每个 method 都有对应的属性值，是一个对象。

于是 config.headers.common 和 config.headers[config.method] 和 config.headers 经过 merge 合并后，赋给 config.headers，即 headers 对象中各个 method 的属性值中的字段被拿出来了，把它里面的属性展平了。

```js
utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
  function cleanHeaderConfig(method) {
    delete config.headers[method];
  }
);
```
config.headers[method] 对象中的属性被展平后，它就没有存在的意义了，所以删掉 config.headers 对象中关于 method 的属性

接着，来到了重点：

```js
var adapter = config.adapter || defaults.adapter;
return adapter(config).then( /*代码省略*/ );
```

如果用户配置了 adapter 方法，则将它赋给 adapter，否则使用默认的 adapter。然后调用 adapter ，传入已处理好的 config。返回值继续调用 then，dispatchRequest 函数最后返回 then 返回的 promise 实例。

用户一般不会自己定义 adaptor，我们看看默认的 adapter：

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

defaults.adaptor 的值是 getDefaultAdapter 的执行返回值。这个函数会根据是 Node.js 环境还是浏览器环境，require 不同的文件导出的函数。

http.js 文件中使用 Node 的 http 模块来实现请求的发送，在此不作具体分析。xhr.js 文件中导出了浏览器中使用的 xhrAdapter 函数:

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
    // 监听readyState，设置处理回调函数
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

为了方便阅读，我对 xhrAdapter 函数做了一些删减，函数返回一个 promise 实例，它管控了一套 XMLHTTPRequest 发起 AJAX 请求的流程。

异步请求成功后，根据返回的响应数据整合出 response 对象，response 会传入 settle 方法执行，settle 会根据响应的数据决定是调用 resolve 还是 reject，我们看看 settle 函数：

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

settle 函数首先获取 validateStatus 函数，优先使用用户自己配置的 validateStatus 函数，否则采用默认的 validateStatus，如下：

```js
var defaults = {
  validateStatus (status) {
    return status >= 200 && status < 300;
  }
};
```

validateStatus 函数会判断 response.status 值，即 HTTP 响应状态码，如果它在 [200,300) 内，则返回 true，然后调用 resolve(response) 将 xhrAdapter 函数返回的 promise 实例的状态变为 resolved，如果不在 [200,300) 内，则返回 false，调用 reject 将 promise 实例状态改为 rejected。

在 dispatchRequest 函数中，adapter 函数返回的 promise 继续调用 then，传入的成功回调和失败回调（刚刚省略没展示），它们对 adapter 返回的 promise 实例的成功值或失败值，即 response 或 reason，再次做加工：

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

成功的回调最后返回处理后的 response 对象，失败的回调返回处理过的 Promise.reject(reason)

这意味着，如果 HTTP 请求成功，dispatchRequest 函数返回的是成功值为 response 对象的成功状态的 promise 实例。

dispatchRequest 执行完，接着执行微任务队列中剩下的响应拦截器方法，它们接收 response 对象，对 response 对象做一些处理，再返回出 response，response 对象就像在微任务队列的后半部分传递，异步微任务队列执行完后，Axios.prototype.request 返回的 promise 的状态会变为 resolved 或 rejected。

即 request 方法返回的 promise 实例的状态取决于异步任务的结果。用户可以用这个 promise 实例继续调用 then，在 then 的回调中拿到 response 对象 或 reason 对象。其中 response 包含了 HTTP 请求响应的 data。

## 总结

到目前为止，整个 axios 调用流程就讲完了。核心方法是：Axios.prototype.request。

如果用户设置了拦截器方法，会被推入 chain 的数组中，chain 数组形如：[请求拦截器的成功回调, 请求拦截器的失败回调... + dispathRequest + 响应拦截器的成功回调, 响应拦截器的失败回调...]，然后通过 promise 实例链式调用 then，将 chain 数组中的方法推入微任务队列中，等待异步执行。

config 对象在这个微任务队列中的前半部分传递，到了 dispatchRequest 方法，它执行 adapter 方法（对于浏览器就是 xhrAdapter 方法），xhrAdapter 是发起 XHR 请求的 promise 封装，会根据响应的状态决定将返回的 promise 转为 resolved 或 rejected 状态。

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
