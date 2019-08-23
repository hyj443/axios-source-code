'use strict';

var utils = require('../utils');
/**
 * 处理hearders的函数，传入想要规范化的某个header：normalizedName
 * normalizedName 是规范的
 */
module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) { // 如果headers中存在大写了后和规范的一样的，就换成规范的，如果没有就不换
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};
