# axios 源码中的utils函数

```js
var toString = Object.prototype.toString;
function isArray(val) {
  return toString.call(val) === '[object Array]';
}
```

```js
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}
```

```js
function forEach(obj, fn) {
  if (obj === null || typeof obj === 'undefined') {
    return
  }
  if (typeof obj !== 'object') {
    obj = [obj]
  }
  if (isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      fn.call(null, obj[i], i, obj)
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj)
      }
    }
  }
}

// 简化版
function forEach(obj, fn) {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      fn.call(null, item, index, obj)
    })
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key]
        fn.call(null, value, key, obj)
      }
    }
  }
}
```

merge：
遍历传入的每个对象，遍历对象中的每个键值对，对每个键值对执行assignValue回调，把键值对拷贝到result中，如果当前遍历的key在result中对应的val，都是对象，递归调用merge，合并两个对象，把合并后的对象赋给result，只要有一个不是对象，就让后者优先覆盖

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

// 简化版，不依赖 forEach 自定义的函数
function merge(...arg) {
  let result = {}
  arg.forEach(obj => {
    for (const key in obj) {
      const val = obj[key];
      if (typeof result[key] === 'object' && typeof val === 'object') {
        result[key] = merge(result[key], val)
      } else {
        result[key] = val
      }
    }
  })
  return result
}
```

deepMerge
深度合并，之前的merge只是合并了一层，对属性值是对象内部嵌套的

```js
function deepMerge(/* obj1, obj2, obj3, ... */) {
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
// 简化版
function deepMerge(...arg) {
  let result = {}
  arg.forEach(obj => {
    for (const key in obj) {
      const val = obj[key];
      if (typeof result[key] === 'object' && typeof val === 'object') {
        result[key] = deepMerge(result[key], val)
      } else if (typeof val === 'object') {
        result[key] = deepMerge({}, val);
      } else {
        result[key] = val;
      }
    }
  })
  return result
}
```

把对象b的属性扩展到对象a上，同时考虑了属性是方法时，this的指向

```js
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) { // 遍历b的属性。执行回调
    if (thisArg && typeof val === 'function') { // 如果指定了this，且遍历到的属性是方法，在a写入改绑this后的方法
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}
```

bind

```js
function bind(fn, thisArg) {
  // 返回一个未执行的包裹函数，这个函数把传入的参数放入一个数组，包裹函数执行时返回 fn 函数改变了this的执行结果，fn执行的时候就是接受的这个数组
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
module.exports = function xhrAdapter(config) {

  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    // 判断是否是FormData对象, 如果是, 删除header的Content-Type字段，让浏览器自动设置Content-Type字段
    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type'];
    }

    // 创建xtr对象
    var request = new XMLHttpRequest();

    // 设置http请求头中的Authorization字段
    // 关于Authorization字段
    // 更多内容参考https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Authorization
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      // 使用btoa方法base64编码username和password
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    // 初始化请求方法
    // open(method: 请求的http方法, url: 请求的url地址, 是否支持异步)
    request.open(
      config.method.toUpperCase(),
      buildURL(config.url, config.params, config.paramsSerializer),
      true
    );

    // 设置超时时间
    request.timeout = config.timeout;

    // 监听readyState状态的变化，当readyState状态为4的时候，表示ajax请求成功
    request.onreadystatechange = function handleLoad() {
      if (!request || request.readyState !== 4) {
        return;
      }

      // request.status响应的数字状态码，在完成请求前数字状态码等于0
      // 如果request.status出错返回的也是0，但是file协议除外，status等于0也是一个成功的请求
      // 更多内容请参考 https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/status
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // getAllResponseHeaders方法会返回所有的响应头
      // 更多内容请参考 https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/getAllResponseHeaders
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;

      // 如果没有设置数据响应类型（默认为“json”）或者responseType设置为text时，获取request.responseText值否则是获取request.response
      // responseType是一个枚举类型，手动设置返回数据的类型 更多请参考 https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/responseType
      // responseText是全部后端的返回数据为纯文本的值 更多请参考 https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/responseText
      // response为正文，response的类型取决于responseType 更多请参考 https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/response
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;

      var response = {
        data: responseData, // 响应正文
        status: request.status, // 响应状态
        statusText: request.statusText, // 响应状态的文本信息
        headers: responseHeaders, // 响应头
        config: config,
        request: request
      };

      // status >= 200 && status < 300 resolve
      // 否则reject
      settle(resolve, reject, response);

      request = null;
    };

    // ajax中断时触发
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      // 抛出Request aborted错误
      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      request = null;
    };

    // ajax失败时触发
    request.onerror = function handleError() {
      // 抛出Network Error错误
      reject(createError('Network Error', config, null, request));

      request = null;
    };

    // ajax请求超时时调用
    request.ontimeout = function handleTimeout() {
      // 抛出 timeout错误
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      request = null;
    };

    // 判断当前是为标准浏览器环境，如果是，添加xsrf头
    // 什么是xsrf header？ xsrf header是用来防御CSRF攻击
    // 原理是服务端生成一个XSRF-TOKEN，并保存到浏览器的cookie中，在每次请求中ajax都会将XSRF-TOKEN设置到request header中
    // 服务器会比较cookie中的XSRF-TOKEN与header中XSRF-TOKEN是否一致
    // 根据同源策略，非同源的网站无法读取修改本源的网站cookie，避免了伪造cookie
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // withCredentials设置跨域请求中是否应该使用cookie 更多请参考 https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/withCredentials
      // （设置了withCredentials为true或者是同源请求）并且设置xsrfCookieName
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
      // 读取cookie中XSRF-TOKEN
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        // 在request header中设置XSRF-TOKEN
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // setRequestHeader是用来设置请求头部的方法
    if ('setRequestHeader' in request) {
      // 将config中配置的requestHeaders，循环设置到请求头上
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          delete requestHeaders[key];
        } else {
          request.setRequestHeader(key, val);
        }
      });
    }

    // 设置xhr对象的withCredentials属性，是否允许cookie进行跨域请求
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // 设置xhr对象的responseType属性
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // 下载进度
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // 上传进度
    // request.upload XMLHttpRequest.upload 属性返回一个 XMLHttpRequestUpload对象，用来表示上传的进度
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // 取消请求，在介绍/lib/cancel/CancelToken.js中以及介绍，这里不在赘述
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }
        request.abort();
        reject(cancel);
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // 发送http请求
    request.send(requestData);
  });
};
```