type Next = () => Promise<void>

/**
 * 处理中间件
 * @param middleware 中间件 stack
 */
export default function compose(middleware: unknown[]) {
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array!')
  }
  if (middleware.some((item) => typeof item !== 'function')) {
    throw new TypeError('Middleware must be composed of functions!')
  }

  const dispatchMiddleware = (context: unknown, next: Next) => {
    let index = -1
    const dispatch = (i: number): Promise<unknown> => {
      // 防止中间件重复调用 next
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'))
      }
      index = i
      // 取出对应中间件函数
      let fn = middleware[i]
      // 下标溢出，fn 此时无效
      if (i === middleware.length) {
        fn = next
      }
      // 最外层 next 函数无效，结束执行
      if (!fn) {
        return Promise.resolve()
      }
      try {
        // 执行中间件，参数 2 为 dispatch 下一个中间件
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)))
      } catch (err) {
        return Promise.reject(err)
      }
    }
    // 第一次执行，调用第一个中间件
    return dispatch(0)
  }

  return dispatchMiddleware
}
