/*!
 * Cache Cache缓存控制类
 * dxpweb - lib/cache.js
 * Copyright(c) 2013 Taobao.com
 * Author: jifeng.zjd <jifeng.zjd@taobao.com>
 */

require('coffee-script');
var os = require('options-stream');
var mredis = require('mredis');
var lru = require('lru-cache');
var ep = require('event-pipe');
var request = require('request');
var connect = require('connect');
var http = require('http');
var parse = require('url').parse;
var crypto  = require('crypto');

var noop = function () {}
var md5 = function (data) {
  if ('string' === typeof data) {
    data = data = [data];
  }
  var hash = crypto.createHash('md5');
  for (var i = 0; i < data.length; i++) {
    hash.update(data[i]);
  }
  return hash.digest('hex');
}

var mlruPost = function (url, options, cb) {
  cb = cb || noop;
  request.post({ url:url, form: options }, function (err, r, body) {
    if (err) {
      return cb(err);
    }
    if (body === '') {
      return cb(null);
    }
    try {
      body = JSON.parse(body);
    } catch (err) {
      console.log(err, body);
      return cb(err)
    }
    cb(null, body);
  });
};
/**
 * options:
 *  type: 'lru'
 *  max : 256000000
 *  maxAge : 86400000
 * 或者
 *  type: 'redis'
 *  server: ['127.0.0.1:6379', '127.0.0.1:6378']
 *  password: 'E+24eMLc$=3am2+v^p93z6:K.i/hPw7T'
 *  db: 0
 *  speedFirst: true
 *  debug: true
 * 或者 共享数据的内存服务
 *  type: 'mlru'
 *  max : 256000000
 *  maxAge : 86400000
 *  port: 8001
 */
var Cache = function (options, cb) {
  this.options  = os({
    type: '',
    expire: 86400,
    prefix: '',
    keyset_key: '#all_key_sets#',
    port: 8001
  }, options);
  var settings = this.options;
  if (!settings.type || settings.type === 'lru') {
    settings.maxAge = settings.expire * 1000;
    this._initLru(cb);
  } else if (settings.type === 'mlru') {
    this._initMlru(cb);
  } else if (settings.type === 'redis') {
    this._initRedis(cb);
  } 
}



Cache.prototype._initRedis = function (cb) {
  var options = this.options;
  try {
    this.storage = mredis.createClient(options);
  } catch (err) {
    return cb(err);
  }
  var self = this;
  var pipe = ep();
  if (options.password) {
    pipe.seq(function () {
      self.storage.auth(options.password, this);
    });
  }
  pipe.seq(function () {
    self.storage.select(options.db || 0, cb || noop);
  });
  pipe.run();
}

Cache.prototype._initLru = function (cb) {
  var options = this.options;
  var self = this;
  this.cache = lru(options);
  this.storage = {
    get: function (key, cb) {
      return cb && cb(null, self.cache.get(key) || null);
    },
    setex: function (key, expire, value, cb) {
      self.cache.set(key, value);
      return cb && cb(null);
    },
    del: function (key, cb) {
      for (var i = 0; i < key.length; i++) {
        self.cache.del(key[i]);
      }
      return cb && cb(null);
    },
    end: function (cb) {
      self.cache.reset();
      return cb && cb();
    },
    flushdb: function (cb) {
      self.cache.reset();
      return cb && cb(null);
    },
    smembers: function (key, cb) {
      return cb(null, Object.keys(self.keySet || {}));
    },
    sadd: function (setKey, key, cb) {
      self.keySet = self.keySet || {};
      self.keySet[key] = 1;
      return cb(null);
    },
    srem: function() {
      var len = arguments.length;
      var keySet = self.keySet;
      for (var i = 1; i < len - 1; i++) {
        delete keySet[arguments[i]];
      }
      arguments[arguments.length - 1](null);
    }
  }
  return cb && cb(null);
}

Cache.prototype._initMlru = function (cb) {
  var options = this.options;
  var url = 'http://127.0.0.1:' + options.port;
  this.storage = {
    get: function (key, cb) {
      mlruPost(url, { func: 'get', args: [ key ] }, cb);
    },
    setex: function (key, expire, value, cb) {
      mlruPost(url, { func: 'setex', args: [ key, expire, value] }, cb);
    },
    del: function (key, cb) {
      mlruPost(url, { func: 'del', args: [ key ] }, cb);
    },
    end: function (cb) {
      mlruPost(url, { func: 'end', args: [ ] }, cb);
    },
    flushdb: function (cb) {
      mlruPost(url, { func: 'flushdb', args: [ ] } , cb);
    },
    smembers: function (key, cb) {
      mlruPost(url, {func: 'smembers', args: [ key ] }, cb);
    },
    sadd: function (setKey, key, cb) {
      mlruPost(url, { func: 'sadd', args: [ setKey, key ] }, cb);
    },
    srem: function() {
      var args = [];
      for (var i = 0; i < arguments.length - 1; i++) {
        args.push(arguments[i]);
      }
      mlruPost(url, { func: 'srem', args: args}, arguments[arguments.length - 1]);
    }
  }
  return cb && cb(null);
};

Cache.prototype.get = function(key, cb) {
  var k = md5(this.options.prefix + key);
  this.storage.get(k, cb);
};

Cache.prototype.set = function (key, value, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {expire: this.options.expire};
  }
  options = options || this.options;
  var thisOptions = this.options;
  var kname = thisOptions.prefix + key;
  var k = md5(kname);
  var paralle = [];
  var self = this;

  paralle.push(function () {
    self.storage.setex(k, options.expire, value, this);
  });
  paralle.push(function () {
    self.storage.sadd(thisOptions.keyset_key, kname, this);
  });
  ep().lazy(paralle, function () { cb && cb(null) }).on('error', function (err) { cb && cb(err) }).run();
};

Cache.prototype.remove = function (key, cb) {
  var thisOptions = this.options;
  var prefix = this.options.prefix;
  var keys = [];
  if (typeof key === 'object') {
    for (var i = 0; i < key.length; i++) {
      keys.push(md5(prefix + key[i]));
    }
  } else {
    keys = [ md5(prefix + key)];
  }
  var self = this;
  var paralle = [];
  paralle.push(function () {
    self.storage.del(keys, this);
  });
  paralle.push(function () {
    if (typeof key === 'string') {
      key = [key];
    }
    var params = [ thisOptions.keyset_key ].concat(key);
    params.push(this);
    self.storage.srem.apply(self.storage, params);
  });
  ep().lazy(paralle, function () { cb && cb(null) }).on('error', function (err) { cb && cb(err) }).run();
}

Cache.prototype.close = function (cb) {
  this.storage.end(cb);
}

Cache.prototype.clear = function (cb) {
  this.storage.flushdb(cb);
}

Cache.prototype.keys = function (cb) {
  var options = this.options;
  this.storage.smembers(options.keyset_key, cb);
}

Cache.prototype.getRelatedKeys = function (key, cb) {
  this.keys(function (err, keys) {
    if (err) {
      return cb(err);
    }
    var relatedKeys = [];
    keys = keys || [];
    for (var i = 0; i < keys.length; i++) {
      var item = keys[i] || '';
      var itemArray = item.split('+');
      for(var j = 0; j < itemArray.length; j++) {
        var row = itemArray[j];
        if(row === key) {
          relatedKeys.push(item);
        }
      }
    }
    cb(null, relatedKeys);
  });
}

Cache.prototype.removeRelatedKeys = function (key, cb) {
  var self = this;
  var thisOptions = this.options;
  var prefix = thisOptions.prefix;
  this.getRelatedKeys(key, function (err, items) {
    self.remove(items, cb);
  });
}

var MlruServer = function (options, callback) {
  var options = os({ max : 256000000, maxAge : 86400000, port: 8001 } , options);
  options.type = 'lru';
  var cache = new Cache(options);
  var app = connect();
  app.use(connect.bodyParser());
  app.use(function (req, res, next) {
    var body = req.body
    if (Object.keys(body).length === 0) {
      body = parse(req.url, true).query 
      try {
        body.args = JSON.parse(body.args);
      } catch(err) {}
    }
    var func = body.func;
    var args = body.args || [];

    if (!func || 
      ['get', 'setex', 'del', 'end', 'flushdb', 'smembers', 'sadd', 'srem'].indexOf(func) < 0) {
      res.statusCode = 500;
      res.end('The Operation Empty Or Not Supported');
    }
    var cb = function (err, data) {
      if (err) {
        res.statusCode = 500;
        return res.end(err.message);
      }
      res.end(JSON.stringify(data));
    };

    var args = args.concat(cb);
    try {
      cache.storage[func].apply(cache.storage, args);
    } catch (err) {
      res.statusCode = 500;
      return res.end(err.message);
    }
  });
  var server = http.createServer(app);
  server.listen(options.port, callback)
}

module.exports = function (options, cb) {
  return new Cache(options, cb);
}

module.exports.createMlruServer = function (options, cb) {
  return new MlruServer(options, cb);
}