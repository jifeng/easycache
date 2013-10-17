var e = require('expect.js');

var Cache = require(__dirname + '/../');

var port = Math.floor(Math.random()* 9000 + 1000);
var mlruServer = Cache.createMlruServer({ port: port });


function runSuite(desc, options) {
  var cache = undefined;
  describe(desc, function () {
    var cache = undefined;
    before(function () {
      cache = Cache(options);
    });

    it('get', function (done) {
      cache.get('emptykey', function (err, item) {
        e(err).to.eql(null);
        e(item).to.eql(null);
        done();
      });
    });

    it('set and get', function (done) {
      cache.set('key1', 'value1', function (err) {
        e(err).to.eql(null);
        cache.get('key1', function (err, item) {
          e(err).to.eql(null);
          e(item).to.eql('value1');
          done();
        });
      });
    });

    it('set when error setex happan', function (done) {
      var _setx = cache.storage.setex;
      cache.storage.setex = function (k, expire, value, cb){
        process.nextTick(function () {
          cb(new Error('setx error'));
        });
      };
      cache.set('setexerrorkey', 'setexerrorvalue', function (err) {
        e(err).not.to.eql(null);
        e(err.message).to.equal('setx error');
        cache.storage.setex = _setx;
        done();
      });
    });


    it('remove when error srem happan', function (done) {
      var _srem = cache.storage.srem;
      cache.storage.srem = function (){
        var cb = arguments[arguments.length - 1];
        process.nextTick(function () {
          cb(new Error('srem error'));
        });
      };
      cache.remove('sremerrorkey', function (err) {
        e(err).not.to.eql(null);
        e(err.message).to.equal('srem error');
        cache.storage.srem = _srem;
        done();
      });
    });

    it('set and del', function (done) {
      cache.set('key2', 'value2', function (err) {
        e(err).to.eql(null);
        cache.get('key2', function (err, item) {
          e(err).to.eql(null);
          e(item).to.eql('value2');
          cache.remove('key2', function (err) {
            e(err).to.eql(null);
            cache.get('key2', function (err, item) {
              e(err).to.eql(null);
              e(item).to.eql(null);
              done(); 
            });
          });

        });
      });
    });

    it('set and set', function (done) {
      cache.set('key3', 'value3', function (err) {
        e(err).to.eql(null);
        cache.get('key3', function (err, item) {
          e(err).to.eql(null);
          e(item).to.eql('value3');
          cache.set('key3', 'xxxxxxx', function (err) {
            e(err).to.eql(null);
            cache.get('key3', function (err, item) {
              e(err).to.eql(null);
              e(item).to.eql('xxxxxxx');
              done(); 
            });
          });
        });
      });
    });

    it('keys', function (done) {
      cache.keys(function (err, items) {
        e(items.indexOf('setkey')).to.eql(-1);
        cache.set('setkey', 'setvalue', function (err) {
          e(err).to.eql(null);
          cache.keys(function (err, items) {
            e(items.indexOf('setkey') >= 0).to.eql(true);
            done();
          });
        });
      });
    });

    it('getRelatedKeys', function (done) {
      cache.getRelatedKeys('related1', function (err, items) {
        e(err).to.eql(null);
        e(items).to.be.empty();
        cache.set('related1', 'value', function (err) {
          cache.getRelatedKeys('related1', function (err, items) {
            e(items).to.be.contain('related1');
            cache.set('related1+related2', 'value', function (err) {
              cache.getRelatedKeys('related1', function (err, items) {
                e(items).to.be.contain('related1');
                e(items).to.be.contain('related1+related2');
                done();
              });
            });
          });
        });
      });
    });

    it('removeRelatedKeys', function (done) {
      cache.set('removekey1', 'value', function () {
        cache.set('removekey1+removekey2', 'value', function () {
          cache.getRelatedKeys('removekey1', function (err, items) {
            e(items).to.be.contain('removekey1');
            e(items).to.be.contain('removekey1+removekey2');
            cache.removeRelatedKeys('removekey1', function (err) {
              cache.getRelatedKeys('removekey1', function (err, items) {
                e(items).to.be.empty();
                done();
              });
            });
          });
        });
      });
    });
  });
}


runSuite('lru', { type: 'lru', max : 256000000, maxAge : 86400000 });
runSuite('mlru', { type: 'mlru', max : 256000000, maxAge : 86400000, port: port });
// runSuite('redis', { type: 'redis', redis: { server: ['127.0.0.1:6379', '127.0.0.1:6378'], password: 'helloworld' } });

describe('mlru many client', function () {
  var cache1 = Cache({ type: 'mlru', port: port });
  var cache2 = Cache({ type: 'mlru', port: port });
  it('one client set, another client get', function (done) {
    cache2.get('mlru_key1', function (err, data) {
      e(err).to.eql(null);
      e(data).to.eql(null);
      cache1.set('mlru_key1', 'mlru_value1', function (err) {
        e(err).to.eql(null);
        cache2.get('mlru_key1', function (err, data) {
          e(err).to.eql(null);
          e(data).to.eql('mlru_value1');
          done();
        });
      });
    });
  });
});
