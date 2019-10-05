// axios({
//   method:'get',
//   url: 'https://api.apiopen.top/musicRankings',

// }).then((res) => {
//   console.log(res)
// }).catch((err) => {
//   console.log(err)
// });

// var config={
//   gf: 'ylt',
//   organsm:3
// }
// var p = Promise.resolve(config)

// p = p.then(res => {
//   return new Promise((resolve, reject) => {
//     res.organsm++
//     resolve(res)
//   });
// }).then(res => {
//   return new Promise((resolve, reject) => {
//     res.organsm++
//     resolve(res)
//   });
// }).then(res => {
//   return new Promise((resolve, reject) => {
//     res.organsm++
//     resolve(res)
//   });
// })

// p.then(res => {
//   console.log(res)
// })

function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (Array.isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

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

function bind(fn, thisArg) {
  return function wrap(...arg) {
    return fn.apply(thisArg,arg)
  }
}