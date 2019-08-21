'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');


// createInstance是创建axios对象的函数，这个对象有Axios原型上的属性，也有Axios实例的属性，它本身指向Axios原型上的request方法
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  // 创建一个 Axios 类的实例 context
  
  var instance = bind(Axios.prototype.request, context);
  // instance 就是改变了this（指向context）的 Axios.prototype.request 这个方法
  // 也就是 instance 是个函数对象

  // 把 Axios 原型上的方法（request、getUri）拷贝到 instance 上
  utils.extend(instance, Axios.prototype, context);

  // 把Axios的实例 context 上的属性（defaults、interceptors）拷贝到 instance
  utils.extend(instance, context);

  return instance; // 返回出 instance
}

// 创建一个用来导出的axios对象
var axios = createInstance(defaults);

// 把Axios类挂载到axios对象上
axios.Axios = Axios;

// 往axios对象上挂载一个创建一个新的axios对象的方法
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// 挂载 Cancel & CancelToken 方法
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// 挂载 all/spread 方法
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

// 导出axios对象
module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;
