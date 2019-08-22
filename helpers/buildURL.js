'use strict';

var utils = require('./../utils');

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
 * 通过将params追加到末尾来构建URL
 */
module.exports = function buildURL(url, params, paramsSerializer) {

  if (!params) {
    return url;
  }

  var serializedParams; // 序列化后的params
  if (paramsSerializer) { // 如果传了处理函数，就用它处理
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) { // 判断是否是URLSearchParams的实例，是的话调用toString方法，转成字符串可以直接用在URL上
    serializedParams = params.toString();
  } else {
    var parts = []; // 手动处理

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }
      // 如果params中的val是数组，给key属性加[]，如果不是，强制让他变成数组
      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }
      // 现在val是数组了，对数组的每一项进行遍历
      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          // 如果遍历到的是时间对象，转成iso格式字符串
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          // 如果只是一个普通对象，将它转为json字符串
          v = JSON.stringify(v);
        }
        // 把key=val字符串推入数组parts
        parts.push(encode(key) + '=' + encode(v));
      });
    });
    // 把parts数组的各项拼接
    serializedParams = parts.join('&');
  }

  if (serializedParams) { // 如果存在#，就截去#后面的
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};
