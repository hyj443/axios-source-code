/* axios v0.19.0 | (c) 2019 by Matt Zabriskie */
/**
 * 源码学习：何宇杰
 * axios是一個基於promise的HTTP庫，可以用在瀏覽器和node.js中
 */
(function webpackUniversalModuleDefinition(root, factory) {
  /**
   * 最外層是一個自執行函數，傳入 this, factory函數，區分了4種情況：
   * exports 和 module 都存在時，cmd模式，module.exports 为 factory() 执行的返回值
   * define和define.amd都存在时，amd模式；
   * 只有exports存在时；
   * 既不是cmd也不是amd模式时，挂载在传入的this上。
   */
  if (typeof exports === 'object' && typeof module === 'object')
    module.exports = factory();
  else if (typeof define === 'function' && define.amd)
    define([], factory);
  else if (typeof exports === 'object')
    exports["axios"] = factory();
  else
    root["axios"] = factory();
})(this, function () {
return (function (modules) { // 自执行函数，webpack啟動函數
  // modules數組，以key-val形式存儲所有被打包的模塊
  
  // 這裡的this是全局

  var loadedModules = {};
  // 一個模块缓存對象，存放loaded過的模塊，加載過的模塊不會二次執行。
  // 執行結果會緩存在裏面，當模塊被二次訪問時會先去裏面讀取被緩存的返回值，提升性能，避免模塊的重複調用（緩存優化）
  // __webpack_require__ 是模塊加載函數，加載的策略是：根據moduleid讀取，優先讀取loadedModules，檢查模塊是否在緩存裏，如果有直接返回他的exports（不會再次調用module），否則讀取modules.exports，然後進行緩存。
  function __webpack_require__(moduleId) {
    if (loadedModules[moduleId])
      return loadedModules[moduleId].exports;
    // 緩存中不存在需要加載的模塊，就新建一個模塊，並存入緩存中
    var module = loadedModules[moduleId] = {
      exports: {},
      id: moduleId,
      loaded: false
    };
    /**
     * 其實 webpack 就是將每一個js文件封裝成一個函數，每個文件的 require 方法對應就是 __webpack_require__，它会根據傳入的 moduleId 去加載對應的代碼。當我們想導出js文件的值時，要么用 module.exports，要么用 exports，這就對應了module, module.exports兩個參數
     */
    // modules[moduleId]就是對應的模塊方法，將this改成module.exports，執行模塊方法，傳入三個參數
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    // 將模塊標記為已加載，表明模塊已經載入
    module.loaded = true;
    // 返回模塊的導出值(注意modules[moduleId].call執行時module.exports會被修改)
    return module.exports;
  }
  // 在__webpack_require__函數上掛載m,c,p屬性，暴露modules數組、loadedModules模块缓存、空字符串
  __webpack_require__.m = modules;
  __webpack_require__.c = loadedModules;
  __webpack_require__.p = "";
  // 執行入口模塊，返回該模塊的導出內容
  return __webpack_require__(0);
})(
[
  // 所有模塊都放在一個數組 modules 裏，根據每個模塊在數組裏的index來區分和定位模塊
  // webpack把原來一個個獨立的模塊文件合併到一個bundle.js。因為瀏覽器不能向nodejs那樣快速的去本地加載一個個模塊文件，而必須通過http請求去加載還沒得到的文件，如果模塊數量很多，加載時間會很長，因此把所有模塊都放在數組裏，執行一次網絡加載
  /* 0 */
  (function (module, exports, __webpack_require__) {
    module.exports = __webpack_require__(1);
  }),
  /* 1 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    var bind = __webpack_require__(3);
    var Axios = __webpack_require__(5);
    var mergeConfig = __webpack_require__(22);
    var defaults = __webpack_require__(11);
    /**
     * 能實現axios的多種使用方式的核心是createInstance方法
     * createInstance 返回一個函數，即Axios.prototype.request，這個函數還有Axios.prototype上的方法作為自己的靜態方法，且這些方法的this都是指向同一個對象
     */
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig); // 創建一個Axios實例叫context
      var instance = bind(Axios.prototype.request, context); // instance指向Axios.prototype.request，this指向Axios實例
      // 把 Axios原型上的方法擴展到 instance 對象上，私有化 get post put等這些原型方法，並指定了this為context
      utils.extend(instance, Axios.prototype, context);
      // 把 Axios實例上的自身屬性和方法擴展到instance上
      utils.extend(instance, context);
      // 這樣 instance 指向 Axios.prototype.request，它可以直接調用Axios原型上的方法，也可以是它直接作為原型上的request方法接受參數執行，也可以調用Axios實例上的方法，this都指向Axios實例
      
      return instance;
    }

    // 創建一個axios實例，最後會被作為對象導出
    var axios = createInstance(defaults);
    // 暴露 Axios 類 實現類的繼承
    axios.Axios = Axios;

    // 暴露用於創建新實例的工廠方法
    axios.create = function create(instanceConfig) {
      return createInstance(mergeConfig(axios.defaults, instanceConfig));
    };

    // 暴露取消方法和CancelToken
    axios.Cancel = __webpack_require__(23);
    axios.CancelToken = __webpack_require__(24);
    axios.isCancel = __webpack_require__(10);

    // 暴露 all/spread 方法
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = __webpack_require__(25);
3
    
    module.exports = axios;
    // 導出的axios是一個函數

    // 允许在TypeScript中使用默认导入语法
    module.exports.default = axios;

  }),
  /* 2 */
  (function (module, exports, __webpack_require__) {

    'use strict';
    var bind = __webpack_require__(3);
    var isBuffer = __webpack_require__(4);

    // utils 是一個通用的輔助類工具函數庫

    var toString = Object.prototype.toString;

    function isArray(val) {
      return toString.call(val) === '[object Array]';
    }

    /**
     * 是否为ArrayBuffer
     * 1、js产生array的方式：字面量形式創建，new Array(3), new Array(a,b,c,...,n), str.split(''), str.match(/xxx/g)等等
     * 2、数组中可以放不同的数据类型的数据，js数据类型2种，值类型（基本类型、原始类型）、引用类型，常见的引用类型有Object、Array，数组的储存模型中，值类型被直接压入栈中，引用类型只会压入该值的一个索引，用C的概念就是只保存了数据的指针，这些引用类型值是存在堆中的某块区间的。堆和栈不是独立的，栈可以在堆中存放
     * ArrayBuffer 是最基础的数据类型，甚至不能称之为数据类型，需要通过其他方式来读写，ArrayBuffer 定义是表示一个二进制数据的原始缓冲区，该缓冲区用于存储各种类型化数组的数据，无法直接写入或读取ArrayBuffer，但可以根据需要，将其传递到类型化数组来解释原始缓冲区。
     * var buffer= new ArrayBuffer(30) 创建一个原始缓冲区
     * buffer实例有一个byteLength 属性，用于获取他的size，
     * 3.类型化数组，可以编制索引和操纵的ArrayBuffer对象的各种视图。所有数组类型的长度均固定
     * Float32Array 跟 Array 是十分类似的，只不过他每一个元素都是都是一个 32位（4字节） 的浮点型数据。Float32Array 一旦创建其大小不能再修改。
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    function isFormData(val) {
      return (typeof FormData !== 'undefined') && (val instanceof FormData);
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
      }
      return result;
    }

    function isString(val) {
      return typeof val === 'string';
    }

    function isNumber(val) {
      return typeof val === 'number';
    }

    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    function isFile(val) {
      return toString.call(val) === '[object File]';
    }


    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * a URLSearchParams object?
     * URLSearchParams 接口定義了一些方法來處理URL的查詢字符串，構造函數URLSearchParams
     */
    function isURLSearchParams(val) {
      return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
    }

    /**
     * 字符串的頭尾去掉空格
     * \s 查找空白字符。\d 数字
     * n*是量词，匹配任何包含0个或多个n的字符串。
     * n+ 匹配任何包含至少1个n的字符串
     * n? 匹配任何包含0个或1个 n的字符串。
     */
    function trim(str) {
      return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }

    /**
     * 確定是否能運行在標準瀏覽器環境
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
          navigator.product === 'NativeScript' ||
          navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * 遍曆數組或對象，對每個item執行回調函數
     * 如果obj是一个数组，回调的入参是item、index、数组本身
     * 如果obj是一个对象，回调的入参是键值、键名、对象本身
     */
    function forEach(obj, fn) {
      // 如果obj没有值，直接返回
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // 如果obj不可迭代，强制转成数组
      if (typeof obj !== 'object') {
        obj = [obj];
      }

      if (isArray(obj)) {
        // 遍曆數組每一項，執行回調函數，傳入三個參數
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // 遍曆對象的每個屬性
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // 等同 obj.hasOwnProperty(key)
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * 合併多個對象，淺拷貝
     * 當多個對象包含相同的key時，參數列表中後面的對象將優先(take precedence)
     *
     * Example:
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // 456
     * ```
     */
    function merge( /* obj1, obj2, obj3, ... */ ) {
      var result = {};

      function assignValue(val, key) {
        if (typeof result[key] === 'object' && typeof val === 'object') {
          // 當前遍曆的屬性是對象 且 在result中也是對象（說明已經合併過並屬性值是對象）
          // 就要對這兩個對象進行 merge，遞歸，結果賦 result[key]
          // 發現進行拷貝的兩個屬性都是對象時，就對此屬性對象中的子屬性進行拷貝，防止前面一個屬性對象的子屬性值被全部覆蓋
          result[key] = merge(result[key], val);
        } else {
          // 當前遍曆的屬性值不是對象，或者之前同名屬性在result中不是對象，就覆蓋為當前的屬性值
          result[key] = val;
        }
      }
      // 遍曆傳入的每個對象，遍曆對象中的屬性，对key和val执行assignValue回调
      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * 和merge函数差不多，不同在于：不保留对原始对象的引用
     * @see merge
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function deepMerge( /* obj1, obj2, obj3, ... */ ) {
      var result = {};

      function assignValue(val, key) {
        if (typeof result[key] === 'object' && typeof val === 'object') {
          // 遍曆的當前屬性值是對象，並且result中對應的屬性值也是對象，遞歸調用deepMerge
          result[key] = deepMerge(result[key], val);
        } else if (typeof val === 'object') {
          // 當前屬性值是對象，但result中對應的不是，這次不再簡單地覆蓋，而是對當前val進行deepMerge，因為它裏面可能有對象嵌入，讓它和一個空對象調用deepMerge
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
    /**
     * 將對象b的屬性擴展對象a上，同時考慮了复制對象中的方法时，this的指向
     * @param {Object} a 待扩展的对象
     * @param {Object} b 要从中复制属性的对象
     * @param {Object} thisArg 拷贝对象中的方法时，显式指定的this
     * @return {Object} 返回对象a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        // 遍历b的属性，执行回调assignValue
        if (thisArg && typeof val === 'function') {
          // 如果指定了this，遍曆到的屬性值是方法，在a写入改綁this後的方法
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }
    module.exports = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      deepMerge: deepMerge,
      extend: extend,
      trim: trim
    };
  }),
  /* 3 __webpack_require__(3) */
  (function (module, exports) {
    'use strict';
    /**
     * bind 執行返回一個改綁了this的函數
     * 實現效果等同Axios.prototype.request.bind(context)
     */
    module.exports = function bind(fn, thisArg) {
      // 返回一個未執行的包裹函數，這個函數會記錄傳入的參數，放到一個數組裏，包裹函數執行返回待bind函數改變this執行的結果，待bind函數接受的是那個參數數組
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };
  }),
  /* 4 */
  (function (module, exports) {
    /*!
      * 确定一个对象是否是Buffer
      */
    module.exports = function isBuffer(obj) {
      return obj != null && obj.constructor != null &&
        typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
    }
  }),
  /* 5 __webpack_require__(5)*/
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    var buildURL = __webpack_require__(6);
    var InterceptorManager = __webpack_require__(7);
    var dispatchRequest = __webpack_require__(8);
    var mergeConfig = __webpack_require__(22);

    /**
     * 創建一個axios實例
     * @param {Object} instanceConfig 默认配置项
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager()
      };
    }

    /**
     * 派發一個請求
     * @param {Object} config 專門為這個請求的配置（與this.defaults合併）
     */
    Axios.prototype.request = function request(config) {
      // 可以像fetch API那樣寫：axios('example/url'[, config])
      // 如果第一個入參是字符串，讓config為第二參數（若沒傳，就讓它為{}），config.url存第一個參數
      if (typeof config === 'string') {
        config = arguments[1] || {};
        config.url = arguments[0];
      } else {
        // 不是的话，config传对了，如果没传就{}
        config = config || {};
      }

      config = mergeConfig(this.defaults, config);
      config.method = config.method ? config.method.toLowerCase() : 'get';

      // 連接攔截器中間件
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
        // shift() 方法刪除數組中的第一個元素，並返回該元素的值，會改變數組長度
      }

      return promise;
    };

    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // 為支持的請求方法提供別名，將devare、get等方法掛載到Axios原型上
    utils.forEach(['devare', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      Axios.prototype[method] = function (url, config) {
        return this.request(utils.merge(config || {}, {
          method: method,
          url: url
        }));
      };
    });

    // 將post、put等方法掛載到Axios原型上，最終都走request方法，把配置的url config data都放到config
    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      Axios.prototype[method] = function (url, data, config) {
        return this.request(utils.merge(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });
    module.exports = Axios;
  }),
  /* 6 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    // encodeURIComponent()是對統一資源標識符（URI）的組成部分進行編碼的方法。用一個1-4個轉義序列來表示字符串中的每個字符的UTF-8編碼
    function encode(val) {
      return encodeURIComponent(val).
      replace(/%40/gi, '@').
      replace(/%3A/gi, ':').
      replace(/%24/g, '$').
      replace(/%2C/gi, ',').
      replace(/%20/g, '+').
      replace(/%5B/gi, '[').
      replace(/%5D/gi, ']');
    }

    /**
     * 通過將params追加到末尾來構建URL
     * 
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    module.exports = function buildURL(url, params, paramsSerializer) {
      if (!params) {
        return url;
      }
      // URLSearchParams 接口定義了一些實用的方法來處理 URL 的查詢字符串
      // var paramsString = "q=URLUtils.searchParams&topic=api"
      // var searchParams = new URLSearchParams(paramsString);
      // searchParams.toString()  // "q=URLUtils.searchParams&topic=api"

      var serializedParams; // 序列化的params
      if (paramsSerializer) { // 如果傳了序列化回調，就用它處理params
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) { // 如果沒有，就判斷是否是URLSearchParams的實例
        serializedParams = params.toString(); // URLSearchParams對象轉成字符串，可以直接用在URL上
      } else {
        var parts = []; // 既沒有傳處理函數，param沒有序列化，那就下面手動處理

        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils.isArray(val)) {
            // 如果params中的val是數組，給key字符串加[]，如果不是數組，強制讓他變成數組
            key = key + '[]';
          } else {
            val = [val];
          }
          // 現在val是數組了，對數組的每一項遍曆
          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              // 如果數組的項是時間對象，轉成iso格式字符串
              v = v.toISOString(); // ISO 8601 Extended Format的字符串：YYYY-MM-DDTHH:mm:ss.sssZ
            } else if (utils.isObject(v)) {
              // 如果只是一個普通對象，將一個（對象或數組）轉為JSON字符串
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });
        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }
        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }
      return url;
    };

  }),
  /* 7 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    // 攔截器管理器，維護一個數組handlers，存放攔截器
    function InterceptorManager() {
      this.handlers = [];
    }
    /**
     * 向棧中增加一個新的攔截器對象，裏面有成功的處理回調和失敗的處理回調
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} 一個 ID 用於後面移除攔截器，就是该拦截器在数组里的索引
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
      return this.handlers.length - 1;
    };
    /**
     * 從棧中移除一個攔截器 eject（彈出）
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };
    /**
     * 遍曆所有已註冊的攔截器，跳过已经变成空（被eject了）的拦截器
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };
    module.exports = InterceptorManager;
  }),
  /* 8 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    var transformData = __webpack_require__(9);
    var isCancel = __webpack_require__(10);
    var defaults = __webpack_require__(11);
    var isAbsoluteURL = __webpack_require__(20);
    var combineURLs = __webpack_require__(21);
    /**
     * 如果已經請求取消，則拋出“取消”。
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
    }

    /**
     * 向服務器分發一個請求，使用config適配器
     * @param {object} config 請求需要的 config 
     * @returns {Promise} The Promise to be fulfilled
     */
    module.exports = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // 寫了baseURL，且url不是絕對路徑，拼接一起
      if (config.baseURL && !isAbsoluteURL(config.url)) {
        config.url = combineURLs(config.baseURL, config.url);
      }

      // 確保 headers 存在
      config.headers = config.headers || {};

      // 轉換請求的 data
      config.data = transformData(
        config.data,
        config.headers,
        config.transformRequest
      );

      // 展平 headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers || {}
      );

      utils.forEach(
        ['devare', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );
      // 默认的适配器模块是根据当前的环境来选择用node或者XHR来发起请求，如果配置了符合规范的适配器函数来代替原始的模块（一般不会这么做，但这是一个低耦合扩展点）
      var adapter = config.adapter || defaults.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData(
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
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
  }),
  /* 9 */
  (function (module, exports, __webpack_require__) {

    'use strict';

    var utils = __webpack_require__(2);

    /**
     * 給一個請求或響應轉換 data
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    module.exports = function transformData(data, headers, fns) {
      utils.forEach(fns, function transform(fn) {
        data = fn(data, headers);
      });

      return data;
    };
  }),
  /* 10 */
  (function (module, exports) {

    'use strict';

    module.exports = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };
  }),
  /* 11 */
  (function (module, exports, __webpack_require__) {

    'use strict';
    var utils = __webpack_require__(2);
    var normalizeHeaderName = __webpack_require__(12);

    // 默認的Content-Type
    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // 設置headers裏的'Content-Type'的值
    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      // 只有 Node.JS 有 process 变量，且是 process 这个 [[Class]] 的實例
      if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // 對於node使用HTTP adapter
        adapter = __webpack_require__(13);
      } else if (typeof XMLHttpRequest !== 'undefined') {
        // 對於瀏覽器使用 XHR adapter
        adapter = __webpack_require__(13);
      }
      return adapter;
    }

    var defaults = {
      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        // 這兩個頭部字段一定要規範化
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
          // 傳的data是對象，把header的content-type改成這個
          setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
          return JSON.stringify(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        // 如果響應的data是字符串，轉換成json格式的對象
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            /* Ignore */
          }
        }
        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      }
    };

    defaults.headers = {
      common: {
        'Accept': 'application/json, text/plain, */*'
      }
    };

    utils.forEach(['devare', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });

    module.exports = defaults;
  }),
  /* 12 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    // 規範化 headers 的字段，如果原有的字段 name 變大寫後和傳入的一樣，就把name改成規範化的name，value不變
    module.exports = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };
  }),
  /* 13 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    var settle = __webpack_require__(14);
    var buildURL = __webpack_require__(6);
    var parseHeaders = __webpack_require__(17);
    var isURLSameOrigin = __webpack_require__(18);
    var createError = __webpack_require__(15);
    /**
     * 這個模塊是處理分發請求，並在收到響應後返回的Promise
     * axios裏的xhr模塊是對 XMLHTTPRequest 對象的封裝，
     * XMLHttpRequest 是一個api，使用 XMLHttpRequest 對象可以與服務器交互，為客戶端提供了在客戶端和服務器之間傳輸數據的功能，通過URL來獲取數據，不會使整個頁面刷新，只局部刷新。XMLHttpRequest 是一個JS對象，通過它可以取回一個URL上的資源數據，而且是所有類型的數據，除了http還支持file和ftp協議。
     * var req = new XMLHttpRequest()
     * 屬性：onreadystatechange，當readyState屬性改變時會調用它這個回調函數
     * 屬性：readyState，用於表示請求的5種狀態：
     *  0 UNSENT 已創建xhr對象，但open方法還沒有被調用
     *  1 OPENED open方法已經調用，但send方法還沒被調用
     *  2 HEADERS_RECEIVED 已獲取響應頭，send方法已經被調用，響應頭和響應狀態已經返回
     *  3 LOADING 正在接收服務器傳來的響應主體（body部分）
     *  4 DONE 請求完成，整個請求過程已經完畢，服務器返回的數據已經完全接收，或者本次接收已經失敗
     *  XMLHttpRequest-MDN https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest
     *  XMLHttpRequest 对象  http://wangdoc.com/javascript/bom/xmlhttprequest.html
     */
    module.exports = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;

        if (utils.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // 如果請求的data是FormData，刪掉請求頭的Content-Type，讓瀏覽器自動去設置她
        }

        var request = new XMLHttpRequest(); // 創建一個XHR對象

        // HTTP basic authentication 身份驗證
        if (config.auth) { 
          var username = config.auth.username || '';
          var password = config.auth.password || '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }
        // btoa()从 String 對象中創建一個 base64 編碼的 ASCII 字符串，其中字符串中的每个字符都被视为一个二进制数据字节。

        request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);
        // 初始化一個請求，請求的HTTP方法，請求的目標URL，第三個參數表示請求是異步/同步，默認true異步，如果設為false，則send()方法只有等到收到服務器返回了結果，才會進行下一步操作。同步ajax請求會造成瀏覽器失去響應，所以不該設為false

        // 設置請求超時時間（ms），超過這個時間，請求會自動結束
        request.timeout = config.timeout;

        // 設置回調函數，監聽readyState的變化
        request.onreadystatechange = function handleStateChange() {
          // 如果沒有請求對象，或readyState!==4（HTTP請求正在進行中，沒有完畢），直接返回
          if (!request || request.readyState !== 4) {
            return;
          }
          // XMLHttpRequest.status 表示服務器響應的 HTTP 狀態碼。如果通信成功，200。如果服務器沒有返回狀態碼，這個屬性默認200，請求發出之前，屬性為0。
          // 請求失敗，得不到響應，這會被處理onerror，但有一種例外：通過file協議請求，大多數瀏覽器會返回status 0，即便是成功的請求
          if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
            return;
          }

          // 準備響應頭
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          // XMLHttpRequest.getAllResponseHeaders() 方法返回所有的響應頭，以 CRLF 分割的字符串，如果沒有收到任何響應，返回null
          var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
          // 若沒有設置responseType或設為text，就以responseText形式返回，否則返回request.response，後者表示服務器返回的數據體（HTTP響應的body部分），它可能是任何數據類型，具體類型由XMLHttpRequest.responseType屬性決定

          // 準備響應對象
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config,
            request
          };

          settle(resolve, reject, response);

          // 清除 request
          request = null;
        };

        // 處理瀏覽器請求的取消(相對於手動取消)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(createError('Request aborted', config, 'ECONNABORTED', request));

          // Clean up request
          request = null;
        };

        // 處理低級的網絡錯誤
        request.onerror = function handleError() {
          // 瀏覽器會向我們隱藏真實的錯誤
          // 只有當網絡出錯時，才會觸發錯誤
          reject(createError('Network Error', config, null, request));

          // 清除 request
          request = null;
        };

        // 處理請求超時
        request.ontimeout = function handvarimeout() {
          reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
            request));
          // timeout of 20 ms exceeded 超過20ms的超時
          request = null;
        };

        // 增加 xsrf 頭部
        // 只有在標準瀏覽器中運行時，才能執行這個操作
        if (utils.isStandardBrowserEnv()) {
          var cookies = __webpack_require__(19);

          // 增加 xsrf 頭部
          var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // 設置瀏覽器發送HTTP請求的請求頭，setRequestHeader在open之後，send之前調用，接收兩個參數，一個是字符串，表示字段名，第二個是字段值
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // 如果data是 undefined，移除Content-Type
              delete requestHeaders[key];
            } else {
              // 否則增加請求頭
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed （帶證件）
        if (config.withCredentials) {
          request.withCredentials = true;
        }

        // 增加 responseType 響應類型 to request
        if (config.responseType) {
          try {
            request.responseType = config.responseType;
          } catch (e) {
            // 不兼容XMLHttpRequest Level 2的瀏覽器會拋出預期的DOMException
            // 但是，對於json類型，不會拋錯，因為她可以通過默認的'transformResponse'函數進行解析。
            if (config.responseType !== 'json') {
              throw e;
            }
          }
        }

        // 處理 progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // 不是所有的瀏覽器都支持上傳行為
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken) {
          // Handle cancellation
          config.cancelToken.promise.then(function onCanceled(cancel) {
            if (!request) {
              return;
            }
            request.abort();
            reject(cancel);
            // Clean up request
            request = null;
          });
        }

        if (requestData === undefined) {
          requestData = null;
        }

        // 實際發出HTTP請求，如果不帶參數，表示請求只有一個URL，沒有數據體，典型例子就是GET請求，如果帶有參數，就表示除了頭部信息，還有數據體，典型例子是POST請求
        request.send(requestData);
      });
    };

  }),
  /* 14 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var createError = __webpack_require__(15);
    /**
     * 基於響應的狀態 Resolve or reject a Promise（settle解決）
     *
     * @param {Function} resolve Promise的成功的處理回調函數.
     * @param {Function} reject Promise的失敗處理回調函數.
     * @param {object} response The response.
     */
    module.exports = function settle(resolve, reject, response) {
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
  }),
  /* 15 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var enhanceError = __webpack_require__(16);
    /**
     * 用來拋出錯誤，創建一個Error對象，帶有特定的message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    module.exports = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };

  }),
  /* 16 */
  (function (module, exports) {
    'use strict';
    /**
     * 更新 an Error，加上特定的 config，錯誤碼，和 response
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    module.exports = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }
      error.request = request;
      error.response = response;
      error.isAxiosError = true;
      error.toJSON = function () {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code
        };
      };
      return error;
    };
  }),
  /* 17 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    // node中 會忽略以下重複的請求頭
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];
    /**
     * 把頭信息解析成對象
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     */
    module.exports = function parseHeaders(headers) {
      var parsed = {},
        key, val, i;
      if (!headers) { // 沒有傳入headers，返回空對象
        return parsed;
      }
      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':'); // i 表示冒號的位置
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            // 如果parsed已經存在這個key，且這個key重複了是會被忽略的，直接返回
            return;
          }
          if (key === 'set-cookie') {
            // 如果這個key是set-cookie，就把val追加到數組裏
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            // 剩下的key，重複了也不被忽略，就在parsed中對應的val中追加
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });
      return parsed;
    };
  }),
  /* 18 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    module.exports = (
      utils.isStandardBrowserEnv() ?
      // 標準瀏覽器環境，完全支持 測試請求的URL是否與當前位置具有相同來源的API。
      (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent); // msie 代表是否是IE瀏覽器
          
        var urlParsingNode = document.createElement('a'); // 創建一個a標籤節點
        var originURL;

        /**
         * 解析URL，提取域名、查詢關鍵字、變量參數值等，不需要正則去抓取，巧借瀏覽器協助，用JS先創建一個a標籤，將待解析的URL賦給它的href屬性
         * @returns {Object}
         */
        function resolveURL(url) {
          var href = url;

          if (msie) {
            // IE 瀏覽器 需要兩次屬性的設置才能規範化屬性
            urlParsingNode.setAttribute('href', href);
            href = urlParsingNode.href;
          }

          urlParsingNode.setAttribute('href', href);

          // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
          return {
            href: urlParsingNode.href,
            protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
            host: urlParsingNode.host,
            search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
            hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
            hostname: urlParsingNode.hostname,
            port: urlParsingNode.port,
            pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
              urlParsingNode.pathname : '/' + urlParsingNode.pathname
          };
        }

        originURL = resolveURL(window.location.href);

        /**
         * 確定一個URL是否和當前位置同源
         * 如果兩個頁面的協議和端口號(如有指定)和主機都相同，則兩個頁面具有相同的源
         * 瀏覽器的同源策略限制了從一個源加載的文檔或腳本 和另一個源的資源進行交互，這事一個用於隔離潛在惡意文件的重要安全機制
         * 
         * @param {String} requestURL The URL to test
         * @returns {boolean} True if URL shares the same origin, otherwise false
         */
        return function isURLSameOrigin(requestURL) {
          var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
          return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
        };
      })() :

      // 非標準瀏覽器環境
      (function nonStandardBrowserEnv() {
        return function isURLSameOrigin() {
          return true;
        };
      })()
    );
  }),
  /* 19 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    module.exports = (
      utils.isStandardBrowserEnv() ?
      /**
       * why Cookie，http是一個無狀態的協議，每次http請求對服務器來說都是全新的請求，我們希望Cookie攜帶一些客戶端之前的信息
       * 服務端通過http響應頭 Set-Cookie 字段設置，客戶端存儲Cookie，客戶端下次每次請求時通過http請求頭的Cookie字段，發送給後端
       * why Session
       * Session其實是Cookie的一種具體表現，每次客戶登錄網站時，後臺生成一個Session id並設置一個過期時間，並用一個hash存儲，在響應的http請求裏設置一個會話階段的Cookie
       * 知識點梳理：
       * Cookie是存儲在客戶端的，如果不設置過期時間，就存儲在瀏覽器進程中，徹底退出瀏覽器後Cookie就消失，設置了過期時長，存儲在客戶端硬盤中，在過期之前有效
       */
      // 標準瀏覽器環境，支持 document.cookie
      (function standardBrowserEnv() {
        return {
          // 寫入cookies
          write(name, value, expires, path, domain, secure) {

            var cookie = [];
            cookie.push(name + '=' + encodeURIComponent(value));

            if (utils.isNumber(expires)) {
              cookie.push('expires=' + new Date(expires).toGMTString());
            }

            if (utils.isString(path)) {
              cookie.push('path=' + path);
            }

            if (utils.isString(domain)) {
              cookie.push('domain=' + domain);
            }

            if (secure === true) {
              cookie.push('secure');
            }

            document.cookie = cookie.join('; ');
          },
          // 讀取Cookie
          read(name) {
            var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
            // /(^|;\s*)(name)=([^;]*)/ 以空或;開頭，然後是0或多個空格，然後是name，然後是後面只要不是;都收進去
            //  * 匹配前一個表達式0次或多次
            return (match ? decodeURIComponent(match[3]) : null);
          },
          // 移除Cookie
          remove(name) {
            this.write(name, '', Date.now() - 86400000);
          }
        };
      })() :

      // 不是標準的瀏覽器環境（比如web workers, react-native）不能Cookie操作
      (function nonStandardBrowserEnv() {
        return {
          write() {},
          read() {
            return null;
          },
          remove() {}
        };
      })()
    );
  }),
  /* 20 */
  (function (module, exports) {

    'use strict';
    /**
     * 判斷這個特定的URL是否是絕對URL
     */
    module.exports = function isAbsoluteURL(url) {
      // 如果URL以“<scheme>：//” 或 “//”开头，则该URL被视为绝对URL。
      // RFC 3986 將方案名稱定義為以 a-z 開頭，後跟a-z，0-9，+，- 或 . 的任意組合。
      return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
    };
  }),
  /* 21 */
  (function (module, exports) {
    'use strict';
    /**
     * combine base URL and base URL
     */
    module.exports = function combineURLs(baseURL, relativeURL) {
      return relativeURL ?
        baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '') :
        baseURL;
    };
  }),
  /* 22 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var utils = __webpack_require__(2);
    /**
     * mergeConfig 函數作用是合併配置項，合併兩個配置對象來創建新的配置對象
     */
    module.exports = function mergeConfig(config1, config2) {
      config2 = config2 || {};
      var config = {};

      utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') {
          // 如果config2存在這些屬性，就將其加入到config中
          config[prop] = config2[prop];
        }
      });

      utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties(prop) {
        if (utils.isObject(config2[prop])) {
          // 如果config2中該屬性值是對象，就把 config1和config2的這個屬性深度合併，賦給config
          config[prop] = utils.deepMerge(config1[prop], config2[prop]);
        } else if (typeof config2[prop] !== 'undefined') {
          // config2中該屬性不為undefined，但不是對象，就加入到config
          config[prop] = config2[prop];
        } else if (utils.isObject(config1[prop])) {
          // config2中該屬性不存在，但config1存在並為對象，把config1的屬性進行内部的深度合併（去掉重複的屬性）
          config[prop] = utils.deepMerge(config1[prop]);
        } else if (typeof config1[prop] !== 'undefined') {
          // 如果config2中該屬性不存在，config1該屬性只是存在，但不是對象，直接拷貝到config
          config[prop] = config1[prop];
        }
      });

      utils.forEach([
        'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
        'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
        'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength',
        'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken',
        'socketPath'
      ], function defaultToConfig2(prop) {
        if (typeof config2[prop] !== 'undefined') { // 如果config2中該屬性存在，就優先拷貝，否則拷貝config1中的該屬性
          config[prop] = config2[prop];
        } else if (typeof config1[prop] !== 'undefined') {
          config[prop] = config1[prop];
        }
      });
      return config;
    };
  }),
  /* 23 */
  (function (module, exports) {
    'use strict';
    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel(message) {
      this.message = message;
    }
    Cancel.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };
    Cancel.prototype.__CANCEL__ = true;
    module.exports = Cancel;
  }),
  /* 24 */
  (function (module, exports, __webpack_require__) {
    'use strict';
    var Cancel = __webpack_require__(23);
    /**
     * axios 的config 提供了一個cancelToken屬性，可以傳一個 `CancelToken` 對象，在請求的任何階段關閉請求
     */
    function CancelToken(executor) {

      if (typeof executor !== 'function') { // 如果executor不是函數，拋出錯誤
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;
      // CancelToken對象上的promise屬性，一個promise對象，resolve方法存到resolvePromise裏
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this; // 當前的CancelToken對象
      executor(function cancel(message) {
        if (token.reason) {
          // CancelToken對象已經有reason屬性了，說明已經請求過取消操作了
          return;
        }
        // 給當前的CancelToken對象設置reason屬性，是一個Cancel对象
        token.reason = new Cancel(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
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
    module.exports = CancelToken;
  }),
  /* 25 */
  (function (module, exports) {
    'use strict';
    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    module.exports = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };
  })
])
});