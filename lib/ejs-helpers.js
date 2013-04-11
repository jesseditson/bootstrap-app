var config = require('config-heroku')
var glob = require('glob')

var getPaths = function(files,folder,prepend,localOnly){
  return _.flatten(files.map(function(p){
    return glob.sync('public/'+folder+'/' + p)
  }).map(function(a,i){
    if(!a.length) return localOnly ? null : files[i]
    return a.map(function(u){
      var u = u.replace(/^public/,'')
      return prepend ? prepend + u : u
    })
  }).filter(function(e){
    return e
  }))
}

module.exports = function(app) {
  var javascripts, stylesheets
  javascripts = Object.keys(config.client.cdnjavascripts).concat(getPaths(config.client.javascripts,'javascripts'))
  stylesheets = Object.keys(config.client.css).reduce(function(ss,query){
    ss[query] = getPaths(config.client.css[query],'css')
    return ss
  },{})
  
  app.locals({
    stylesheets : stylesheets,
    javascripts : javascripts,
    title : config.title || "My Great Website"
  })
}

var serverStartTime = new Date().getTime()

module.exports.middleware = function(req, res, next){
  res.locals.user = req.user
  next()
}

