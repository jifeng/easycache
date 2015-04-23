var e = require('expect.js');
var jmspy = require('jm-spy');
var Cache = require('../index');
var tair = require('tair');

describe('Cache support tair', function () {

  var cache = Cache({
    type: 'tair',
    dataId: 'datapid',
    namespace: 1
  });
  var spy1 = null;
  var spy2 = null;
  beforeEach(function () {
    spy1 = jmspy.spyOn(cache.storage.tair, 'put');
    spy2 = jmspy.spyOn(cache.storage.tair, 'get');
  });
  afterEach(function () {
    jmspy.spyOff(cache.storage.tair, 'put');
    jmspy.spyOff(cache.storage.tair, 'get');
  });

  it('when set foo bar, should success', function (done) {
    spy1.and.callFake(function (key, value, options, cb) {
      e(key).to.be('acbd18db4cc2f85cedef654fccc4a4d8');
      e(value).to.be('bar');
      e(options).to.eql({
        expired: 86400
      });
      process.nextTick(function () {
        return cb(null)
      });
    });
    cache.set('foo', 'bar', function (err) {
      e(err).to.be(null);
      done();
    });
  });

  it('when get foo, should success', function (done) {
    spy2.and.callFake(function (key, cb) {
      e(key).to.be('acbd18db4cc2f85cedef654fccc4a4d8');
      process.nextTick(function (){
        return cb(null,{data: 'bar'})
      });
    });
    cache.get('foo', function (err, result) {
      e(err).to.be(null);
      e(result).to.be('bar');
      done();
    });
  });

  it('when del keys, should success', function (done) {
    spy1.and.callFake(function (key, value, options, cb) {
      e(value).to.be(null);
      e(options).to.eql({
        expired: 1
      });
      process.nextTick(function () {
        return cb(null)
      });
    });
    var kyes = ['foo1', 'foo2', 'foo3'];
    cache.remove(kyes, function (err) {
      e(err).to.be(null);
      done();
    });
  });

});