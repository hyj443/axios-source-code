'use strict';
/**
 * bind执行返回一个改绑了this的函数
 */
module.exports = function bind(fn, thisArg) {
  // 返回一个未执行的包裹函数，这个函数把传入的参数放入一个数组，包裹函数执行时返回 fn 函数改变了this的执行结果，fn执行的时候就是接受的这个数组
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};
