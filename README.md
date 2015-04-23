easycache
=========

多功能的cache模块

## 介绍

目前支持的缓存类型:

- memory (lru)
- http server (mlru)
- redis
- tair

### 优点

- 不同的存储, 但用同一个客户端访问
- 简单的接口调用，最大限度上规避掉一些潜在的坑


## 安装

```bash
npm install easycache
```

## 使用

### tair

```bash
var cache = require('easycache');
var tair = cache({
  type: 'tair',
  // 以下配置参考 tair 
  dataId: 'datapid',
  namespace: 1,
  // 秒级别，默认 24小时
  expire: 86400
});
```

### lru

```bash
var cache = require('easycache');
var lru = cache({ type: 'lru', max : 256000000, maxAge : 86400000 });
```

### redis

```bash
var cache = require('easycache');
var redis = cache({ type: 'redis', redis: { server: ['127.0.0.1:6379', '127.0.0.1:6378'], password: 'helloworld' } });
```

### mlru

```bash
var cache = require('easycache');
var mlru = cache( { type: 'mlru', max : 256000000, maxAge : 86400000, port: port });
```
