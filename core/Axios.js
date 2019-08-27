'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
// Axios类
function Axios(instanceConfig) {
  this.defaults = instanceConfig; // 把new Axios时传入的config挂到实例上
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * 发送请求的方法，挂到Axios的原型上
 * @param {Object} config 专门为请求的配置项 (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  // 如果接收的第一个参数是字符串，那么配置对象config就取第二个参数（没有传第二个参数就取{}）,再把传入的字符串以属性url挂到config上
  // 如果不是字符串就取它本身，什么都没传就取{}
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }
  // 合并配置项。把默认配置对象config（defaults.js导出的）和用户传入的config合并
  config = mergeConfig(this.defaults, config);

  config.method = config.method ? config.method.toLowerCase() : 'get';
  // 把config里的method的值小写，没传默认是get

  // Hook up interceptors middleware
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
// Axios原型方法，返回出构建好的URL
Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// 给Axios的原型上挂载 delete get 等方法，传入URL和config，返回出request方法的执行结果
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  Axios.prototype[method] = function(url, config) {
    // 把传入的config 和 {method: method, url: url} 合并一下，后者的权重高
    return this.request(utils.merge(config || {}, { 
      method: method,
      url: url
    }));
  };
});
// 给Axios的原型上挂载 post 等方法，这些都可以传请求主体的，返回出request方法的执行结果
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;
