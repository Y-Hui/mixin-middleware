import compose from './compose'

export type noop = (...args: never[]) => unknown

// Promise 解包获取 value
type Unpromise<T> = T extends Promise<infer U> ? U : T

export interface Context<Req, Res> {
  req: Req
  res?: Res
  setRes: (value: unknown) => void
}

export type ScopedMiddlewareType = 'prefix' | 'suffix'

export type Next = () => Promise<never>

export type Middleware<Ctx> = (context: Ctx, next: Next) => void

function mixin<T extends noop>(action: T) {
  if (typeof action !== 'function') {
    throw TypeError('`action` must be a funtion.')
  }

  type ActionOptions = Parameters<T>
  type ActionResult = Unpromise<ReturnType<T>>
  type ContentType = Context<ActionOptions, ActionResult>
  type MiddlewareType = Middleware<ContentType>

  const globalMiddleware: MiddlewareType[] = []

  // 执行中间件和 fetcher 函数
  const call = async <Result = ActionResult>(
    middleware: MiddlewareType[],
    options: ActionOptions,
  ): Promise<Result> => {
    // 中间件上下文
    const context: ContentType = {
      req: options,
      res: undefined,
      setRes: (value) => {
        context.res = value as never
      },
    }
    const flow = compose(middleware)
    try {
      await flow(context, async () => {
        try {
          const res = await Promise.resolve(action(...context.req))
          context.res = res as ActionResult
          return Promise.resolve()
        } catch (error) {
          return Promise.reject(error)
        }
      })
      return Promise.resolve(context.res as Result)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  const flow = <Result = ActionResult>(...options: ActionOptions) =>
    call<Result>(globalMiddleware, options)

  // 注册中间件
  flow.use = (nextMiddleware: MiddlewareType) => {
    globalMiddleware.push(nextMiddleware)
  }

  // 创建局部 flow 函数
  flow.create = () => {
    const scopedMiddleware: MiddlewareType[] = [...globalMiddleware]

    const callback = <Result = ActionResult>(...options: ActionOptions) =>
      call<Result>(scopedMiddleware, options)

    // 注册局部中间件
    callback.use = (
      type: ScopedMiddlewareType,
      nextMiddleware: MiddlewareType,
    ) => {
      if (type === 'prefix') {
        scopedMiddleware.unshift(nextMiddleware)
      } else {
        scopedMiddleware.push(nextMiddleware)
      }
    }
    return callback
  }

  return flow
}

export default mixin
