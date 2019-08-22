'use strict';

var utils = require('../utils');

/**
 * 合并两个配置对象，来创建一个新的配置对象
 */
module.exports = function mergeConfig(config1, config2) {

  config2 = config2 || {};
  var config = {};

  // 这些属性，config2有就用，没有就算了
  utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });
  // 如果是headers、auth、proxy属性
  utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties(prop) {
    if (utils.isObject(config2[prop])) {
      // 如果config2中该属性值是对象，就把config1和2的这个属性深度合并，赋给config
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);
    } else if (typeof config2[prop] !== 'undefined') {
      // config2中该属性值不是未定义，但不是对象，就用它
      config[prop] = config2[prop];
    } else if (utils.isObject(config1[prop])) {
      // config2中该属性不存在，但config1中存在并为对象，把config1的该属性进行内部的深度合并（去掉重复的属性）
      config[prop] = utils.deepMerge(config1[prop]);
    } else if (typeof config1[prop] !== 'undefined') {
      // config2中该属性不存在，config1存在但不是对象，直接用config1的
      config[prop] = config1[prop];
    }
  });

  // 这些属性以config2的优先，config2中没有才拷贝config1中的属性值 
  utils.forEach([
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength',
    'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken',
    'socketPath'
  ], function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  return config;
};
