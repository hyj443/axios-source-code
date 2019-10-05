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

```