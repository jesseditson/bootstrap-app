
var config = require('config-heroku'),
    mongo = require('mongodb'),
    Server = mongo.Server,
    Db = mongo.Db,
    ReadPreference = mongo.ReadPreference,
    collectionMethods = Object.keys(require('mongodb').Collection.prototype),
    getResource = require('async-resource').get,
    _ = require('underscore');

function CollectionWrapper(name, getConnectedDb) {
  function mongoCollection(callback) {
    getConnectedDb(function(err, db) {
      if (err) return callback(err);
      db.collection(name, {readPreference:'secondary'}, callback);
    });
  }

  this.get = getResource(mongoCollection);
}

collectionMethods.forEach(function(method) {
  CollectionWrapper.prototype[method] = function() {
    var callback = _.last(arguments);
    var args = arguments;
    this.get(function(err, collection) {
      if (err) return callback(err);
      collection[method].apply(collection, args);
    });
  };
});

CollectionWrapper.prototype.findArray = function() {
  var args = Array.prototype.slice.call(arguments)
  var callback = args.pop()
  var toArray = function(err, result) {
    if (err) return callback(err)
    result.toArray(callback)
  }
  args.push(toArray)
  this.find.apply(this, args)
}

// sets up simple indexes based on the config object.
var setupIndexes = function(db,callback){
  if(!config.db.indexes) return callback()
  var collections = Object.keys(config.db.indexes)
  var indexCalls = []
  var toIndex = 0
  var completedIndex = function(err){
    if(err) console.log('failed creating index',err)
    if(--toIndex == 0) callback()
  }
  // build the calls
  collections.forEach(function(coll){
    var indexes = config.db.indexes[coll]
    indexes.forEach(function(index){
      toIndex ++
      if (_.isObject(index)) indexCalls.push([coll,index.index,index.options||{},completedIndex])
      else indexCalls.push([coll,index,{},completedIndex])
    })
  })
  // ensure indexes
  indexCalls.forEach(function(call){
    db.ensureIndex.apply(db,call)
  })
}

function DbWrapper(config) {
  var server = new Server(config.host, config.port, {auto_reconnect: true});
  var db = new Db(config.name, server, {safe: true});

  this.getConnectedDb = getResource(function(callback) {
    var _callback = callback
    callback = function(err,db){
      setupIndexes(db,_callback.bind(this,err,db))
    }
    db.open(function(err) {
      if (err) return callback(err);
      if (!config.auth) return callback(null, db);
      db.authenticate(config.user, config.pass, function(err, authenticated) {
        if (err) return callback(err);
        if (!authenticated) return callback(new Error('mongodb: invalid credentials'));
        callback(null, db);
      });
    });
  });
}

DbWrapper.prototype.add = function(collection, alias) {
  alias = alias || collection;
  if (this[alias]) return this;
  this[alias] = new CollectionWrapper(collection, this.getConnectedDb.bind(this));
  return this;
};

module.exports = {
  db: new DbWrapper(config.db),
  ObjectID: mongo.ObjectID,
  errorCodes: {
    dupKey: 11001
  }
};
