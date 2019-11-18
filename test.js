// axios.interceptors.request.use((config) => {
//   console.log('我在dispatchRequest前做了些事情')
//   return config
// }, (err) => {
//   return err
// })
// axios.interceptors.response.use((res) => {
//   console.log('我在拿到了response后做了些处理')
//   return res
// },(err) => {
//   return err
// })
// axios('http://localhost:3000/top/playlist/highquality?before=1503639064232&limit=3').then(res => {
//   console.log('这是最后拿到的数据',res)
// }).catch((err) => {
//   console.log(111, err)
// });
// axios('http://localhost:3000/top/playlist/highquality', {
//   method: 'get',
//   params: {
//     before: 1503639064232,
//     limit: 3
//   },
//   timeout: 4000,
//   responseType: 'json',
//   validateStatus: function (status) {
//     return status == 200
//   },
// }).then(res => {
//   console.log(res)
// })
// let chain = [(c) => {
//   return c
// },(c) => {
//     return c
//   }, (c) => {
//    return new Promise((resolve, reject) => {
//       setTimeout(() => {
//         c.d = 4
//         resolve(c)
//       }, 1000);
//    }).then((res) => {
//      return res
//     })
//   }, (res) => {
//     return res
//   }, (res) => {
//     res.g = 7
//     return res
//   }]
// let p = Promise.resolve({ a: 1 })
// while (chain.length) {
//   console.log(p)
//   p=p.then(chain.shift(),undefined)  
// }
// p.then((res) => {
//   console.log(res,'最后的拿到的值是多少')
// })

new Promise(function 执行器(rsv) {
  rsv(1111)
})
  .then((r) => {
    console.log(r)
    return r+1
  })
  .then((r) => {
    console.log(r)
    return r+1
  })
  .then((r) => {
    console.log(r)
    return r+1
})