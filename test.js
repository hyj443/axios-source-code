// axios.interceptors.request.use((config) => {
//   console.log('我在dispatchRequest前做了些事情')
//   return config
// }, (err) => {
//   return err
// })
// axios.interceptors.response.use((res) => {
//   console.log('我在拿到了response后做了些处理')
//   return res
// })
// axios('http://localhost:3000/top/playlist/highquality?before=1503639064232&limit=3').then(res => {
//   console.log('这是最后拿到的数据',res)
// }).catch((err) => {
//   console.log(111, err)
// });
let chain = [(c) => {
  return c
},(c) => {
    return c
  }, (c) => {
   return new Promise((resolve, reject) => {
      setTimeout(() => {
        c.d = 4
        resolve(c)
      }, 1000);
   }).then((res) => {
     return res
    })
  }, (res) => {
    return res
  }, (res) => {
    res.g = 7
    return res
  }]
let p = Promise.resolve({ a: 1 })
while (chain.length) {
  console.log(p)
  p=p.then(chain.shift(),undefined)  
}
p.then((res) => {
  console.log(res,'最后的拿到的值是多少')
})