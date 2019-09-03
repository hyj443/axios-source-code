
// axios({
//   method:'get',
//   url: 'https://api.apiopen.top/musicRankings',

// }).then((res) => {
//   console.log(res)
// }).catch((err) => {
//   console.log(err)
// });

var config={
  gf: 'ylt',
  organsm:3
}
var p = Promise.resolve(config)

p = p.then(res => {
  return new Promise((resolve, reject) => {
    res.organsm++
    resolve(res)
  });
}).then(res => {
  return new Promise((resolve, reject) => {
    res.organsm++
    resolve(res)
  });
}).then(res => {
  return new Promise((resolve, reject) => {
    res.organsm++
    resolve(res)
  });
})

p.then(res => {
  console.log(res)
})