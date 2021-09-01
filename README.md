## mixin-middleware

包装指定函数并为其添加类 koa 洋葱机制的中间件支持。

### 安装

```bash
yarn add mixin-middleware

# 或者使用 npm

npm install mixin-middleware
```

### 起步

使用 `mixin` 创建一个实例，它接收一个函数，内部会对此函数进行包装。

> 为行文方便，后文统一使用 `action` 称呼。

```ts
import mixin from 'mixin-middleware'

const action = (params) => {/* 省略实现过程 */}

// dispatcher 实例
const dispatcher = mixin({ action })
```

#### 调用 dispatcher

`dispatcher` 是一个函数，它与 `action` 基本一致，不过返回值是一个 Promise。

```ts
dispatcher({/* some params */}).then((res) => {
  console.log('action 执行后的返回值：', res)
})
```

#### 注册实例中间件

```ts
dispatcher.use(async (ctx, next) => {
  console.log('调用 action 前执行部分')
  await next()
  console.log('调用 action 后执行部分')
})
```

使用 `async/await` 语法等待其他中间件和 action 执行完成，在这之后处理 action 的结果。



#### 注册局部作用中间件

使用 `dispatcher.create` 可以基于 `dispatcher` 本身再次创建一个实例。它的返回值和 `action` 基本一致，依然返回一个 Promise。

```ts
const scopeDispatcher = dispatcher.create()

// 注册局部作用中间件
scopeDispatcher.use('prefix', async (ctx, next) => {})
scopeDispatcher.use('suffix', async (ctx, next) => {})

// scopeDispatcher 和 dispatcher 一样，都是 action 的变体。
// 它的调用方式和 dispatcher 一致。
scopeDispatcher({/* some params */}).then((res) => {
  console.log('action 执行后的返回值：', res)
})
```

`mixin-middleware` 内部使用数组存储中间件，`prefix` 注册中间件时会插入到数组前面，`suffix` 注册中间件时会插入到数组后面。

### 中间件的执行顺序

```ts
// Middleware 1
dispatcher.use(async (ctx, next) => {})
// Middleware 2
dispatcher.use(async (ctx, next) => {})

// Scoped 1
scopeDispatcher.use('prefix', async (ctx, next) => {})
// Scoped 2
scopeDispatcher.use('suffix', async (ctx, next) => {})
```

执行顺序如下：

```
Scoped 1 --> Middleware 1 --> Middleware 2 --> Scoped 2 --> action --> Scoped 2 --> Middleware 2 --> Middleware 1 --> Scoped 1
```

### Context

注册中间件时，中间件函数总共有两个参数：

- `context` 对应实例的上下文。

- `next` 调用下一个中间件。

context 结构如下：

- `context.req` 一个数组，存储传递给 action 的参数。
- `context.res` action 的返回值。
- `context.setRes` 用于修改 res 使用。
  原本是没有 setRes 这样一个函数，res 使用 action 的返回类型，由于类型限制，此时便不能再随意赋值了，所以我们提供了这样一个“逃生舱”。

```ts
// ctx 便是 context，这里使用缩写。
dispatcher.use(async (ctx, next) => {
  console.log('传递给 action 参数：', ctx.req)
  
  await next()
  
  console.log('action 的返回值：', ctx.res)
  
  // 修改 action 的返回值。修改 res 后，其他的中间件获取的 res 便是处理后的值了。
  ctx.setRes(...)
})
```

### 提前终止

若需要终止当前及后续中间件的执行，只需要抛出错误即可。

```ts
dispatcher.use(async (ctx, next) => {
  if(ctx.req[0] === null) {
    // 使用 throw
    throw Error('参数不能为 null')

    // 或者使用 reject
    // return Promise.reject(Error('参数不能为 null'))
  }
  await next()
})

dispatcher(null).then(() => {}).catch((err) => {
  console.log(err.message) // 参数不能为 null
})
```

### 统一错误处理

洋葱中间件确实很强大，但是我们似乎缺少了一个环节，如果 action 本身抛出错误如何处理？

那么接下来来看看 `errorHandler`。

```ts
import mixin from 'mixin-middleware'

const action = (params) => {/* 省略实现过程 */}

// dispatcher 实例
const dispatcher = mixin({
  action,
  errorHandler(err) {
    // err 为中间件、action 所抛出的错误
    // 如果有需要，则在此对错误进行处理
    
    // 无法处理，或需要在调用处处理的错误则依旧抛出。
    throw err
  },
})

dispatcher({/* some params */})
  .then(() => {})
  .catch((err) => {
  	// 通过 Promise.catch 做错误处理
	})
```

### 示例

#### 基本用法

```ts
import mixin from 'mixin-middleware'

function add(...numberList: number[]) {
  return numberList.reduce((res, item) => {
    if (!res) {
      return item
    }
    return res + item
  })
}

const dispatcher = mixin(add)

// 注册中间件。
// 过滤非 number 类型值
// 将最后结果乘 2
dispatcher.use(async (ctx, next) => {
  ctx.req = ctx.req.filter(
    (item) => typeof item === 'number' && !Number.isNaN(item),
  )
  await next()
  ctx.setRes((ctx.res || 0) * 2) // 将结果乘 2
})
```

调用结果：

```ts
// add 调用结果
add(1, '', null, 2, 3) // 结果："1null23"

// dispatcher 调用结果
dispatcher(1, '', null, 2, 3).then((res) => {
  console.log(res) // 结果：12
})
```

#### 接口请求

```ts
import mixin from 'mixin-middleware'

const ajax = (params) => {/* 省略实现代码 */}

const request = mixin({ action: ajax })

// 注册实例中间件
// 处理 url 前缀的中间件
request.use(async (ctx, next) => {
  const { req } = ctx
  const { url } = req

  if (url.indexOf('/api') !== 0) {
    ctx.req.url = `/api/${url}`
  }

  // 等待下一个中间件执行完成
  await next()

  // 此处获取接口返回结果
  console.log(ctx.res)
})

// 发起请求
request({ url: '/fake-url' })
  .then((res) => {
    // 业务代码
  }).catch((error) => {
    // 处理错误
  })
```

### 函数签名

```ts
type NOOP = (...args: never[]) => unknown

interface MixinOptions<T = NOOP> {
  /**
   * 需要包装的函数
   */
  action: T
  /**
   * 统一错误处理
   */
  errorHandler?: (error: unknown) => void
}
```

### 杂项

洋葱中间件是面向切面（AOP）的，因此 `mixin-middleware` 的适用范围很广，期待你使用它做出一些非常棒的东西。

