
axios({
  method:'get',
  url: 'https://api.apiopen.top/musicRankings',

}).then((res) => {
  console.log(res)
}).catch((err) => {
  console.log(err)
});

