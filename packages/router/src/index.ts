import {createBrowserHistory} from "history";
import {atom, Atom,  ManualCleanup, RxSet} from "data0";

export type InputRouteData<T> = {
    path: string,
    handler?: T,
    exact?: boolean,
    // CAUTION 使用 redirect 的  route 一定是 exact match
    redirect?: string|[string, true],
    strict?: boolean
}


type RouteNode<T> = {
    children: Map<string, RouteNode<T>>,
    // 只能有一个 dynamic param name。
    dynamicChildren?: {
        paramName: string,
        node: RouteNode<T>
    },
    handler?: T,
    redirect?: string|[string, true],
    strictHandler: any
}

type RouteParams = {[k: string]: any}
type RouteMatchResult = {
    handler?: any,
    path?: string,
    isExactMatch?:boolean,
    matchPath?: string,
    params?: RouteParams,
    redirect? : string| [string, true]
}

// strict 是用来处理既有参数，又有精确匹配的场景的，例如 /project/:id  和 /project/new
//  优先精确匹配。
export class Router<T> extends ManualCleanup{
    public pathname:Atom<string> = atom('');
    public handler: Atom<T|undefined> = atom(undefined);
    public params: Atom<{[k: string]: any}> = atom({});
    public path: Atom<string> = atom('');
    public children: RxSet<Router<T>> = new RxSet([])
    public map: RouteNode<T> = {
        children: new Map<string, RouteNode<T>>(),
        handler: undefined,
        redirect: undefined,
        strictHandler: undefined
    }
    constructor(public data: InputRouteData<T>[], public parentPath: string = '', public parent?:Router<T>, public history = createBrowserHistory(), ) {
        super()
        data.forEach(i => this.addOne(i))

        this.history.listen(this.onHistoryChange)
        this.onHistoryChange()
    }
    addOne(data: InputRouteData<T>) {
        // "/" 看做是对 "" 空字符串的严格匹配，这样在下面的 redirect 的情况中就不用单独处理了。注意非根节点的 / 也不会被忽略。
        const pathArr = data.path.split('/')
        if(pathArr[0] === '') pathArr.shift()
        let routeNode = this.map
        pathArr.forEach(frag => {
            if (frag.startsWith(':')) {
                if (routeNode.dynamicChildren) {
                    throw new Error('only one dynamic param is allowed')
                }

                routeNode.dynamicChildren = {
                    paramName: frag.slice(1),
                    node: {
                        children: new Map<string, RouteNode<T>>(),
                        handler: undefined,
                        strictHandler: undefined
                    }
                }
                routeNode = routeNode.dynamicChildren.node

            } else {
                const children = routeNode.children
                routeNode = children.get(frag)!
                if (!routeNode) {
                    children.set(frag, routeNode ={
                        children: new Map<string, RouteNode<T>>(),
                        handler: undefined,
                        strictHandler: undefined
                    })
                }

            }
        })

        if (data.strict) {
            routeNode.strictHandler = data.handler
        } else {
            routeNode.handler = data.handler
        }
        routeNode.redirect = data.redirect

    }
    add(data: InputRouteData<T>[]) {
        data.forEach(d => this.addOne(d))
        this.onHistoryChange()
    }
    recognize(inputPath:string): RouteMatchResult|undefined {
        if (!inputPath.startsWith(this.parentPath)) return

        // CAUTION 对于子路由来说，很可能是 /{parentPath} 的情况，为了保证仍然能有使子路由的 '/' 也匹配，把 parentPath replace 后如果没有子路由了，我们默认加上 /
        const relativePath = inputPath.slice(this.parentPath.length) || '/'
        const inputPathArr = relativePath.split('/')
        // 如果用户一直用 "/" 开头，那么要把头部的 "" 删掉。我们支持两种 style 的 path，一种是 /a/b/c，一种是 a/b/c
        if(inputPathArr[0] === "") inputPathArr.shift()

        let pointer: RouteNode<T> = this.map
        const resultPathArr: string[] = []
        const matchedPathArr: string[] = []
        const params: {[k:string]: any} = {}

        let isExactMatch = true
        // 1. 优先使用 children 匹配
        for(let frag of inputPathArr) {
            const strictNode = pointer.children.get(frag)
            if (strictNode) {
                resultPathArr.push(frag)
                matchedPathArr.push(frag)
                pointer = strictNode
            } else if(pointer.dynamicChildren) {
                params[pointer.dynamicChildren.paramName] = frag
                resultPathArr.push(pointer.dynamicChildren.paramName)
                matchedPathArr.push(frag)
                pointer = pointer.dynamicChildren.node
            } else {
                isExactMatch = false
                break
            }
        }
        return {
            handler: pointer.handler || pointer.strictHandler,
            redirect: pointer.redirect,
            params,
            isExactMatch,
            path: `/${resultPathArr.join('/')}`,
            matchPath: `/${matchedPathArr.join('/')}`
        }
    }
    onHistoryChange = () => {
        if (this.destroyed) return
        this.pathname(this.history.location.pathname)
        const result = this.recognize(this.history.location.pathname)
        this.handler(result?.handler)
        this.path(result?.path)
        this.params(result?.params)
        // CAUTION 使用 redirect 的 route 一定是 exact match
        if (result?.redirect) {
            if (Array.isArray(result.redirect)) {
                this.push(result.redirect[0], result.redirect[1])
            } else {
                this.push(result.redirect)
            }
        }
    }
    derive(path: string = this.path()) {
        const child = new Router<T>([],  `${this.parentPath}${path}`, this, this.history,)
        this.children.add(child)
        return child
    }
    redirect(absolutePath: string, reload = false) {
        if (reload) {
            window.location.href = absolutePath
        } else {
            this.history.push(absolutePath)
        }
    }
    push(path: string, reload = false) {
        // push 默认是到当前 router 的 root path 下，要接上 parentPath。
        // 也可以使用 `//` 来强行到所有 router 的 root path 下。
        if (path.startsWith('//')) {
            return this.redirect(path.slice(1), reload)
        }

        if (reload) {
            window.location.href = `${this.parentPath}${path}`
        } else {
            this.history.push(`${this.parentPath}${path}`)
        }
    }
    public destroyed = false
    destroy() {
        // CAUTION  history 没有 destroy api，所以用这个标记来不执行回调
        this.destroyed = true
        this.parent?.children.delete(this)
    }
}

export { createBrowserHistory, createHashHistory, createMemoryHistory} from 'history'
